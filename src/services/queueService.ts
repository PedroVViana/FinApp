import { openDB, IDBPDatabase } from 'idb';
import * as firestoreService from './firestore';
import { v4 as uuidv4 } from 'uuid';
import { Transaction } from '../types';

// Definir tipo para operações pendentes
interface PendingOperation {
  id?: number;
  type: 'create' | 'update' | 'delete';
  collection: string;
  documentId?: string;
  data: any;
  userId: string;
  timestamp: number;
  retryCount?: number;
  lastError?: string;
}

// Nome do banco IndexedDB
const DB_NAME = 'finapp-queue';
const STORE_NAME = 'pendingOperations';

// Inicializar banco de dados
let dbPromise: Promise<IDBPDatabase> | null = null;

/**
 * Inicializa o banco de dados IndexedDB para a fila de operações
 */
const initDatabase = async (): Promise<IDBPDatabase> => {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(db) {
        // Criar store de operações pendentes se não existir
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { 
            keyPath: 'id', 
            autoIncrement: true 
          });
          
          // Criar índice por coleção para facilitar consultas
          store.createIndex('by-collection', 'collection');
          
          // Criar índice por timestamp para processar em ordem
          store.createIndex('by-timestamp', 'timestamp');
        }
      }
    });
  }
  
  return dbPromise;
};

/**
 * Adicionar uma operação à fila de operações pendentes
 * @param operation Operação a ser enfileirada
 * @returns ID da operação na fila
 */
export const addToQueue = async (operation: Omit<PendingOperation, 'id' | 'timestamp' | 'retryCount'>): Promise<number> => {
  const db = await initDatabase();
  
  // Adicionar timestamp e contagem de tentativas
  const fullOperation: PendingOperation = {
    ...operation,
    timestamp: Date.now(),
    retryCount: 0
  };
  
  // Adicionar à fila e converter o ID para number
  const id = await db.add(STORE_NAME, fullOperation) as number;
  
  // Tentar processar a fila imediatamente se estiver online
  if (navigator.onLine) {
    processPendingQueue().catch(console.error);
  }
  
  return id;
};

/**
 * Remover uma operação da fila
 * @param id ID da operação
 */
export const removeFromQueue = async (id: number): Promise<void> => {
  const db = await initDatabase();
  await db.delete(STORE_NAME, id);
};

/**
 * Processar uma operação pendente específica
 * @param operation Operação a ser processada
 * @param db Banco de dados IndexedDB
 * @returns true se a operação foi processada com sucesso
 */
export const processOperation = async (operation: PendingOperation, db: IDBPDatabase): Promise<boolean> => {
  console.log(`Processando operação: ${operation.type} em ${operation.collection}`, 
    operation.documentId ? `ID: ${operation.documentId}` : '');
  
  try {
    switch (operation.type) {
      case 'create':
        switch (operation.collection) {
          case 'accounts':
            console.log('Criando conta no Firestore:', operation.data);
            await firestoreService.createAccount(operation.data, operation.userId);
            console.log('Conta criada com sucesso');
            break;
          case 'transactions':
            console.log('Criando transação no Firestore:', operation.data);
            await firestoreService.createTransaction(operation.data, operation.userId);
            console.log('Transação criada com sucesso');
            break;
          // Adicionar outros casos conforme necessário
          default:
            console.warn(`Tipo de coleção não suportado para criação: ${operation.collection}`);
            return false;
        }
        break;
        
      case 'update':
        if (!operation.documentId) {
          console.error('ID do documento ausente para operação de atualização');
          return false;
        }
        
        switch (operation.collection) {
          case 'accounts':
            console.log(`Atualizando conta ${operation.documentId}:`, operation.data);
            await firestoreService.updateAccount(operation.documentId, operation.data, operation.userId);
            console.log(`Conta ${operation.documentId} atualizada com sucesso`);
            break;
          case 'transactions':
            console.log(`Atualizando transação ${operation.documentId}:`, operation.data);
            await firestoreService.updateTransaction(operation.documentId, operation.data, operation.userId);
            console.log(`Transação ${operation.documentId} atualizada com sucesso`);
            break;
          // Adicionar outros casos conforme necessário
          default:
            console.warn(`Tipo de coleção não suportado para atualização: ${operation.collection}`);
            return false;
        }
        break;
        
      case 'delete':
        if (!operation.documentId) {
          console.error('ID do documento ausente para operação de exclusão');
          return false;
        }
        
        switch (operation.collection) {
          case 'accounts':
            console.log(`Excluindo conta ${operation.documentId}`);
            await firestoreService.deleteAccount(operation.documentId, operation.userId);
            console.log(`Conta ${operation.documentId} excluída com sucesso`);
            break;
          case 'transactions':
            console.log(`Excluindo transação ${operation.documentId}`);
            await firestoreService.deleteTransaction(operation.documentId, operation.userId);
            console.log(`Transação ${operation.documentId} excluída com sucesso`);
            break;
          // Adicionar outros casos conforme necessário
          default:
            console.warn(`Tipo de coleção não suportado para exclusão: ${operation.collection}`);
            return false;
        }
        break;
        
      default:
        console.warn(`Tipo de operação não suportado: ${operation.type}`);
        return false;
    }
    
    console.log(`Operação ${operation.id} processada com sucesso`);
    return true;
  } catch (error: any) {
    const errorMessage = error.message || 'Erro desconhecido';
    console.error(`Erro ao processar operação pendente (${operation.collection}/${operation.documentId}): ${errorMessage}`, error);
    
    // Incrementar contagem de tentativas
    if (operation.id) {
      const updatedOperation = { 
        ...operation, 
        retryCount: (operation.retryCount || 0) + 1,
        lastError: errorMessage
      };
      
      await db.put(STORE_NAME, updatedOperation);
      console.log(`Incrementada contagem de tentativas para ${updatedOperation.retryCount}`);
    }
    
    return false;
  }
};

