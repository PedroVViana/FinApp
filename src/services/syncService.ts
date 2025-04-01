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
  getFirestore,
  QuerySnapshot,
  DocumentData,
  QueryDocumentSnapshot
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
    
    // Flag para controlar se o listener ainda está ativo
    let isActive = true;
    
    const unsubscribe = onSnapshot(
      accountsQuery,
      (snapshot) => {
        // Verificar se o listener ainda está ativo
        if (!isActive) {
          console.log('[Sync] Ignorando atualização de contas - listener foi cancelado');
          return;
        }
        
        const accounts: Account[] = [];
        snapshot.forEach((doc: QueryDocumentSnapshot<DocumentData>) => {
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
    
    // Retornar função de limpeza aprimorada
    return () => {
      console.log('[Sync] Cancelando listener de contas');
      isActive = false;
      try {
        unsubscribe();
        console.log('[Sync] Listener de contas cancelado com sucesso');
      } catch (error) {
        console.error('[Sync] Erro ao cancelar listener de contas:', error);
      }
    };
  } catch (error) {
    console.error('[Sync] Erro ao configurar listener de contas:', error);
    return () => {
      console.log('[Sync] Executando função de limpeza vazia para contas (configuração falhou)');
    };
  }
};

/**
 * Função utilitária para criar listeners mais robustos
 * @param snapshotCallback Função para processar dados recebidos
 * @param transformer Função para transformar dados recebidos
 * @param errorCallback Função para processar erros
 * @returns Objeto com safeCallback e unsubscribe
 */
export function createSafeListener<T, R>(
  snapshotCallback: (data: T) => void, 
  transformer?: (snapshot: T) => R,
  errorCallback?: (error: Error) => void
) {
  let isActive = true;

  const safeCallback = (data: T) => {
    if (isActive) {
      try {
        snapshotCallback(data);
      } catch (err) {
        console.error('[Sync] Erro no callback do listener:', err);
        if (errorCallback) {
          errorCallback(err as Error);
        }
      }
    }
  };

  const unsubscribe = () => {
    isActive = false;
  };

  return { safeCallback, unsubscribe };
}

/**
 * Configurar listener para transações de múltiplas contas
 * @param accountIds IDs das contas para monitorar
 * @param callback Função para receber novas transações
 * @returns Função para cancelar o listener
 */
export function setupTransactionsListener(
  accountIds: string[], 
  callback: (transactions: Transaction[]) => void
): Unsubscribe {
  // Se não houver contas, retorne uma função vazia
  if (!accountIds || accountIds.length === 0) {
    console.log('[Sync] Sem contas para configurar listener de transações');
    return () => {
      console.log('[Sync] Função de limpeza vazia executada para listener sem contas');
    };
  }

  try {
    console.log('[Sync] Configurando listener de transações para', accountIds.length, 'contas');
    
    // Referência para armazenar transações combinadas - será liberada na limpeza
    let allTransactions: Record<string, Transaction> = {};
    
    // Flag para controlar se o listener ainda está ativo
    let isActive = true;
    
    // Flag para monitorar se estamos em meio a uma transição de página 
    let isInPageTransition = false;
    
    // Cache da última vez que atualizamos para evitar atualizações muito frequentes
    let lastUpdateTime = 0;
    const MIN_UPDATE_INTERVAL = 300; // Aumentar para 300ms
    
    // Função para processar resultados finais com throttling
    const processResults = () => {
      // Pular processamento se o listener não estiver mais ativo
      if (!isActive) return;
      
      // Se estivermos em transição de página, pular atualizações para não travar a UI
      if (isInPageTransition) {
        console.log('[Sync] Pulando processamento durante transição de página');
        return;
      }
      
      const now = Date.now();
      // Verificar se já passou o tempo mínimo desde a última atualização
      if (now - lastUpdateTime < MIN_UPDATE_INTERVAL) {
        return;
      }
      
      lastUpdateTime = now;
      
      // Usar requestIdleCallback se disponível para processar apenas quando o navegador estiver ocioso
      const processTransactions = () => {
        if (!isActive) return; // Verificar novamente
        
        const transactions = Object.values(allTransactions);
        console.log(`[Sync] Total de transações combinadas: ${transactions.length}`);
        
        // Adicionar log para analisar userId das transações
        if (transactions.length > 0) {
          const userIds = [...new Set(transactions.map(t => t.userId))];
          console.log(`[Sync] UserIds das transações: ${userIds.join(', ')}`);
        }
        
        // Verificar novamente se o listener está ativo antes de chamar o callback
        if (isActive && !isInPageTransition) {
          callback(transactions);
        }
      };
      
      // Usar requestIdleCallback para processar quando o navegador estiver ocioso
      if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        (window as any).requestIdleCallback(processTransactions, { timeout: 1000 });
      } else {
        // Fallback para setTimeout se requestIdleCallback não estiver disponível
        setTimeout(processTransactions, 50);
      }
    };
    
    // Escutar eventos de transição de página
    const handleVisibilityChange = () => {
      isInPageTransition = document.hidden;
      if (document.hidden) {
        console.log('[Sync] Documento oculto, pausando processamento');
      } else {
        console.log('[Sync] Documento visível, retomando após delay');
        // Não retomar imediatamente
        setTimeout(() => {
          if (isActive) {
            isInPageTransition = false;
            // Processar resultados depois de um delay após a visibilidade retornar
            processResults();
          }
        }, 500);
      }
    };
    
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }
    
    // Batchify com lotes menores e mais incrementais
    const batchSize = 3; // Reduzir ainda mais para diminuir a carga por batch
    const batches: string[][] = [];
    
    for (let i = 0; i < accountIds.length; i += batchSize) {
      batches.push(accountIds.slice(i, i + batchSize));
    }
    
    console.log(`[Sync] Dividindo em ${batches.length} lotes menores para consultas de transações`);
    
    // Array para armazenar todas as funções de unsubscribe
    const unsubscribeFunctions: Unsubscribe[] = [];
    
    // Configurar listener para cada lote com delay progressivo
    // Lotes prioritários primeiro (menos delay), lotes não-prioritários depois
    let batchDelay = 0;
    const BATCH_DELAY_INTERVAL = 250; // Aumentar para 250ms para mais dispersão
    
    // Primeiro, criar e executar os listeners um a um com delay incremental
    batches.forEach((batchAccountIds, index) => {
      // Usar setTimeout para escalonar a inicialização dos listeners
      const timeoutId = setTimeout(() => {
        if (!isActive) return; // Não configurar se já estiver inativo
        
        try {
          console.log(`[Sync] Configurando listener para lote ${index + 1}/${batches.length}:`, batchAccountIds);
          
          const transactionsQuery = query(
            collection(db, 'transactions'),
            where('accountId', 'in', batchAccountIds),
            orderBy('date', 'desc'),
            // Adicionar limite superior para cada consulta
            limit(100) // Limitar cada consulta a 100 transações no máximo
          );
          
          // Criar o listener diretamente com onSnapshot
          const batchUnsubscribe = onSnapshot(
            transactionsQuery,
            {
              includeMetadataChanges: false // Não incluir metadados para reduzir payload
            },
            (snapshot: QuerySnapshot<DocumentData>) => {
              // Verificar se o listener ainda está ativo antes de processar
              if (!isActive) {
                console.log(`[Sync] Ignorando atualização do lote ${index + 1} - listener foi cancelado`);
                return;
              }
              
              // Pular processamento se estivermos em transição de página
              if (isInPageTransition) {
                console.log(`[Sync] Adiando processamento do lote ${index + 1} durante transição`);
                return;
              }
              
              const docsCount = snapshot.docs.length;
              console.log(`[Sync] Lote ${index + 1}: ${docsCount} transações recebidas`);
              
              if (docsCount > 0) {
                // Adicionar logs para investigar (apenas a primeira para economizar logs)
                const sample = snapshot.docs[0].data();
                console.log(`[Sync] Amostra de transação (id=${snapshot.docs[0].id}):`, {
                  accountId: sample.accountId,
                  userId: sample.userId,
                  date: sample.date,
                  // Omitir detalhes para reduzir tamanho do log
                });
              }
              
              // Processar documentos em batches para não bloquear a UI
              const processBatch = (start: number, batchLimit: number) => {
                if (!isActive || isInPageTransition) return;
                
                const end = Math.min(start + batchLimit, docsCount);
                console.log(`[Sync] Processando documentos ${start} a ${end} do lote ${index + 1}`);
                
                for (let i = start; i < end; i++) {
                  const doc = snapshot.docs[i];
                  const data = doc.data();
                  
                  // Verificar se o documento tem os campos essenciais
                  if (!data.accountId || !data.date) {
                    console.warn(`[Sync] Transação ${doc.id} com dados incompletos:`, data);
                    continue;
                  }
                  
                  allTransactions[doc.id] = {
                    id: doc.id,
                    ...data,
                    // Converter Timestamp para string ISO se necessário
                    date: data.date instanceof Timestamp 
                      ? data.date.toDate().toISOString()
                      : data.date,
                    createdAt: data.createdAt instanceof Timestamp 
                      ? data.createdAt.toDate().toISOString()
                      : data.createdAt,
                    updatedAt: data.updatedAt instanceof Timestamp
                      ? data.updatedAt.toDate().toISOString()
                      : data.updatedAt
                  } as Transaction;
                }
                
                // Continuar processando ou finalizar
                if (end < docsCount) {
                  setTimeout(() => processBatch(end, batchLimit), 10);
                } else {
                  // Processar resultados após cada atualização completa
                  processResults();
                }
              };
              
              // Iniciar processamento do batch com 20 documentos por vez
              if (docsCount > 0) {
                processBatch(0, 20);
              } else {
                // Se não há documentos, ainda precisamos processar para atualizar o estado
                processResults();
              }
            },
            (error) => {
              console.error(`[Sync] Erro no listener de transações (lote ${index + 1}):`, error);
            }
          );
          
          // Adicionar a função unsubscribe ao array
          unsubscribeFunctions.push(batchUnsubscribe);
          
        } catch (error) {
          console.error(`[Sync] Erro ao configurar listener para lote ${index + 1}:`, error);
        }
      }, batchDelay);
      
      // Aumentar o delay para cada batch subsequente
      batchDelay += BATCH_DELAY_INTERVAL;
    });
    
    // Retornar uma função que apenas desinscreve os listeners sem limpar o estado
    return () => {
      console.log('[Sync] Cancelando listeners de transações');
      
      // Marcar como inativo para evitar processamento de atualizações pendentes
      isActive = false;
      isInPageTransition = true; // Prevenir qualquer processamento
      
      // Remover listener de visibilidade
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
      
      // Cancelar todos os listeners sem limpar o estado dos dados
      unsubscribeFunctions.forEach((unsubscribe, index) => {
        try {
          console.log(`[Sync] Cancelando listener do lote ${index + 1}/${unsubscribeFunctions.length}`);
          unsubscribe();
        } catch (e) {
          console.error(`[Sync] Erro ao cancelar listener do lote ${index + 1}:`, e);
        }
      });
      
      console.log('[Sync] Todos os listeners de transações foram cancelados');
    };
    
  } catch (error) {
    console.error('[Sync] Erro ao configurar listeners de transações:', error);
    return () => {
      console.log('[Sync] Executando função de limpeza vazia devido a erro na configuração');
    };
  }
}

