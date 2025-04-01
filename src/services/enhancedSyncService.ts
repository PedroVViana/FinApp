import { 
  collection, 
  doc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  getDocs,
  writeBatch,
  runTransaction,
  serverTimestamp,
  DocumentReference,
  Unsubscribe,
  getDoc,
  setDoc,
  updateDoc,
  enableIndexedDbPersistence,
  disableNetwork,
  enableNetwork,
  getFirestore,
  QuerySnapshot,
  DocumentData,
  QueryDocumentSnapshot,
  addDoc,
  deleteDoc
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { Account, Transaction, Category, Goal, DEFAULT_CATEGORIES } from '../types';
import { openDB, IDBPDatabase } from 'idb';
import { initializeApp } from 'firebase/app';

// Configurações
const SYNC_CONFIG = {
  BATCH_SIZE: 20,
  MAX_CONCURRENT_BATCHES: 3,
  CACHE_DURATION: 1000 * 60 * 5, // 5 minutos
  SYNC_INTERVAL: 1000 * 30, // 30 segundos
  RETRY_ATTEMPTS: 3,
  MEMORY_THRESHOLD: 0.8 // 80% do limite de memória
};

// Interface para o cache
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  version: number;
}

// Classe principal de sincronização
export class EnhancedSyncService {
  private db: IDBPDatabase | null = null;
  private listeners: Map<string, Unsubscribe> = new Map();
  private cache: Map<string, CacheEntry<any>> = new Map();
  private syncInProgress: boolean = false;
  private memoryWarning: boolean = false;
  private version: number = 1;