/**
 * Processa a fila de operações pendentes
 * @returns Total de operações processadas com sucesso
 */
export const processPendingQueue = async (): Promise<number> => {
  if (!navigator.onLine) {
    console.log('Offline - processamento de fila adiado');
    return 0;
  }
  
  const db = await initDatabase();
  let sucessCount = 0;
  
  try {
    const pendingOps = await db.getAll(STORE_NAME);
    
    if (pendingOps.length === 0) {
      console.log('Nenhuma operação pendente para processar');
      return 0;
    }
    
    console.log('Processando', pendingOps.length, 'operações pendentes...');
    
    // Ordenar por timestamp para processar na ordem original
    pendingOps.sort((a, b) => a.timestamp - b.timestamp);
    
    for (let i = 0; i < pendingOps.length; i++) {
      const op = pendingOps[i];
      
      // Verificar número de tentativas
      const retryCount = op.retryCount || 0;
      
      if (retryCount >= 5) {
        console.warn(`Operação ${i + 1} ignorada após 5 tentativas.`);
        
        // MODIFICAÇÃO: Verificar se é uma operação 'create' para transactions e consertar o erro de tags undefined
        if (op.type === 'create' && op.collection === 'transactions') {
          console.log('Tentando consertar operação de transação com possível problema em tags...');
          
          // Consertar dados antes de tentar novamente
          if (op.data.tags === undefined) {
            op.data.tags = [];
            console.log('Campo tags undefined corrigido para array vazio');
          }
          
          // Remover campos undefined que possam causar problemas
          const dadosLimpos: Record<string, any> = {};
          Object.entries(op.data).forEach(([key, value]) => {
            if (value !== undefined) {
              dadosLimpos[key] = value;
            } else {
              console.log(`Removendo campo ${key} com valor undefined da operação`);
            }
          });
          
          op.data = dadosLimpos;
          
          // Resetar contagem de tentativas
          op.retryCount = 0;
          
          // Atualizar a operação no banco
          await db.put(STORE_NAME, op);
          console.log('Operação de transação corrigida e reiniciada para nova tentativa');
          
          // Tentar processar novamente nesta mesma execução
          try {
            await processOperation(op, db);
            sucessCount++;
            console.log(`Operação ${i + 1} processada com sucesso após correção!`);
          } catch (processingError) {
            console.error(`Falha ao processar operação corrigida: ${processingError}`);
          }
        } else {
          // Para outras operações, tentar limpar dados
          try {
            await db.delete(STORE_NAME, op.id as number);
            console.log(`Operação ${i + 1} removida da fila após 5 tentativas falhas.`);
          } catch (deleteError) {
            console.error(`Erro ao remover operação da fila: ${deleteError}`);
          }
        }
        continue;
      }
      
      try {
        await processOperation(op, db);
        sucessCount++;
      } catch (error) {
        console.error(`Erro ao processar operação pendente (${op.collection}/${op.documentId}):`, error);
        
        // Incrementar contagem de tentativas
        op.retryCount = retryCount + 1;
        op.lastError = error instanceof Error ? error.message : String(error);
        
        console.log(`Incrementada contagem de tentativas para ${op.retryCount}`);
        
        // Atualizar a operação no banco
        await db.put(STORE_NAME, op);
      }
    }
    
    console.log(`Processamento concluído. ${sucessCount} de ${pendingOps.length} operações processadas com sucesso.`);
    return sucessCount;
  } catch (error) {
    console.error('Erro ao processar fila de operações:', error);
    return sucessCount;
  } finally {
    db.close();
  }
};