/**
 * Configurar listener para categorias do usuário
 * @param userId ID do usuário
 * @param callback Função para receber novas categorias
 * @returns Função para cancelar o listener
 */
export const setupCategoriesListener = (userId: string, callback: (categories: Category[]) => void): Unsubscribe => {
  console.log(`[Sync] Configurando listener de categorias para usuário ${userId}`);
  
  try {
    const defaultCategoriesQuery = query(
      collection(db, 'categories'),
      where('isDefault', '==', true)
    );
    
    const userCategoriesQuery = query(
      collection(db, 'categories'),
      where('userId', '==', userId),
      where('isDefault', '==', false)
    );
    
    let defaultCategories: Category[] = [];
    let userCategories: Category[] = [];
    
    // Flag para controlar se o listener ainda está ativo
    let isActive = true;
    
    // Array para armazenar funções de unsubscribe
    const unsubscribeFunctions: Unsubscribe[] = [];
    
    // Função auxiliar para processar os resultados combinados
    const processCombinedResults = () => {
      if (!isActive) return;
      
      const allCategories = [...defaultCategories, ...userCategories];
      console.log(`[Sync] ${allCategories.length} categorias atualizadas (${defaultCategories.length} padrão, ${userCategories.length} personalizadas)`);
      
      callback(allCategories);
    };
    
    // Listener para categorias padrão (do sistema)
    const defaultUnsubscribe = onSnapshot(
      defaultCategoriesQuery,
      (snapshot) => {
        if (!isActive) {
          console.log('[Sync] Ignorando atualização de categorias padrão - listener foi cancelado');
          return;
        }
        
        console.log(`[Sync] ${snapshot.docs.length} categorias padrão recebidas`);
        
        defaultCategories = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            name: data.name || 'Sem nome',
            type: data.type || 'expense',
            color: data.color || '#CCCCCC',
            isDefault: true,
            createdAt: data.createdAt instanceof Timestamp
              ? data.createdAt.toDate().toISOString()
              : data.createdAt,
            updatedAt: data.updatedAt instanceof Timestamp
              ? data.updatedAt.toDate().toISOString()
              : data.updatedAt
          } as Category;
        });
        
        console.log('[Sync] Categorias padrão formatadas:', defaultCategories);
        
        // Processar resultados combinados
        processCombinedResults();
      },
      (error) => {
        console.error('[Sync] Erro no listener de categorias padrão:', error);
      }
    );
    
    unsubscribeFunctions.push(defaultUnsubscribe);
    
    // Listener para categorias do usuário
    const userUnsubscribe = onSnapshot(
      userCategoriesQuery,
      (snapshot) => {
        if (!isActive) {
          console.log('[Sync] Ignorando atualização de categorias do usuário - listener foi cancelado');
          return;
        }
        
        console.log(`[Sync] ${snapshot.docs.length} categorias do usuário recebidas`);
        
        userCategories = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            name: data.name || 'Sem nome',
            type: data.type || 'expense',
            color: data.color || '#CCCCCC',
            isDefault: false,
            createdAt: data.createdAt instanceof Timestamp
              ? data.createdAt.toDate().toISOString()
              : data.createdAt,
            updatedAt: data.updatedAt instanceof Timestamp
              ? data.updatedAt.toDate().toISOString()
              : data.updatedAt
          } as Category;
        });
        
        console.log('[Sync] Categorias do usuário formatadas:', userCategories);
        
        // Processar resultados combinados
        processCombinedResults();
      },
      (error) => {
        console.error('[Sync] Erro no listener de categorias do usuário:', error);
      }
    );
    
    unsubscribeFunctions.push(userUnsubscribe);
    
    // Retornar função para cancelar todos os listeners
    return () => {
      console.log('[Sync] Cancelando TODOS os listeners de categorias');
      
      // Marcar como inativo para evitar processamento de atualizações pendentes
      isActive = false;
      
      // Limpar arrays para liberar memória
      defaultCategories = [];
      userCategories = [];
      
      // Cancelar cada listener
      unsubscribeFunctions.forEach((unsubscribe, index) => {
        try {
          console.log(`[Sync] Cancelando listener de categorias ${index + 1}/${unsubscribeFunctions.length}`);
          unsubscribe();
        } catch (e) {
          console.error(`[Sync] Erro ao cancelar listener de categorias ${index + 1}:`, e);
        }
      });
      
      console.log('[Sync] Todos os listeners de categorias foram cancelados');
    };
    
  } catch (error) {
    console.error('[Sync] Erro ao configurar listener de categorias:', error);
    return () => {
      console.log('[Sync] Executando função de limpeza vazia para categorias (configuração falhou)');
    };
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
    
    // Flag para controlar se o listener ainda está ativo
    let isActive = true;
    
    const unsubscribe = onSnapshot(
      goalsQuery,
      (snapshot: QuerySnapshot<DocumentData>) => {
        if (!isActive) {
          console.log('[Sync] Ignorando atualização de metas - listener foi cancelado');
          return;
        }
        
        const goals: Goal[] = [];
        snapshot.forEach((doc: QueryDocumentSnapshot<DocumentData>) => {
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
    
    // Retornar função de limpeza aprimorada
    return () => {
      console.log('[Sync] Cancelando listener de metas');
      
      // Marcar como inativo
      isActive = false;
      
      try {
        unsubscribe();
        console.log('[Sync] Listener de metas cancelado com sucesso');
      } catch (e) {
        console.error('[Sync] Erro ao cancelar listener de metas:', e);
      }
    };
  } catch (error) {
    console.error('[Sync] Erro ao configurar listener de metas:', error);
    return () => {
      console.log('[Sync] Executando função de limpeza vazia para metas (configuração falhou)');
    };
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

// Adicionar evento personalizado para navegação
export const notifyNavigationStart = () => {
  console.log('Notificando início de navegação para outros componentes');
  window.dispatchEvent(new CustomEvent('navigationStart'));
};

export const notifyNavigationEnd = () => {
  console.log('Notificando fim de navegação para outros componentes');
  window.dispatchEvent(new CustomEvent('navigationEnd'));
};

// Evento global para interromper processamento durante navegação
let isNavigating = false;

// Configurar ouvintes para eventos de navegação
window.addEventListener('navigationStart', () => {
  console.log('syncService: Navegação iniciada, interrompendo atualizações pesadas');
  isNavigating = true;
});

window.addEventListener('navigationEnd', () => {
  console.log('syncService: Navegação concluída, retomando atualizações');
  isNavigating = false;
});

// Função auxiliar para verificar se é seguro processar atualizações
export const isSafeToUpdate = (): boolean => {
  return !isNavigating && !document.hidden;
}; 