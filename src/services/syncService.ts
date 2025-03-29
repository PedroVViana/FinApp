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
  connectFirestoreEmulator,
  enableIndexedDbPersistence,
  disableNetwork,
  enableNetwork,
  getFirestore
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { Account, Transaction, Category, Goal, DEFAULT_CATEGORIES } from '../types';

/**
 * Configurar listener para contas do usuário
 * @param userId ID do usuário
 * @param callback Função para receber novas contas
 * @returns Função para cancelar o listener
 */
export const setupAccountsListener = (userId: string, callback: (accounts: Account[]) => void): Unsubscribe => {
  console.log(`[Sync] Configurando listener de contas para usuário ${userId}`);
  
  try {
    const accountsQuery = query(
      collection(db, 'accounts'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    
    const unsubscribe = onSnapshot(
      accountsQuery,
      (snapshot) => {
        const accounts: Account[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          accounts.push({
            id: doc.id,
            ...data,
            // Converter Timestamp para string ISO se necessário
            createdAt: data.createdAt instanceof Timestamp 
              ? data.createdAt.toDate().toISOString()
              : data.createdAt,
            updatedAt: data.updatedAt instanceof Timestamp
              ? data.updatedAt.toDate().toISOString()
              : data.updatedAt
          } as Account);
        });
        
        console.log(`[Sync] ${accounts.length} contas atualizadas`);
        callback(accounts);
      },
      (error) => {
        console.error('[Sync] Erro no listener de contas:', error);
      }
    );
    
    return unsubscribe;
  } catch (error) {
    console.error('[Sync] Erro ao configurar listener de contas:', error);
    return () => {}; // Empty unsubscribe function
  }
};

/**
 * Configurar listener para transações de múltiplas contas
 * @param accountIds IDs das contas para monitorar
 * @param callback Função para receber novas transações
 * @returns Função para cancelar o listener
 */
export const setupTransactionsListener = (
  accountIds: string[],
  callback: (transactions: Transaction[]) => void
) => {
  console.log(`[Sync] Configurando listener de transações para ${accountIds.length} contas`);
  
  if (accountIds.length === 0) {
    console.warn('[Sync] Nenhuma conta fornecida para o listener de transações');
    return () => {};
  }
  
  // Devido às limitações do Firestore (não podemos usar where in com mais de 10 items),
  // dividimos em lotes menores
  const batchSize = 10;
  const batches: string[][] = [];
  
  for (let i = 0; i < accountIds.length; i += batchSize) {
    batches.push(accountIds.slice(i, i + batchSize));
  }
  
  console.log(`[Sync] Dividindo em ${batches.length} lotes para consultas de transações`);
  
  const unsubscribeFunctions: Array<() => void> = [];
  const allTransactions: Record<string, Transaction> = {};
  
  // Configurar listener para cada lote
  batches.forEach((batchAccountIds, index) => {
    try {
      console.log(`[Sync] Configurando listener para lote ${index + 1}/${batches.length}:`, batchAccountIds);
      
      const transactionsQuery = query(
        collection(db, 'transactions'),
        where('accountId', 'in', batchAccountIds),
        orderBy('date', 'desc')
      );
      
      const unsubscribe = onSnapshot(
        transactionsQuery,
        (snapshot) => {
          console.log(`[Sync] Lote ${index + 1}: ${snapshot.docs.length} transações recebidas`);
          
          if (snapshot.docs.length > 0) {
            // Adicionar logs para investigar
            const sample = snapshot.docs[0].data();
            console.log(`[Sync] Amostra de transação (id=${snapshot.docs[0].id}):`, {
              accountId: sample.accountId,
              userId: sample.userId,
              date: sample.date,
              amount: sample.amount,
              type: sample.type
            });
          }
          
          // Atualizar o objeto que contém todas as transações
          snapshot.forEach((doc) => {
            const data = doc.data();
            
            // MODIFICAÇÃO: Verificar se o documento tem os campos essenciais
            if (!data.accountId || !data.date) {
              console.warn(`[Sync] Transação ${doc.id} com dados incompletos:`, data);
              return; // Pular esta transação
            }
            
            // Converter Timestamp para string ISO
            const dateISO = data.date instanceof Timestamp
              ? data.date.toDate().toISOString()
              : data.date;
            
            const createdAtISO = data.createdAt instanceof Timestamp
              ? data.createdAt.toDate().toISOString()
              : data.createdAt;
            
            const updatedAtISO = data.updatedAt instanceof Timestamp
              ? data.updatedAt.toDate().toISOString()
              : data.updatedAt;
            
            allTransactions[doc.id] = {
              id: doc.id,
              ...data,
              date: dateISO,
              createdAt: createdAtISO || new Date().toISOString(),
              updatedAt: updatedAtISO || new Date().toISOString()
            } as Transaction;
          });
          
          // Enviar todas as transações para o callback
          const transactions = Object.values(allTransactions);
          console.log(`[Sync] Total de transações combinadas: ${transactions.length}`);
          
          // Adicionar log para analisar userId das transações
          const userIds = [...new Set(transactions.map(t => t.userId))];
          console.log(`[Sync] UserIds das transações: ${userIds.join(', ')}`);
          
          callback(transactions);
        },
        (error) => {
          console.error(`[Sync] Erro no listener de transações (lote ${index + 1}):`, error);
        }
      );
      
      unsubscribeFunctions.push(unsubscribe);
    } catch (error) {
      console.error(`[Sync] Erro ao configurar listener para lote ${index + 1}:`, error);
    }
  });
  
  // Retornar função para cancelar todos os listeners
  return () => {
    console.log('[Sync] Cancelando todos os listeners de transações');
    unsubscribeFunctions.forEach(unsubscribe => unsubscribe());
  };
};

/**
 * Configurar listener para categorias personalizadas do usuário
 * @param userId ID do usuário
 * @param callback Função para receber novas categorias
 * @returns Função para cancelar o listener
 */
export const setupCategoriesListener = (userId: string, callback: (categories: Category[]) => void): Unsubscribe => {
  console.log(`[Sync] Configurando listener de categorias para usuário ${userId}`);
  
  try {
    // Adicionar log para mostrar as categorias padrão
    console.log('[Sync] Categorias padrão:', DEFAULT_CATEGORIES);
    
    // Consulta para categorias do usuário
    const categoriesQuery = query(
      collection(db, 'categories'),
      where('userId', '==', userId)
    );
    
    const unsubscribe = onSnapshot(
      categoriesQuery,
      (snapshot) => {
        // Obter categorias customizadas do usuário
        const userCategories: Category[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          userCategories.push({
            id: doc.id,
            ...data,
            createdAt: data.createdAt instanceof Timestamp
              ? data.createdAt.toDate().toISOString()
              : data.createdAt,
            updatedAt: data.updatedAt instanceof Timestamp
              ? data.updatedAt.toDate().toISOString()
              : data.updatedAt
          } as Category);
        });
        
        console.log('[Sync] Categorias personalizadas do usuário:', userCategories);
        
        // Adicionar categorias padrão com IDs fixos
        const defaultCategories = DEFAULT_CATEGORIES.map((cat, index) => ({
          id: `default-${index}`,
          ...cat,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }));
        
        console.log('[Sync] Categorias padrão formatadas:', defaultCategories);
        
        // Combinar categorias padrão e do usuário
        const allCategories = [...defaultCategories, ...userCategories];
        console.log(`[Sync] ${allCategories.length} categorias atualizadas (${defaultCategories.length} padrão, ${userCategories.length} personalizadas)`);
        console.log('[Sync] Todas as categorias:', allCategories);
        
        callback(allCategories);
      },
      (error) => {
        console.error('[Sync] Erro no listener de categorias:', error);
      }
    );
    
    return unsubscribe;
  } catch (error) {
    console.error('[Sync] Erro ao configurar listener de categorias:', error);
    return () => {}; // Empty unsubscribe function
  }
};