/**
 * Configurar processamento automático da fila quando a conexão for restabelecida
 */
export const setupQueueProcessor = (): (() => void) => {
  const handleOnline = () => {
    console.log('Conexão restabelecida. Processando operações pendentes...');
    processPendingQueue()
      .then(count => {
        if (count > 0) {
          console.log(`${count} operações pendentes processadas com sucesso.`);
        }
      })
      .catch(console.error);
  };
  
  window.addEventListener('online', handleOnline);
  
  // Tentar processar ao inicializar, caso já esteja online
  if (navigator.onLine) {
    processPendingQueue().catch(console.error);
  }
  
  return () => {
    window.removeEventListener('online', handleOnline);
  };
};

/**
 * Obter o número de operações pendentes na fila
 * @returns Número de operações pendentes
 */
export const getPendingOperationsCount = async (): Promise<number> => {
  const db = await initDatabase();
  return await db.count(STORE_NAME);
};

// Expor função para adicionar conta ao Firestore com suporte para modo offline
export const addAccount = async (
  accountData: any,
  userId: string
): Promise<string> => {
  if (navigator.onLine) {
    // Se estiver online, tentar criar diretamente
    try {
      return await firestoreService.createAccount(accountData, userId);
    } catch (error) {
      console.error('Erro ao criar conta, adicionando à fila:', error);
      // Em caso de erro, adicionar à fila
      await addToQueue({
        type: 'create',
        collection: 'accounts',
        data: accountData,
        userId
      });
      // Retornar um ID temporário
      return `temp-${Date.now()}`;
    }
  } else {
    // Se estiver offline, adicionar à fila
    await addToQueue({
      type: 'create',
      collection: 'accounts',
      data: accountData,
      userId
    });
    return `temp-${Date.now()}`;
  }
};

// Expor função para adicionar transação ao Firestore com suporte para modo offline
export const addTransaction = async (
  transaction: Omit<Transaction, 'id'>, 
  userId: string
): Promise<string> => {
  console.log(`QueueService: Adicionando transação para usuário ${userId}`, transaction);

  // Verificar se userId está explicitamente definido no objeto transaction
  if (!transaction.userId) {
    console.log('QueueService: Garantindo userId no objeto de transação');
    transaction = { ...transaction, userId };
  }
  
  // Se estiver offline, adicionar à fila
  if (!navigator.onLine) {
    const queueId = await addToQueue({
      type: 'create',
      collection: 'transactions',
      data: transaction,
      userId
    });
    
    console.log(`QueueService: Offline - Transação adicionada à fila, ID temporário: temp-${queueId}`);
    return `temp-${queueId}`;
  }
  
  // Se online, tentar enviar diretamente ao Firestore
  try {
    console.log('QueueService: Online - Tentando adicionar transação diretamente ao Firestore');
    // Não descartar nenhum campo da transação - enviar como está
    const id = await firestoreService.createTransaction(transaction as any, userId);
    console.log(`QueueService: Transação criada no Firestore com ID: ${id}`);
    return id;
  } catch (error) {
    console.error('QueueService: Erro ao criar transação, adicionando à fila:', error);
    
    // Em caso de falha, adicionar à fila
    const queueId = await addToQueue({
      type: 'create',
      collection: 'transactions',
      data: transaction,
      userId
    });
    
    console.log(`QueueService: Erro - Transação adicionada à fila, ID temporário: temp-${queueId}`);
    return `temp-${queueId}`;
  }
}; 