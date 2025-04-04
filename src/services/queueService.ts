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
    // Verificar e garantir que os dados estão em formato válido
    if (operation.collection === 'transactions') {
      // Certificar que estes campos importantes existem
      if (!operation.data.accountId || !operation.data.userId || operation.data.amount === undefined) {
        console.error('Dados de transação inválidos:', operation.data);
        throw new Error('Dados incompletos para transação');
      }
      
      // Garantir que o campo tags seja sempre um array
      if (!operation.data.tags || !Array.isArray(operation.data.tags)) {
        operation.data.tags = [];
        console.log('Tags em formato inválido, definindo como array vazio');
      }
      
      // Garantir que a data esteja em formato correto
      if (operation.data.date) {
        try {
          // Se for string no formato YYYY-MM-DD
          if (typeof operation.data.date === 'string' && operation.data.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
            console.log('Data em formato válido (YYYY-MM-DD):', operation.data.date);
          } else {
            // Tentar interpretar a data e formatá-la
            const parsedDate = new Date(operation.data.date);
            if (isNaN(parsedDate.getTime())) {
              console.warn('Data inválida, definindo para hoje:', operation.data.date);
              operation.data.date = new Date().toISOString().split('T')[0];
            } else {
              operation.data.date = parsedDate.toISOString().split('T')[0];
            }
          }
        } catch (err) {
          console.warn('Erro ao processar data, definindo para hoje:', err);
          operation.data.date = new Date().toISOString().split('T')[0];
        }
      }
      
      // Garantir que amount é um número
      operation.data.amount = Number(operation.data.amount);
      
      console.log('Dados de transação validados e corrigidos:', operation.data);
    }
    
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
    
    // Verificar se é um erro de permissão do Firebase
    const isPermissionError = errorMessage.includes('permission') || 
                             errorMessage.includes('Permission') ||
                             errorMessage.includes('403');
    
    // Se o erro for de permissão ou se já tentou muitas vezes, remover a operação da fila
    if (isPermissionError || (operation.retryCount && operation.retryCount >= 3)) {
      console.warn(`Operação ${operation.id} será removida da fila após ${operation.retryCount} tentativas ou erro de permissão`);
      if (operation.id) {
        await db.delete(STORE_NAME, operation.id);
      }
      return false;
    }
    
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
  let successCount = 0;
  
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
        console.log(`Operação ${i + 1} ignorada após ${retryCount} tentativas.`);
        
        // Tentativa especial para consertar problemas específicos em transações
        if (op.type === 'create' && op.collection === 'transactions') {
          console.log('Tentando consertar operação de transação com possível problema em tags...');
          
          if (op.data && typeof op.data === 'object') {
            // Garantir que tags seja um array válido
            if (!op.data.tags || !Array.isArray(op.data.tags)) {
              op.data.tags = [];
              console.log('Tags corrigido para um array vazio');
            }
            
            // Verificar problemas com a data
            if (op.data.date && typeof op.data.date === 'string') {
              try {
                // Tentar converter para garantir que é uma data válida
                const dateObj = new Date(op.data.date);
                // Se chegou aqui, a data é válida. Formatá-la como YYYY-MM-DD
                op.data.date = dateObj.toISOString().split('T')[0];
                console.log(`Data corrigida para: ${op.data.date}`);
              } catch (e) {
                // Se falhar, usar a data atual
                op.data.date = new Date().toISOString().split('T')[0];
                console.log(`Data inválida substituída por: ${op.data.date}`);
              }
            }
            
            // Garantir que userId esteja presente e correto
            if (!op.data.userId || op.data.userId !== op.userId) {
              op.data.userId = op.userId;
              console.log(`UserId corrigido para: ${op.userId}`);
            }
            
            // Resetar a contagem de tentativas para tentar novamente
            op.retryCount = 0;
            
            // Atualizar a operação no banco
            await db.put(STORE_NAME, op);
            
            console.log('Operação de transação corrigida e reiniciada para nova tentativa');
            
            // Processar a operação corrigida imediatamente
            try {
              await processOperation(op, db);
              // Se chegou aqui, deu certo, então remover da fila
              await db.delete(STORE_NAME, op.id as number);
              
              successCount++;
              console.log(`Operação ${i + 1} processada com sucesso após correção!`);
            } catch (processingError: any) {
              console.error(`Falha ao processar operação corrigida:`, processingError);
              
              // Verificar se é um erro de permissão do Firestore
              if (String(processingError).includes('Missing or insufficient permissions')) {
                console.log('Detectado erro de permissão ao tentar processar a operação');
                
                // Esperar um tempo antes de tentar novamente 
                // (pode ser um problema temporário de autenticação)
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                try {
                  // Tentar processar novamente após aguardar
                  await processOperation(op, db);
                  
                  // Se chegou aqui, deu certo, então remover da fila
                  await db.delete(STORE_NAME, op.id as number);
                  
                  successCount++;
                  console.log(`Operação ${i + 1} processada com sucesso após aguardar!`);
                } catch (finalError) {
                  console.error('Falha definitiva após espera:', finalError);
                  
                  // Incrementar a contagem de tentativas
                  op.retryCount = (op.retryCount || 0) + 1;
                  await db.put(STORE_NAME, op);
                  
                  console.log(`Incrementada contagem de tentativas para ${op.retryCount}`);
                }
              }
            }
            
            continue; // Ir para a próxima operação
          }
        }
        
        // Se não tiver conseguido consertar, apenas ignorar
        await db.delete(STORE_NAME, op.id as number);
        continue;
      }
      
      try {
        await processOperation(op, db);
        
        // Remover da fila
        await db.delete(STORE_NAME, op.id as number);
        
        successCount++;
      } catch (error: any) {
        console.error(`Erro ao processar operação pendente (${op.collection}/${op.documentId}):`, error);
        
        // Verificar se é um erro de permissão do Firestore
        if (String(error).includes('Missing or insufficient permissions')) {
          console.log('Detectado erro de permissão. Verificando autenticação...');
          
          // Esperar um tempo antes de tentar novamente 
          // (pode ser um problema temporário de autenticação)
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          try {
            // Tentar processar novamente após aguardar
            await processOperation(op, db);
            
            // Se chegou aqui, deu certo, então remover da fila
            await db.delete(STORE_NAME, op.id as number);
            
            successCount++;
            console.log(`Operação ${i + 1} processada com sucesso após aguardar!`);
            continue;
          } catch (retryError) {
            console.error('Falha definitiva após espera:', retryError);
            // Continuar com o incremento de tentativas abaixo
          }
        }
        
        // Incrementar a contagem de tentativas
        op.retryCount = (op.retryCount || 0) + 1;
        op.lastError = error instanceof Error ? error.message : String(error);
        console.log(`Incrementada contagem de tentativas para ${op.retryCount}`);
        
        // Atualizar a operação no banco
        await db.put(STORE_NAME, op);
      }
    }
    
    console.log(`Processamento concluído. ${successCount} de ${pendingOps.length} operações processadas com sucesso.`);
    return successCount;
  } catch (error) {
    console.error('Erro ao processar fila de operações:', error);
    return successCount;
  } finally {
    // Não precisamos fechar o db com a lib idb, ela gerencia isso automaticamente
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

/**
 * Adiciona uma transação à fila de operações
 * @param transaction Dados da transação
 * @param userId ID do usuário
 * @returns ID da transação
 */
export const addTransaction = async (transaction: any, userId: string): Promise<string> => {
  const queueId = await addToQueue({
    type: 'create',
    collection: 'transactions',
    data: {
      ...transaction,
      userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    userId
  });
  
  return `temp-${queueId}`;
};

/**
 * Atualiza uma transação na fila de operações
 * @param id ID da transação
 * @param transaction Dados atualizados da transação
 * @param userId ID do usuário
 */
export const updateTransaction = async (id: string, transaction: any, userId: string): Promise<void> => {
  await addToQueue({
    type: 'update',
    collection: 'transactions',
    documentId: id,
    data: {
      ...transaction,
      updatedAt: new Date().toISOString()
    },
    userId
  });
};

/**
 * Remove uma transação da fila de operações
 * @param id ID da transação
 * @param userId ID do usuário
 */
export const deleteTransaction = async (id: string, userId: string): Promise<void> => {
  await addToQueue({
    type: 'delete',
    collection: 'transactions',
    documentId: id,
    data: {},
    userId
  });
}; 