/**
 * Configurar listener para metas financeiras do usuário
 * @param userId ID do usuário
 * @param callback Função para receber novas metas
 * @returns Função para cancelar o listener
 */
export const setupGoalsListener = (userId: string, callback: (goals: Goal[]) => void): Unsubscribe => {
  console.log(`[Sync] Configurando listener de metas para usuário ${userId}`);
  
  try {
    const goalsQuery = query(
      collection(db, 'goals'),
      where('userId', '==', userId),
      orderBy('deadline', 'asc')
    );
    
    const unsubscribe = onSnapshot(
      goalsQuery,
      (snapshot) => {
        const goals: Goal[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          goals.push({
            id: doc.id,
            ...data,
            deadline: data.deadline instanceof Timestamp
              ? data.deadline.toDate().toISOString()
              : data.deadline,
            createdAt: data.createdAt instanceof Timestamp
              ? data.createdAt.toDate().toISOString()
              : data.createdAt,
            updatedAt: data.updatedAt instanceof Timestamp
              ? data.updatedAt.toDate().toISOString()
              : data.updatedAt
          } as Goal);
        });
        
        console.log(`[Sync] ${goals.length} metas atualizadas`);
        callback(goals);
      },
      (error) => {
        console.error('[Sync] Erro no listener de metas:', error);
      }
    );
    
    return unsubscribe;
  } catch (error) {
    console.error('[Sync] Erro ao configurar listener de metas:', error);
    return () => {}; // Empty unsubscribe function
  }
};

