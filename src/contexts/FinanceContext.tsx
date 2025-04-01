import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import * as firestoreService from '../services/firestore';
import { enhancedSyncService } from '../services/enhancedSyncService';
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
  const { success, error: showError, info } = useNotification();
  
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [filters, setFilters] = useState<Filter[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState<boolean>(!navigator.onLine);
  const [pendingOperationsCount, setPendingOperationsCount] = useState<number>(0);
  
  // Ref para controlar se o componente está montado
  const isMounted = React.useRef(true);
  
  // Função para atualizar o número de operações pendentes
  const updatePendingCount = async () => {
    if (user && isMounted.current) {
      const count = await queueService.getPendingOperationsCount();
      setPendingOperationsCount(count);
    }
  };
  
  // Efeito para controlar o ciclo de vida do componente
  useEffect(() => {
    isMounted.current = true;
    
    // Configurar listeners quando o usuário autenticar
    if (user) {
      setIsLoading(true);
      setError(null);
      
      try {
        // Configurar listener para transações usando o serviço otimizado
        const unsubscribeTransactions = enhancedSyncService.setupTransactionsListener(
          user.uid,
          [],
          (updatedTransactions) => {
            if (isMounted.current) {
              console.log('Transações atualizadas:', updatedTransactions);
              setTransactions(updatedTransactions);
            }
          }
        );

        // Configurar listener para categorias
        const unsubscribeCategories = enhancedSyncService.setupCategoriesListener(
          user.uid,
          (updatedCategories) => {
            if (isMounted.current) {
              setCategories(updatedCategories);
            }
          }
        );
        
        // Sincronizar dados offline se houver
        enhancedSyncService.syncOfflineData().catch(console.error);
        
        return () => {
          isMounted.current = false;
          unsubscribeTransactions();
          unsubscribeCategories();
          enhancedSyncService.destroy();
        };
      } catch (err) {
        console.error('Erro ao configurar sincronização:', err);
        setError('Falha ao carregar dados financeiros.');
      } finally {
        setIsLoading(false);
      }
    }
    
    return () => {
      isMounted.current = false;
    };
  }, [user]);
  
  // Monitorar status de conexão
  useEffect(() => {
    const handleOnline = async () => {
      setIsOffline(false);
      try {
        const isOnline = await enhancedSyncService.isOnline();
        if (isOnline) {
          await enhancedSyncService.syncOfflineData();
          info('Conexão restabelecida. Sincronizando dados...');
        }
      } catch (err) {
        console.error('Erro ao sincronizar dados:', err);
      }
    };
    
    const handleOffline = () => {
      setIsOffline(true);
      info('Modo offline ativado. As alterações serão sincronizadas quando a conexão for restabelecida.');
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [info]);
  
  // Funções para operações CRUD
  const addAccount = async (account: Omit<Account, 'id'>): Promise<string> => {
    if (!user) throw new Error('Usuário não autenticado');
    
    try {
      // Usar o serviço de fila para adicionar a conta
      const id = await queueService.addAccount(account, user.uid);
      
      // Atualizar o contador de operações pendentes
      updatePendingCount();
      
      // Atualizamos o estado otimisticamente se for uma operação temporária
      if (id.startsWith('temp-') && isMounted.current) {
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
      
      // Atualizar no estado local se o componente ainda estiver montado
      if (isMounted.current) {
        setAccounts(prev => 
          prev.map(account => 
            account.id === id
              ? { ...account, ...data, updatedAt: new Date().toISOString() }
              : account
          )
        );
      }
      
      success('Conta atualizada com sucesso');
    } catch (err) {
      console.error('Erro ao atualizar conta:', err);
      showError(`Falha ao atualizar conta: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
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
        showError(`Falha ao excluir conta: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
        
        // Restaurar estado local se o componente ainda estiver montado
        if (isMounted.current) {
          setAccounts(accountsCopy);
        }
        throw err;
      }
    } catch (error) {
      console.error('Erro ao excluir conta:', error);
      
      // Em caso de erro na manipulação local, tentar restaurar a conta
      try {
        // Adicionar a conta de volta ao state (versão simplificada)
        const deletedAccount = accounts.find(a => a.id === id);
        if (deletedAccount && isMounted.current) {
          setAccounts(prev => [...prev, deletedAccount]);
        }
      } catch (e) {
        console.error('Erro ao reverter exclusão:', e);
      }
      
      throw error;
    }
  };
  
  // Funções para manipular transações
  const addTransaction = useCallback(async (transaction: Omit<Transaction, 'id'>): Promise<string> => {
    if (!user) throw new Error('Usuário não autenticado');
    
    try {
      console.log('Adicionando nova transação:', transaction);
      
      // Usar o serviço de sincronização aprimorado
      const id = await enhancedSyncService.addTransaction(transaction, user.uid);
      
      // Atualizar o estado otimisticamente
      if (isMounted.current) {
        const newTransaction: Transaction = {
          ...transaction,
          id,
          userId: user.uid,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          pending: true
        };
        
        setTransactions(prev => [...prev, newTransaction]);
      }
      
      success('Transação adicionada com sucesso!');
      return id;
    } catch (err) {
      console.error('Erro ao adicionar transação:', err);
      showError(`Erro ao adicionar transação: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
      throw err;
    }
  }, [success, showError, user]);
  
  const updateTransaction = useCallback(async (id: string, transaction: Partial<Transaction>): Promise<void> => {
    if (!user) throw new Error('Usuário não autenticado');
    
    try {
      await queueService.updateTransaction(id, transaction, user.uid);
      success('Transação atualizada com sucesso!');
    } catch (err) {
      showError(`Erro ao atualizar transação: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
      throw err;
    }
  }, [success, showError, user]);
  
  const deleteTransaction = useCallback(async (id: string): Promise<void> => {
    if (!user) throw new Error('Usuário não autenticado');
    
    try {
      console.log('[Finance] Excluindo transação:', id);
      await enhancedSyncService.deleteTransaction(id, user.uid);
      
      // Atualizar estado local
      setTransactions(prev => prev.filter(t => t.id !== id));
      
      success('Transação excluída com sucesso!');
    } catch (error) {
      console.error('[Finance] Erro ao excluir transação:', error);
      showError('Erro ao excluir transação. Tente novamente.');
      throw error;
    }
  }, [user, success, showError]);
  
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
      showError('Não é possível sincronizar sem conexão com a internet');
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
      showError(`Erro na sincronização: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
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
    error,
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