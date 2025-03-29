import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useAuth } from './AuthContext';
import * as firestoreService from '../services/firestore';
import * as syncService from '../services/syncService';
import * as queueService from '../services/queueService';
import { Account, Transaction, Category, Goal, Filter } from '../types';
import { useNotification } from '../components/Notification';

interface FinanceContextType {
  accounts: Account[];
  transactions: Transaction[];
  categories: Category[];
  goals: Goal[];
  filters: Filter[];
  isLoading: boolean;
  error: string | null;
  isOffline: boolean;
  pendingOperationsCount: number;
  addAccount: (account: Omit<Account, 'id'>) => Promise<string>;
  updateAccount: (id: string, account: Partial<Account>) => Promise<void>;
  deleteAccount: (id: string) => Promise<void>;
  addTransaction: (transaction: Omit<Transaction, 'id'>) => Promise<string>;
  updateTransaction: (id: string, transaction: Partial<Transaction>) => Promise<void>;
  deleteTransaction: (id: string) => Promise<void>;
  addCategory: (category: Omit<Category, 'id'>) => Promise<string>;
  updateCategory: (id: string, category: Partial<Category>) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  addGoal: (goal: Omit<Goal, 'id'>) => Promise<string>;
  updateGoal: (id: string, goal: Partial<Goal>) => Promise<void>;
  deleteGoal: (id: string) => Promise<void>;
  addFilter: (filter: Omit<Filter, 'id'>) => Promise<string>;
  updateFilter: (id: string, filter: Partial<Filter>) => Promise<void>;
  deleteFilter: (id: string) => Promise<void>;
  processPendingOperations: () => Promise<number>;
}

const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

export const useFinance = () => {
  const context = useContext(FinanceContext);
  if (!context) {
    throw new Error('useFinance deve ser usado dentro de um FinanceProvider');
  }
  return context;
};