  // Inicialização do IndexedDB
  private async initializeDB() {
    if (this.db) return this.db;

    this.db = await openDB('finapp-sync', 1, {
      upgrade(db) {
        // Stores para diferentes tipos de dados
        if (!db.objectStoreNames.contains('transactions')) {
          db.createObjectStore('transactions', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('accounts')) {
          db.createObjectStore('accounts', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('categories')) {
          db.createObjectStore('categories', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('sync_metadata')) {
          db.createObjectStore('sync_metadata', { keyPath: 'key' });
        }
      }
    });

    return this.db;
  }

  // Gerenciamento de Memória
  private checkMemoryUsage(): boolean {
    // @ts-ignore - A propriedade memory existe em alguns navegadores
    if (performance?.memory) {
      // @ts-ignore - A propriedade memory existe em alguns navegadores
      const usage = performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit;
      this.memoryWarning = usage > SYNC_CONFIG.MEMORY_THRESHOLD;
      
      if (this.memoryWarning) {
        this.cleanupResources();
      }
      
      return this.memoryWarning;
    }
    return false;
  }

  private cleanupResources() {
    // Limpar cache antigo
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > SYNC_CONFIG.CACHE_DURATION) {
        this.cache.delete(key);
      }
    }
    
    // Forçar coleta de lixo se disponível
    if (global.gc) {
      global.gc();
    }
  }

  // Gerenciamento de Listeners
  public setupTransactionsListener(
    userId: string,
    accountIds: string[],
    callback: (transactions: Transaction[]) => void
  ): Unsubscribe {
    console.log('[Sync] Configurando listener de transações para usuário:', userId);
    const listenerKey = `transactions-${userId}`;
    
    // Limpar listener existente se houver
    if (this.listeners.has(listenerKey)) {
      console.log('[Sync] Removendo listener existente');
      this.listeners.get(listenerKey)!();
      this.listeners.delete(listenerKey);
    }

    let isActive = true;
    let processingTimeout: NodeJS.Timeout | null = null;
    let retryCount = 0;
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 5000; // 5 segundos

    const processQueue = async () => {
      if (!isActive || this.memoryWarning) return;

      try {
        console.log('[Sync] Iniciando processamento de transações');
        // Verificar memória antes de processar
        if (this.checkMemoryUsage()) return;

        // Buscar todas as transações do usuário
        const transactionsQuery = query(
          collection(db, 'transactions'),
          where('userId', '==', userId)
        );

        console.log('[Sync] Executando query de transações');
        const snapshot = await getDocs(transactionsQuery);
        console.log('[Sync] Número de transações encontradas:', snapshot.size);

        const transactions: Transaction[] = [];

        snapshot.forEach((doc) => {
          const data = doc.data();
          console.log('[Sync] Processando transação:', {
            id: doc.id,
            dados: data,
            userId: data.userId,
            valor: data.amount,
            data: data.date,
            categoria: data.category
          });
          
          // Verificar se todos os campos necessários existem
          if (!data.userId || !data.amount || !data.date || !data.category) {
            console.warn('[Sync] Transação com dados incompletos:', doc.id);
            return; // Pular esta transação
          }

          transactions.push({
            id: doc.id,
            ...data,
            date: data.date instanceof Timestamp 
              ? data.date.toDate().toISOString()
              : data.date,
            createdAt: data.createdAt instanceof Timestamp
              ? data.createdAt.toDate().toISOString()
              : data.createdAt,
            updatedAt: data.updatedAt instanceof Timestamp
              ? data.updatedAt.toDate().toISOString()
              : data.updatedAt,
            amount: typeof data.amount === 'number' ? data.amount : parseFloat(data.amount)
          } as Transaction);
        });

        // Verificar se encontramos alguma transação
        if (transactions.length === 0) {
          console.log('[Sync] Nenhuma transação encontrada para o usuário');
        } else {
          console.log('[Sync] Total de transações processadas:', transactions.length);
        }

        // Atualizar cache
        this.updateCache(`transactions-${userId}`, transactions);

        // Callback com todos os dados processados
        if (isActive) {
          console.log('[Sync] Enviando transações para callback:', transactions);
          callback(transactions);
        }

        // Resetar contador de tentativas após sucesso
        retryCount = 0;

      } catch (error) {
        console.error('[Sync] Erro ao processar transações:', error);
        
        // Se for erro de índice e ainda não atingimos o máximo de tentativas
        if (error instanceof Error && 
            error.message.includes('requires an index') && 
            retryCount < MAX_RETRIES) {
          console.log(`[Sync] Aguardando índice... Tentativa ${retryCount + 1} de ${MAX_RETRIES}`);
          retryCount++;
          
          // Agendar nova tentativa
          setTimeout(processQueue, RETRY_DELAY);
          return;
        }
        
        // Se não for erro de índice ou atingimos máximo de tentativas, usar cache
        const cachedData = this.getCachedData<Transaction[]>(`transactions-${userId}`);
        if (cachedData) {
          console.log('[Sync] Usando dados em cache:', cachedData);
          callback(cachedData);
        }
      }
    };

    // Configurar listener principal
    console.log('[Sync] Configurando listener do Firestore');
    const unsubscribe = onSnapshot(
      query(
        collection(db, 'transactions'),
        where('userId', '==', userId)
      ),
      {
        next: async (snapshot) => {
          console.log('[Sync] Mudança detectada em transações:', snapshot.docChanges());
          
          if (!isActive || this.memoryWarning) return;

          // Limpar timeout anterior
          if (processingTimeout) {
            clearTimeout(processingTimeout);
          }

          // Agendar novo processamento
          processingTimeout = setTimeout(processQueue, 100);
        },
        error: (error) => {
          console.error('[Sync] Erro no listener:', error);
          
          // Se for erro de índice e ainda não atingimos o máximo de tentativas
          if (error instanceof Error && 
              error.message.includes('requires an index') && 
              retryCount < MAX_RETRIES) {
            console.log(`[Sync] Aguardando índice... Tentativa ${retryCount + 1} de ${MAX_RETRIES}`);
            retryCount++;
            
            // Agendar nova tentativa
            setTimeout(processQueue, RETRY_DELAY);
            return;
          }
          
          // Se não for erro de índice ou atingimos máximo de tentativas, usar cache
          const cachedData = this.getCachedData<Transaction[]>(`transactions-${userId}`);
          if (cachedData) {
            console.log('[Sync] Usando dados em cache:', cachedData);
            callback(cachedData);
          }
        }
      }
    );

    // Armazenar função de limpeza
    const cleanup = () => {
      console.log('[Sync] Limpando listener de transações');
      isActive = false;
      if (processingTimeout) {
        clearTimeout(processingTimeout);
      }
      unsubscribe();
      this.listeners.delete(listenerKey);
    };

    this.listeners.set(listenerKey, cleanup);
    
    // Processar imediatamente
    console.log('[Sync] Iniciando processamento inicial');
    processQueue();
    
    return cleanup;
  }

  setupCategoriesListener(userId: string, callback: (categories: Category[]) => void): Unsubscribe {
    console.log(`[Sync] Configurando listener de categorias para usuário ${userId}`);
    
    try {
      const categoriesRef = collection(db, 'categories');
      const userCategoriesQuery = query(
        categoriesRef,
        where('userId', '==', userId)
      );
      
      let categories: Category[] = [];
      
      // Flag para controlar se o listener ainda está ativo
      let isActive = true;
      
      const unsubscribe = onSnapshot(
        userCategoriesQuery,
        (snapshot) => {
          if (!isActive) {
            console.log('[Sync] Ignorando atualização de categorias - listener foi cancelado');
            return;
          }
          
          console.log(`[Sync] ${snapshot.docs.length} categorias recebidas`);
          
          categories = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              ...data,
              name: data.name || 'Sem nome',
              type: data.type || 'expense',
              color: data.color || '#CCCCCC',
              createdAt: data.createdAt instanceof Timestamp
                ? data.createdAt.toDate().toISOString()
                : data.createdAt,
              updatedAt: data.updatedAt instanceof Timestamp
                ? data.updatedAt.toDate().toISOString()
                : data.updatedAt
            } as Category;
          });
          
          console.log('[Sync] Categorias formatadas:', categories);
          
          callback(categories);
        },
        (error) => {
          console.error('[Sync] Erro no listener de categorias:', error);
        }
      );
      