/**
 * Realizar uma atualização em lote de documentos no Firestore
 * @param updates Array de objetos com refs e dados para atualização
 */
export const performBatchUpdate = async (
  updates: {
    collection: string;
    documentId: string;
    data: any;
  }[]
) => {
  if (updates.length === 0) return;
  
  console.log(`[Sync] Realizando atualização em lote de ${updates.length} documentos`);
  
  try {
    const batch = writeBatch(db);
    
    updates.forEach(update => {
      const docRef = doc(db, update.collection, update.documentId);
      batch.update(docRef, { ...update.data, updatedAt: serverTimestamp() });
    });
    
    await batch.commit();
    console.log('[Sync] Atualização em lote concluída com sucesso');
  } catch (error) {
    console.error('[Sync] Erro na atualização em lote:', error);
    throw error;
  }
};

/**
 * Atualizar uma transação com resolução de conflitos
 * @param transactionId ID da transação
 * @param transactionData Novos dados
 * @param userId ID do usuário (para verificar permissão)
 */
export const updateTransactionWithConflictResolution = async (
  transactionId: string,
  transactionData: any,
  userId: string
) => {
  console.log(`[Sync] Atualizando transação ${transactionId} com resolução de conflitos`);
  
  try {
    await runTransaction(db, async (transaction) => {
      // Obter a versão atual da transação
      const transactionRef = doc(db, 'transactions', transactionId);
      const transactionDoc = await transaction.get(transactionRef);
      
      if (!transactionDoc.exists()) {
        throw new Error('Transação não encontrada');
      }
      
      const currentData = transactionDoc.data();
      
      // Verificar permissão
      if (currentData.userId !== userId) {
        throw new Error('Sem permissão para modificar esta transação');
      }
      
      // Se a transação tem um campo 'version', incrementá-lo
      // Isso ajuda a rastrear atualizações
      const newVersion = (currentData.version || 0) + 1;
      
      // Mesclar dados atuais com novos dados
      const updatedData = {
        ...transactionData,
        version: newVersion,
        updatedAt: serverTimestamp()
      };
      
      // Atualizar a transação
      transaction.update(transactionRef, updatedData);
    });
    
    console.log(`[Sync] Transação ${transactionId} atualizada com sucesso`);
  } catch (error) {
    console.error(`[Sync] Erro ao atualizar transação ${transactionId}:`, error);
    throw error;
  }
};

/**
 * Verificar status da conexão com Firestore
 * @param callback Função que recebe o status atual
 * @returns Função para cancelar o listener
 */
export const monitorConnectionStatus = (
  callback: (status: 'online' | 'offline') => void
): Unsubscribe => {
  // Obter status da conexão atual
  const status = navigator.onLine ? 'online' : 'offline';
  callback(status);
  
  // Monitorar mudanças no status
  const handleOnline = () => {
    console.log('[Sync] Conexão de rede restaurada');
    callback('online');
    enableNetwork(db);
  };
  
  const handleOffline = () => {
    console.log('[Sync] Conexão de rede perdida');
    callback('offline');
  };
  
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}; 