export const FinanceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { currentUser: user } = useAuth();
  const { success, error, info } = useNotification();
  
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [filters, setFilters] = useState<Filter[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState<boolean>(!navigator.onLine);
  const [pendingOperationsCount, setPendingOperationsCount] = useState<number>(0);
  
  // Função para atualizar o número de operações pendentes
  const updatePendingCount = async () => {
    if (user) {
      const count = await queueService.getPendingOperationsCount();
      setPendingOperationsCount(count);
    }
  };
  
  // Monitorar status de conexão
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      queueService.processPendingQueue()
        .then(count => {
          if (count > 0) {
            console.log(`${count} operações pendentes processadas com sucesso.`);
          }
          updatePendingCount();
        })
        .catch(console.error);
    };
    
    const handleOffline = () => {
      setIsOffline(true);
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Configurar o processador de fila
    const unsubscribeQueue = queueService.setupQueueProcessor();
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribeQueue();
    };
  }, []);
  
  // Configurar listeners quando o usuário autenticar
  useEffect(() => {
    if (!user) {
      setAccounts([]);
      setTransactions([]);
      setCategories([]);
      setGoals([]);
      setFilters([]);
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    // Array para armazenar funções de limpeza dos listeners
    const unsubscribes: (() => void)[] = [];
    
    try {
      // Configurar listener para contas
      const unsubscribeAccounts = syncService.setupAccountsListener(
        user.uid,
        (updatedAccounts) => {
          setAccounts(updatedAccounts);
        }
      );
      unsubscribes.push(unsubscribeAccounts);
      
      // Configurar listener para categorias
      const unsubscribeCategories = syncService.setupCategoriesListener(
        user.uid,
        (updatedCategories) => {
          setCategories(updatedCategories);
        }
      );
      unsubscribes.push(unsubscribeCategories);
      
      // Configurar listener para metas
      const unsubscribeGoals = syncService.setupGoalsListener(
        user.uid,
        (updatedGoals) => {
          setGoals(updatedGoals);
        }
      );
      unsubscribes.push(unsubscribeGoals);
      
      // Monitorar status de conexão
      const unsubscribeConnection = syncService.monitorConnectionStatus(
        (status) => {
          setIsOffline(status === 'offline');
        }
      );
      unsubscribes.push(unsubscribeConnection);
      
      // Atualizar contador de operações pendentes
      updatePendingCount();
      
    } catch (err) {
      console.error('Erro ao configurar listeners:', err);
      setError('Falha ao carregar dados financeiros.');
    } finally {
      setIsLoading(false);
    }
    
    // Cleanup function
    return () => {
      unsubscribes.forEach(unsubscribe => unsubscribe());
    };
  }, [user]);
  
  // Efeito especial para transações que depende das contas
  useEffect(() => {
    if (!user || accounts.length === 0) {
      return;
    }
    
    const accountIds = accounts.map(account => account.id);
    
    console.log('Configurando listener para transações de', accountIds.length, 'contas', accountIds);
    
    const unsubscribeTransactions = syncService.setupTransactionsListener(
      accountIds,
      (updatedTransactions) => {
        console.log('Recebidas', updatedTransactions.length, 'transações atualizadas');
        
        // MODIFICAÇÃO: Filtrar apenas transações do usuário atual
        const userTransactions = updatedTransactions.filter(t => t.userId === user.uid);
        
        if (userTransactions.length !== updatedTransactions.length) {
          console.warn(`Filtradas ${updatedTransactions.length - userTransactions.length} transações de outros usuários`);
        }
        
        setTransactions(prevTransactions => {
          // Identificar transações pendentes locais que não foram sincronizadas ainda
          const pendingLocalTransactions = prevTransactions.filter(t => 
            t.id.startsWith('temp-') && !userTransactions.some(ut => ut.id === t.id)
          );
          
          if (pendingLocalTransactions.length > 0) {
            console.log('Mantendo', pendingLocalTransactions.length, 'transações locais pendentes');
          }
          
          const combinedTransactions = [...userTransactions, ...pendingLocalTransactions];
          console.log('Total de transações após combinação:', combinedTransactions.length);
          
          return combinedTransactions;
        });
      }
    );
    
    return () => {
      if (unsubscribeTransactions) {
        console.log('Cancelando listener de transações');
        unsubscribeTransactions();
      }
    };
  }, [user, accounts]);
  
  // Funções para operações CRUD
  const addAccount = async (account: Omit<Account, 'id'>): Promise<string> => {
    if (!user) throw new Error('Usuário não autenticado');
    
    try {
      // Usar o serviço de fila para adicionar a conta
      const id = await queueService.addAccount(account, user.uid);
      
      // Atualizar o contador de operações pendentes
      updatePendingCount();
      
      // Atualizamos o estado otimisticamente se for uma operação temporária
      if (id.startsWith('temp-')) {
        const newAccount: Account = {
          ...account,
          id,
          userId: user.uid,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          pending: true // Marcar como pendente
        };
        
        setAccounts(prev => [...prev, newAccount]);
      }
      
      return id;
    } catch (error) {
      console.error('Erro ao adicionar conta:', error);
      setError('Falha ao adicionar conta.');
      throw error;
    }
  };
  
  const updateAccount = async (id: string, data: Partial<Account>): Promise<void> => {
    if (!user) throw new Error('Usuário não autenticado');
    
    try {
      // Atualizar na base de dados
      await firestoreService.updateAccount(id, data, user.uid);
      
      // Atualizar no estado local
      setAccounts(prev => 
        prev.map(account => 
          account.id === id
            ? { ...account, ...data, updatedAt: new Date().toISOString() }
            : account
        )
      );
      
      success('Conta atualizada com sucesso');
    } catch (err) {
      console.error('Erro ao atualizar conta:', err);
      error(`Falha ao atualizar conta: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
      throw err;
    }
  };
  
  const deleteAccount = async (id: string): Promise<void> => {
    if (!user) throw new Error('Usuário não autenticado');
    
    try {
      // Mostrar notificação de operação em andamento
      info('Excluindo conta...');
      
      // Remover localmente primeiro (otimisticamente)
      const accountsCopy = [...accounts];
      setAccounts(prev => prev.filter(account => account.id !== id));
      
      try {
        // Excluir no servidor
        await firestoreService.deleteAccount(id, user.uid);
        success('Conta excluída com sucesso');
      } catch (err) {
        console.error('Erro ao excluir conta:', err);
        error(`Falha ao excluir conta: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
        
        // Restaurar estado local
        setAccounts(accountsCopy);
        throw err;
      }
    } catch (error) {
      console.error('Erro ao excluir conta:', error);
      
      // Em caso de erro na manipulação local, tentar restaurar a conta
      try {
        // Adicionar a conta de volta ao state (versão simplificada)
        const deletedAccount = accounts.find(a => a.id === id);
        if (deletedAccount) {
          setAccounts(prev => [...prev, deletedAccount]);
        }
      } catch (e) {
        console.error('Erro ao reverter exclusão:', e);
      }
      
      throw error;
    }
  };
  
  const addTransaction = async (transaction: Omit<Transaction, 'id'>): Promise<string> => {
    if (!user) throw new Error('Usuário não autenticado');
    
    try {
      console.log(`Tentando adicionar transação para usuário ${user.uid}:`, transaction);
      
      // Garantir que userId está explicitamente definido no objeto de transação
      const transactionWithUserId = {
        ...transaction,
        userId: user.uid
      };
      
      // Verificar se a data é válida
      if (transactionWithUserId.date) {
        try {
          // Se é uma string, tentar converter para um objeto Date válido
          if (typeof transactionWithUserId.date === 'string') {
            new Date(transactionWithUserId.date).toISOString();
          }
        } catch (e) {
          console.error("Data inválida na transação:", transactionWithUserId.date);
          throw new Error(`Data inválida: ${transactionWithUserId.date}`);
        }
      }
      
      // Garantir que createdAt e updatedAt estão definidos
      if (!transactionWithUserId.createdAt) {
        transactionWithUserId.createdAt = new Date().toISOString();
      }
      
      if (!transactionWithUserId.updatedAt) {
        transactionWithUserId.updatedAt = new Date().toISOString();
      }
      
      console.log("Dados finais da transação:", transactionWithUserId);
      
      // Usar o serviço de fila para adicionar a transação
      const id = await queueService.addTransaction(transactionWithUserId, user.uid);
      
      console.log(`Transação adicionada com ID: ${id}, usuário: ${user.uid}`);
      
      // Atualizar o contador de operações pendentes
      updatePendingCount();
      
      // Atualizamos o estado otimisticamente se for uma operação temporária
      if (id.startsWith('temp-')) {
        const newTransaction: Transaction = {
          ...transactionWithUserId,
          id,
          userId: user.uid,
          pending: true // Marcar como pendente
        };
        
        console.log('Adicionando transação otimisticamente ao estado:', newTransaction);
        setTransactions(prev => [...prev, newTransaction]);
      } else {
        // Se ID for do Firestore, verificar se precisa atualizar o estado local
        setTimeout(() => {
          setTransactions(prev => {
            // Verificar se a transação já existe no estado
            const exists = prev.some(t => t.id === id);
            if (!exists) {
              console.log(`Transação ${id} não encontrada no estado após 1s, adicionando localmente.`);
              // Criar objeto de transação completo
              const newTransaction: Transaction = {
                ...transactionWithUserId,
                id,
              };
              return [...prev, newTransaction];
            }
            console.log(`Transação ${id} já existe no estado.`);
            return prev;
          });
        }, 1000);
      }
      
      return id;
    } catch (error) {
      console.error('Erro ao adicionar transação:', error);
      setError('Falha ao adicionar transação.');
      throw error;
    }
  };
  
  const updateTransaction = async (id: string, transactionUpdate: Partial<Transaction>): Promise<void> => {
    if (!user) throw new Error('Usuário não autenticado');
    
    try {
      // Atualizar otimisticamente o estado local primeiro
      const transactionToUpdate = transactions.find(t => t.id === id);
      
      if (!transactionToUpdate) {
        throw new Error('Transação não encontrada');
      }
      
      // Precisamos remover pendingOperation se presente no objeto de atualização
      const { pendingOperation, ...safeUpdate } = transactionUpdate as any;
      
      // Verificar se estamos online ou offline
      const isOnline = navigator.onLine;
      
      const updatedTransaction: Transaction = {
        ...transactionToUpdate,
        ...safeUpdate,
        updatedAt: new Date().toISOString(),
        pending: safeUpdate.pending !== undefined ? safeUpdate.pending : transactionToUpdate.pending,
        // Marcar como pendingOperation apenas se estivermos offline
        pendingOperation: !isOnline
      };
      
      // Atualizar estado local imediatamente
      setTransactions(prev => 
        prev.map(t => t.id === id ? updatedTransaction : t)
      );
      
      // Se offline, adicionar à fila
      if (!isOnline) {
        await queueService.addToQueue({
          type: 'update',
          collection: 'transactions',
          documentId: id,
          data: safeUpdate,
          userId: user.uid
        });
        
        // Atualizar o contador
        updatePendingCount();
        return;
      }
      
      // Se online, tentar atualizar diretamente
      try {
        console.log('Atualizando transação no Firestore:', id, safeUpdate);
        await firestoreService.updateTransaction(id, safeUpdate, user.uid);
        
        // Atualizar localmente para garantir que não há flag de pendência
        setTransactions(prev => 
          prev.map(t => t.id === id ? {...updatedTransaction, pendingOperation: false} : t)
        );
        
      } catch (error) {
        console.error('Erro ao atualizar transação no Firestore:', error);
        
        // Em caso de falha, adicionar à fila
        await queueService.addToQueue({
          type: 'update',
          collection: 'transactions',
          documentId: id,
          data: safeUpdate,
          userId: user.uid
        });
        
        // Marcar a transação como pendente localmente
        setTransactions(prev => 
          prev.map(t => t.id === id ? {...updatedTransaction, pendingOperation: true} : t)
        );
        
        // Atualizar o contador
        updatePendingCount();
      }
    } catch (error) {
      console.error('Erro ao atualizar transação:', error);
      setError('Falha ao atualizar transação.');
      throw error;
    }
  };
  
  const deleteTransaction = async (id: string): Promise<void> => {
    if (!user) throw new Error('Usuário não autenticado');
    
    try {
      // Atualizar otimisticamente o estado local primeiro
      setTransactions(prev => prev.filter(t => t.id !== id));
      
      // Se offline ou erro, adicionar à fila
      if (!navigator.onLine) {
        await queueService.addToQueue({
          type: 'delete',
          collection: 'transactions',
          documentId: id,
          data: {},
          userId: user.uid
        });
        
        // Atualizar o contador
        updatePendingCount();
        return;
      }
      
      // Se online, tentar excluir diretamente
      try {
        await firestoreService.deleteTransaction(id, user.uid);
      } catch (error) {
        console.error('Erro ao excluir transação, adicionando à fila:', error);
        
        // Em caso de falha, adicionar à fila
        await queueService.addToQueue({
          type: 'delete',
          collection: 'transactions',
          documentId: id,
          data: {},
          userId: user.uid
        });
        
        // Atualizar o contador
        updatePendingCount();
      }
    } catch (error) {
      console.error('Erro ao excluir transação:', error);
      setError('Falha ao excluir transação.');
      throw error;
    }
  };
  
  // Implementações similares para categorias
  const addCategory = async (category: Omit<Category, 'id'>): Promise<string> => {
    if (!user) throw new Error('Usuário não autenticado');
    
    try {
      // Se offline, adicionar à fila
      if (!navigator.onLine) {
        await queueService.addToQueue({
          type: 'create',
          collection: 'categories',
          data: category,
          userId: user.uid
        });
        
        const tempId = `temp-${Date.now()}`;
        
        // Atualizar o estado otimisticamente
        const newCategory: Category = {
          ...category,
          id: tempId,
          userId: user.uid,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          pending: true
        };
        
        setCategories(prev => [...prev, newCategory]);
        
        // Atualizar o contador
        updatePendingCount();
        
        return tempId;
      }
      
      // Se online, tentar criar diretamente
      try {
        const id = await firestoreService.createCategory(category, user.uid);
        return id;
      } catch (error) {
        console.error('Erro ao criar categoria, adicionando à fila:', error);
        
        // Em caso de falha, adicionar à fila
        const queueId = await queueService.addToQueue({
          type: 'create',
          collection: 'categories',
          data: category,
          userId: user.uid
        });
        
        const tempId = `temp-${queueId}`;
        
        // Atualizar o estado otimisticamente
        const newCategory: Category = {
          ...category,
          id: tempId,
          userId: user.uid,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          pending: true
        };
        
        setCategories(prev => [...prev, newCategory]);
        
        // Atualizar o contador
        updatePendingCount();
        
        return tempId;
      }
    } catch (error) {
      console.error('Erro ao adicionar categoria:', error);
      setError('Falha ao adicionar categoria.');
      throw error;
    }
  };
  
  const updateCategory = async (id: string, categoryUpdate: Partial<Category>): Promise<void> => {
    if (!user) throw new Error('Usuário não autenticado');
    
    try {
      // Atualizar otimisticamente o estado local primeiro
      const categoryToUpdate = categories.find(c => c.id === id);
      
      if (!categoryToUpdate) {
        throw new Error('Categoria não encontrada');
      }
      
      const updatedCategory: Category = {
        ...categoryToUpdate,
        ...categoryUpdate,
        updatedAt: new Date().toISOString(),
        pending: true
      };
      
      setCategories(prev => 
        prev.map(c => c.id === id ? updatedCategory : c)
      );
      
      // Se offline, adicionar à fila
      if (!navigator.onLine) {
        await queueService.addToQueue({
          type: 'update',
          collection: 'categories',
          documentId: id,
          data: categoryUpdate,
          userId: user.uid
        });
        
        // Atualizar o contador
        updatePendingCount();
        return;
      }
      
      // Se online, tentar atualizar diretamente
      try {
        await firestoreService.updateCategory(id, categoryUpdate, user.uid);
      } catch (error) {
        console.error('Erro ao atualizar categoria, adicionando à fila:', error);
        
        // Em caso de falha, adicionar à fila
        await queueService.addToQueue({
          type: 'update',
          collection: 'categories',
          documentId: id,
          data: categoryUpdate,
          userId: user.uid
        });
        
        // Atualizar o contador
        updatePendingCount();
      }
    } catch (error) {
      console.error('Erro ao atualizar categoria:', error);
      setError('Falha ao atualizar categoria.');
      throw error;
    }
  };
  
  const deleteCategory = async (id: string): Promise<void> => {
    if (!user) throw new Error('Usuário não autenticado');
    
    try {
      // Atualizar otimisticamente o estado local primeiro
      setCategories(prev => prev.filter(c => c.id !== id));
      
      // Se offline, adicionar à fila
      if (!navigator.onLine) {
        await queueService.addToQueue({
          type: 'delete',
          collection: 'categories',
          documentId: id,
          data: {},
          userId: user.uid
        });
        
        // Atualizar o contador
        updatePendingCount();
        return;
      }
      
      // Se online, tentar excluir diretamente
      try {
        await firestoreService.deleteCategory(id, user.uid);
      } catch (error) {
        console.error('Erro ao excluir categoria, adicionando à fila:', error);
        
        // Em caso de falha, adicionar à fila
        await queueService.addToQueue({
          type: 'delete',
          collection: 'categories',
          documentId: id,
          data: {},
          userId: user.uid
        });
        
        // Atualizar o contador
        updatePendingCount();
      }
    } catch (error) {
      console.error('Erro ao excluir categoria:', error);
      setError('Falha ao excluir categoria.');
      throw error;
    }
  };
  
  // Implementações para metas (goals)
  const addGoal = async (goal: Omit<Goal, 'id'>): Promise<string> => {
    if (!user) throw new Error('Usuário não autenticado');
    
    try {
      // Se offline, adicionar à fila
      if (!navigator.onLine) {
        await queueService.addToQueue({
          type: 'create',
          collection: 'goals',
          data: goal,
          userId: user.uid
        });
        
        const tempId = `temp-${Date.now()}`;
        
        // Atualizar o estado otimisticamente
        const newGoal: Goal = {
          ...goal,
          id: tempId,
          userId: user.uid,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          pending: true
        };
        
        setGoals(prev => [...prev, newGoal]);
        
        // Atualizar o contador
        updatePendingCount();
        
        return tempId;
      }
      
      // Se online, tentar criar diretamente
      try {
        const id = await firestoreService.createGoal(goal, user.uid);
        return id;
      } catch (error) {
        console.error('Erro ao criar meta, adicionando à fila:', error);
        
        // Em caso de falha, adicionar à fila
        const queueId = await queueService.addToQueue({
          type: 'create',
          collection: 'goals',
          data: goal,
          userId: user.uid
        });
        
        const tempId = `temp-${queueId}`;
        
        // Atualizar o estado otimisticamente
        const newGoal: Goal = {
          ...goal,
          id: tempId,
          userId: user.uid,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          pending: true
        };
        
        setGoals(prev => [...prev, newGoal]);
        
        // Atualizar o contador
        updatePendingCount();
        
        return tempId;
      }
    } catch (error) {
      console.error('Erro ao adicionar meta:', error);
      setError('Falha ao adicionar meta.');
      throw error;
    }
  };
  
  const updateGoal = async (id: string, goalUpdate: Partial<Goal>): Promise<void> => {
    if (!user) throw new Error('Usuário não autenticado');
    
    try {
      // Atualizar otimisticamente o estado local primeiro
      const goalToUpdate = goals.find(g => g.id === id);
      
      if (!goalToUpdate) {
        throw new Error('Meta não encontrada');
      }
      
      const updatedGoal: Goal = {
        ...goalToUpdate,
        ...goalUpdate,
        updatedAt: new Date().toISOString(),
        pending: true
      };
      
      setGoals(prev => 
        prev.map(g => g.id === id ? updatedGoal : g)
      );
      
      // Se offline, adicionar à fila
      if (!navigator.onLine) {
        await queueService.addToQueue({
          type: 'update',
          collection: 'goals',
          documentId: id,
          data: goalUpdate,
          userId: user.uid
        });
        
        // Atualizar o contador
        updatePendingCount();
        return;
      }
      
      // Se online, tentar atualizar diretamente
      try {
        await firestoreService.updateGoal(id, goalUpdate, user.uid);
      } catch (error) {
        console.error('Erro ao atualizar meta, adicionando à fila:', error);
        
        // Em caso de falha, adicionar à fila
        await queueService.addToQueue({
          type: 'update',
          collection: 'goals',
          documentId: id,
          data: goalUpdate,
          userId: user.uid
        });
        
        // Atualizar o contador
        updatePendingCount();
      }
    } catch (error) {
      console.error('Erro ao atualizar meta:', error);
      setError('Falha ao atualizar meta.');
      throw error;
    }
  };
  
  const deleteGoal = async (id: string): Promise<void> => {
    if (!user) throw new Error('Usuário não autenticado');
    
    try {
      // Atualizar otimisticamente o estado local primeiro
      setGoals(prev => prev.filter(g => g.id !== id));
      
      // Se offline, adicionar à fila
      if (!navigator.onLine) {
        await queueService.addToQueue({
          type: 'delete',
          collection: 'goals',
          documentId: id,
          data: {},
          userId: user.uid
        });
        
        // Atualizar o contador
        updatePendingCount();
        return;
      }
      
      // Se online, tentar excluir diretamente
      try {
        await firestoreService.deleteGoal(id, user.uid);
      } catch (error) {
        console.error('Erro ao excluir meta, adicionando à fila:', error);
        
        // Em caso de falha, adicionar à fila
        await queueService.addToQueue({
          type: 'delete',
          collection: 'goals',
          documentId: id,
          data: {},
          userId: user.uid
        });
        
        // Atualizar o contador
        updatePendingCount();
      }
    } catch (error) {
      console.error('Erro ao excluir meta:', error);
      setError('Falha ao excluir meta.');
      throw error;
    }
  };
  
  // Função para processar operações pendentes manualmente
  const processPendingOperations = async (): Promise<number> => {
    if (!navigator.onLine) {
      error('Não é possível sincronizar sem conexão com a internet');
      return 0;
    }
    
    try {
      info('Sincronizando dados...');
      const count = await queueService.processPendingQueue();
      await updatePendingCount();
      
      if (count > 0) {
        success(`${count} operações sincronizadas com sucesso`);
      } else {
        info('Não há operações pendentes para sincronizar');
      }
      
      return count;
    } catch (err) {
      console.error('Erro ao processar operações pendentes:', err);
      error(`Erro na sincronização: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
      return 0;
    }
  };
  
  // Funções para filtros
  const addFilter = async (filter: Omit<Filter, 'id'>): Promise<string> => {
    if (!user) throw new Error('Usuário não autenticado');
    const tempId = `filter-${Date.now()}`;
    const newFilter: Filter = { ...filter, id: tempId };
    setFilters(prev => [...prev, newFilter]);
    return tempId;
  };

  const updateFilter = async (id: string, filter: Partial<Filter>): Promise<void> => {
    setFilters(prev => prev.map(f => f.id === id ? { ...f, ...filter } : f));
  };

  const deleteFilter = async (id: string): Promise<void> => {
    setFilters(prev => prev.filter(f => f.id !== id));
  };
  
  const value: FinanceContextType = {
    accounts,
    transactions,
    categories,
    goals,
    filters,
    isLoading,
    error: errorMsg,
    isOffline,
    pendingOperationsCount,
    addAccount,
    updateAccount,
    deleteAccount,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    addCategory,
    updateCategory,
    deleteCategory,
    addGoal,
    updateGoal,
    deleteGoal,
    addFilter,
    updateFilter,
    deleteFilter,
    processPendingOperations
  };
  
  return (
    <FinanceContext.Provider value={value}>
      {children}
    </FinanceContext.Provider>
  );
}; 