      return () => {
        isActive = false;
        unsubscribe();
      };
    } catch (error) {
      console.error('[Sync] Erro ao configurar listener de categorias:', error);
      return () => {}; // Retornar uma função vazia em caso de erro
    }
  }

  // Cache Management
  private updateCache<T>(key: string, data: T) {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      version: this.version
    });
  }

  private getCachedData<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > SYNC_CONFIG.CACHE_DURATION) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  // Sincronização Offline
  public async syncOfflineData() {
    if (this.syncInProgress) return;
    this.syncInProgress = true;

    try {
      const idb = await this.initializeDB();
      const tx = idb.transaction(['sync_metadata', 'transactions'], 'readwrite');
      const store = tx.objectStore('transactions');
      const metadata = tx.objectStore('sync_metadata');

      const lastSync = await metadata.get('lastSync');
      const pendingTransactions = await store.getAll();

      if (pendingTransactions.length > 0) {
        const batch = writeBatch(db);
        let processed = 0;

        for (const transaction of pendingTransactions) {
          if (this.memoryWarning) break;

          const docRef = doc(db, 'transactions');
          batch.set(docRef, {
            ...transaction,
            syncedAt: serverTimestamp()
          });

          processed++;
          if (processed % SYNC_CONFIG.BATCH_SIZE === 0) {
            await batch.commit();
          }
        }

        if (processed % SYNC_CONFIG.BATCH_SIZE > 0) {
          await batch.commit();
        }

        await metadata.put({
          key: 'lastSync',
          timestamp: Date.now()
        });
      }
    } catch (error) {
      console.error('[EnhancedSync] Erro na sincronização offline:', error);
    } finally {
      this.syncInProgress = false;
    }
  }

  // Utilitários
  public async isOnline(): Promise<boolean> {
    return navigator.onLine && (await this.testFirestoreConnection());
  }

  private async testFirestoreConnection(): Promise<boolean> {
    try {
      await getDocs(query(collection(db, 'connectivity_test'), limit(1)));
      return true;
    } catch {
      return false;
    }
  }

  // Cleanup
  public destroy() {
    this.listeners.forEach(unsubscribe => unsubscribe());
    this.listeners.clear();
    this.cache.clear();
    this.syncInProgress = false;
  }

  // Adicionar método para transações
  async addTransaction(transactionData: any, userId: string): Promise<string> {
    console.log('[Sync] Adicionando nova transação:', transactionData);
    
    try {
      // Verificar conexão
      const isOnline = await this.isOnline();
      console.log('[Sync] Status da conexão:', isOnline ? 'Online' : 'Offline');
      
      if (!isOnline) {
        console.log('[Sync] Offline - Salvando transação localmente');
        const idb = await this.initializeDB();
        const tx = idb.transaction('transactions', 'readwrite');
        const store = tx.objectStore('transactions');
        
        const tempId = `temp-${Date.now()}`;
        const offlineData = {
          ...transactionData,
          id: tempId,
          userId,
          pending: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        
        console.log('[Sync] Salvando dados offline:', offlineData);
        await store.add(offlineData);
        
        return tempId;
      }
      
      // Se online, tentar adicionar diretamente ao Firestore
      console.log('[Sync] Online - Adicionando transação ao Firestore');
      const transactionsRef = collection(db, 'transactions');
      
      // Garantir que a data está no formato correto para o Firestore
      let formattedDate;
      if (typeof transactionData.date === 'string') {
        // Converter string para Date e depois para Timestamp
        const dateObj = new Date(transactionData.date);
        formattedDate = Timestamp.fromDate(dateObj);
      } else if (transactionData.date instanceof Date) {
        // Converter Date para Timestamp
        formattedDate = Timestamp.fromDate(transactionData.date);
      } else {
        // Data padrão como Timestamp
        formattedDate = Timestamp.fromDate(new Date());
      }
      
      const processedData = {
        ...transactionData,
        userId,
        date: formattedDate,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        pending: transactionData.pending !== undefined ? transactionData.pending : true,
        amount: Number(transactionData.amount) // Garantir que amount é número
      };
      
      console.log('[Sync] Dados processados para Firestore:', processedData);
      const docRef = await addDoc(transactionsRef, processedData);
      
      // Verificar se o documento foi realmente criado
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) {
        throw new Error('Falha ao criar documento no Firestore');
      }
      
      console.log('[Sync] Transação adicionada com sucesso:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('[Sync] Erro ao adicionar transação:', error);
      throw error;
    }
  }

  // Adicionar método para excluir transações
  async deleteTransaction(transactionId: string, userId: string): Promise<void> {
    console.log('[Sync] Tentando excluir transação:', transactionId);
    
    try {
      // Verificar conexão
      const isOnline = await this.isOnline();
      console.log('[Sync] Status da conexão:', isOnline ? 'Online' : 'Offline');
      
      if (!isOnline) {
        console.log('[Sync] Offline - Marcando transação para exclusão');
        const idb = await this.initializeDB();
        const tx = idb.transaction('transactions', 'readwrite');
        const store = tx.objectStore('transactions');
        
        // Marcar para exclusão quando voltar online
        await store.put({
          id: transactionId,
          deletedAt: new Date().toISOString(),
          pendingDeletion: true
        });
        
        return;
      }
      
      // Se online, excluir diretamente do Firestore
      console.log('[Sync] Online - Excluindo transação do Firestore');
      const transactionRef = doc(db, 'transactions', transactionId);
      
      // Verificar se o documento existe e pertence ao usuário
      const docSnap = await getDoc(transactionRef);
      if (!docSnap.exists()) {
        throw new Error('Transação não encontrada');
      }
      
      const transactionData = docSnap.data();
      if (transactionData.userId !== userId) {
        throw new Error('Permissão negada: Esta transação não pertence ao usuário');
      }
      
      // Excluir a transação
      await runTransaction(db, async (transaction) => {
        const docSnap = await transaction.get(transactionRef);
        if (!docSnap.exists()) {
          throw new Error('Transação não encontrada durante a exclusão');
        }
        
        transaction.delete(transactionRef);
      });
      
      console.log('[Sync] Transação excluída com sucesso:', transactionId);
    } catch (error) {
      console.error('[Sync] Erro ao excluir transação:', error);
      throw error;
    }
  }
}

// Exportar instância única
export const enhancedSyncService = new EnhancedSyncService(); 