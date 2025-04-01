import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  query, 
  where,
  Timestamp,
  serverTimestamp,
  orderBy,
  limit,
  addDoc,
  writeBatch
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { Account, Transaction, Category, Goal, User, DEFAULT_CATEGORIES } from '../types';
import { validateTransaction, validateAccount, validateGoal } from './dataValidation';

/**
 * Serviço para interagir com o Firestore, respeitando as regras de segurança
 */

// USUÁRIOS

/**
 * Obtém os dados de um usuário
 * @param userId ID do usuário
 * @returns Dados do usuário ou null se não existir
 */
export const getUser = async (userId: string): Promise<User | null> => {
  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      return userSnap.data() as User;
    }
    
    return null;
  } catch (error) {
    console.error('Erro ao obter usuário:', error);
    throw error;
  }
};

/**
 * Atualiza os dados de um usuário
 * @param userId ID do usuário
 * @param userData Dados atualizados do usuário
 */
export const updateUser = async (userId: string, userData: Partial<User>): Promise<void> => {
  try {
    const userRef = doc(db, 'users', userId);
    
    await updateDoc(userRef, {
      ...userData,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Erro ao atualizar usuário:', error);
    throw error;
  }
};

// CONTAS FINANCEIRAS

/**
 * Obtém as contas financeiras de um usuário
 * @param userId ID do usuário
 * @returns Lista de contas do usuário
 */
export const getUserAccounts = async (userId: string): Promise<Account[]> => {
  try {
    const accountsQuery = query(
      collection(db, 'accounts'), 
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    
    const accountsSnap = await getDocs(accountsQuery);
    const accounts: Account[] = [];
    
    accountsSnap.forEach((doc) => {
      accounts.push({ id: doc.id, ...doc.data() } as Account);
    });
    
    return accounts;
  } catch (error) {
    console.error('Erro ao buscar contas:', error);
    throw error;
  }
};

/**
 * Cria uma nova conta financeira
 * @param account Dados da conta
 * @param userId ID do usuário proprietário
 * @returns ID da conta criada
 */
export const createAccount = async (account: Omit<Account, 'id' | 'userId' | 'createdAt' | 'updatedAt'>, userId: string): Promise<string> => {
  try {
    // Validar dados da conta
    const validation = validateAccount(account);
    if (!validation.valid) {
      throw new Error(`Dados inválidos: ${validation.errors.join(', ')}`);
    }
    
    const accountsRef = collection(db, 'accounts');
    const newAccountRef = doc(accountsRef);
    
    const newAccount = {
      ...account,
      userId,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    
    await setDoc(newAccountRef, newAccount);
    return newAccountRef.id;
  } catch (error) {
    console.error('Erro ao criar conta:', error);
    throw error;
  }
};

/**
 * Atualiza uma conta financeira
 * @param accountId ID da conta
 * @param accountData Dados atualizados da conta
 * @param userId ID do usuário proprietário (para verificação)
 */
export const updateAccount = async (accountId: string, accountData: Partial<Account>, userId: string): Promise<void> => {
  try {
    // Obter conta para verificar propriedade
    const accountRef = doc(db, 'accounts', accountId);
    const accountSnap = await getDoc(accountRef);
    
    if (!accountSnap.exists()) {
      throw new Error('Conta não encontrada');
    }
    
    const existingAccount = accountSnap.data();
    if (existingAccount.userId !== userId) {
      throw new Error('Sem permissão para atualizar esta conta');
    }
    
    // Validar dados da conta
    const validation = validateAccount({ ...existingAccount, ...accountData });
    if (!validation.valid) {
      throw new Error(`Dados inválidos: ${validation.errors.join(', ')}`);
    }
    
    await updateDoc(accountRef, {
      ...accountData,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Erro ao atualizar conta:', error);
    throw error;
  }
};

// TRANSAÇÕES

/**
 * Obtém as transações de uma conta
 * @param accountId ID da conta
 * @param userId ID do usuário proprietário (para verificação)
 * @returns Lista de transações da conta
 */
export const getAccountTransactions = async (accountId: string, userId: string): Promise<Transaction[]> => {
  try {
    // Verificar propriedade da conta
    const accountRef = doc(db, 'accounts', accountId);
    const accountSnap = await getDoc(accountRef);
    
    if (!accountSnap.exists()) {
      throw new Error('Conta não encontrada');
    }
    
    const account = accountSnap.data();
    if (account.userId !== userId) {
      throw new Error('Sem permissão para acessar transações desta conta');
    }
    
    const transactionsQuery = query(
      collection(db, 'transactions'), 
      where('accountId', '==', accountId),
      orderBy('date', 'desc')
    );
    
    const transactionsSnap = await getDocs(transactionsQuery);
    const transactions: Transaction[] = [];
    
    transactionsSnap.forEach((doc) => {
      const data = doc.data();
      transactions.push({ 
        id: doc.id, 
        ...data,
        date: data.date.toDate() // Converter Timestamp para Date
      } as Transaction);
    });
    
    return transactions;
  } catch (error) {
    console.error('Erro ao buscar transações:', error);
    throw error;
  }
};

// Adicionar função que verifica/cria a conta principal se necessário
export const verificarECriarContaPrincipal = async (userId: string): Promise<string> => {
  try {
    // Verificar se já existe alguma conta para o usuário
    const userAccounts = await getUserAccounts(userId);
    
    // Se já existe pelo menos uma conta, retornar o ID da primeira
    if (userAccounts.length > 0) {
      return userAccounts[0].id;
    }
    
    // Se não existem contas, criar a conta principal
    console.log("Criando conta principal para o usuário:", userId);
    
    // Dados da conta principal
    const contaPrincipal = {
      name: "Conta Principal",
      type: "wallet" as const,
      balance: 0,
      userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // Adicionar a conta ao Firestore
    const contaRef = await createAccount(contaPrincipal, userId);
    console.log("Conta principal criada com ID:", contaRef);
    
    return contaRef;
  } catch (error) {
    console.error("Erro ao verificar/criar conta principal:", error);
    throw new Error(`Erro ao verificar/criar conta principal: ${error instanceof Error ? error.message : String(error)}`);
  }
};

/**
 * Adiciona uma nova transação
 * @param transactionData Dados da transação
 * @returns ID da transação criada
 */
export const addTransaction = async (transactionData: any): Promise<string> => {
  try {
    console.log('Iniciando adição de transação:', { ...transactionData });
    
    // Validar dados da transação
    if (!transactionData.accountId) {
      throw new Error('ID da conta é obrigatório');
    }
    
    if (!transactionData.userId) {
      throw new Error('ID do usuário é obrigatório');
    }
    
    if (transactionData.amount === undefined || isNaN(Number(transactionData.amount))) {
      throw new Error('Valor da transação é obrigatório e deve ser um número');
    }
    
    // Limpar dados para remover campos indefinidos e formatá-los corretamente
    const dadosLimpos: Record<string, any> = {};
    
    Object.entries(transactionData).forEach(([key, value]) => {
      if (value !== undefined) {
        dadosLimpos[key] = value;
      }
    });
    
    // Garantir que tags seja um array
    if (!dadosLimpos.tags || !Array.isArray(dadosLimpos.tags)) {
      dadosLimpos.tags = [];
    }
    
    // Processar a data
    if (dadosLimpos.date) {
      try {
        // Verificar se é uma string no formato YYYY-MM-DD
        if (typeof dadosLimpos.date === 'string' && dadosLimpos.date.match(/^\d{4}-\d{2}-\d{2}$/)) {
          // Data já está no formato correto
          console.log('Data no formato correto: ', dadosLimpos.date);
        } else {
          // Tentar converter a data
          const dataObj = new Date(dadosLimpos.date);
          
          if (isNaN(dataObj.getTime())) {
            console.error('Data inválida, usando data atual:', dadosLimpos.date);
            dadosLimpos.date = new Date().toISOString().split('T')[0];
          } else {
            dadosLimpos.date = dataObj.toISOString().split('T')[0];
          }
        }
      } catch (err) {
        console.error('Erro ao processar data:', err);
        dadosLimpos.date = new Date().toISOString().split('T')[0];
      }
    } else {
      // Se não houver data, usar a data atual
      dadosLimpos.date = new Date().toISOString().split('T')[0];
    }
    
    // Converter valor para número
    dadosLimpos.amount = Number(dadosLimpos.amount);
    
    // Garantir que o timestamp seja adicionado
    dadosLimpos.createdAt = serverTimestamp();
    dadosLimpos.updatedAt = serverTimestamp();
    
    // Adicionar transação ao Firestore
    console.log('Dados limpos para Firestore:', dadosLimpos);
    const transactionsCollection = collection(db, 'transactions');
    const docRef = await addDoc(transactionsCollection, dadosLimpos);
    
    console.log(`Transação adicionada com sucesso. ID: ${docRef.id}`);
    
    // Atualizar saldo da conta se não for uma transação pendente
    if (dadosLimpos.pending !== true) {
      await updateAccountBalance(
        dadosLimpos.accountId,
        dadosLimpos.type,
        dadosLimpos.amount,
        dadosLimpos.userId
      );
      console.log(`Saldo da conta atualizado para transação ${docRef.id}`);
    } else {
      console.log(`Transação ${docRef.id} é pendente, saldo não atualizado`);
    }
    
    return docRef.id;
  } catch (error) {
    console.error('Erro ao adicionar transação:', error);
    throw error;
  }
};

// Função auxiliar para atualizar o saldo da conta
const updateAccountBalance = async (accountId: string, type: 'income' | 'expense', amount: number, userId: string) => {
  try {
    console.log(`Atualizando saldo da conta ${accountId} para ${type} de ${amount}`);
    
    // Obter a conta para verificar propriedade
    const accountRef = doc(db, 'accounts', accountId);
    const accountSnap = await getDoc(accountRef);
    
    if (!accountSnap.exists()) {
      console.error(`Conta ${accountId} não encontrada`);
      throw new Error('Conta não encontrada');
    }
    
    const account = accountSnap.data();
    
    // Verificar propriedade da conta
    if (account.userId !== userId) {
      console.error(`Usuário ${userId} não tem permissão para modificar a conta ${accountId}`);
      throw new Error('Sem permissão para modificar esta conta');
    }
    
    // Calcular novo saldo
    const balanceChange = type === 'income' ? amount : -amount;
    const newBalance = account.balance + balanceChange;
    
    console.log(`Atualizando saldo: ${account.balance} + (${balanceChange}) = ${newBalance}`);
    
    // Atualizar saldo da conta
    await updateDoc(accountRef, {
      balance: newBalance,
      updatedAt: serverTimestamp()
    });
    
    console.log(`Saldo da conta ${accountId} atualizado com sucesso`);
  } catch (error) {
    console.error(`Erro ao atualizar saldo da conta ${accountId}:`, error);
    throw error;
  }
};

/**
 * Atualiza uma transação
 * @param transactionId ID da transação
 * @param transactionData Dados atualizados da transação
 * @param userId ID do usuário proprietário (para verificação)
 */
export const updateTransaction = async (
  transactionId: string, 
  transactionData: Partial<Transaction>, 
  userId: string
): Promise<void> => {
  try {
    console.log(`Atualizando transação ${transactionId} com`, transactionData);
    
    // Obter transação para verificar propriedade
    const transactionRef = doc(db, 'transactions', transactionId);
    const transactionSnap = await getDoc(transactionRef);
    
    if (!transactionSnap.exists()) {
      throw new Error('Transação não encontrada');
    }
    
    const existingTransaction = transactionSnap.data();
    
    // Verificar propriedade da conta
    const accountRef = doc(db, 'accounts', existingTransaction.accountId);
    const accountSnap = await getDoc(accountRef);
    
    if (!accountSnap.exists()) {
      throw new Error('Conta não encontrada');
    }
    
    const account = accountSnap.data();
    if (account.userId !== userId) {
      throw new Error('Sem permissão para atualizar esta transação');
    }
    
    // Preparar dados para atualização
    const cleanData: Record<string, any> = {};
    
    // Copiar apenas os campos válidos de forma segura em relação ao tipo
    Object.entries(transactionData as Record<string, any>).forEach(([key, value]) => {
      if (value !== undefined) {
        cleanData[key] = value;
      }
    });
    
    // Converter Date para Timestamp se fornecido
    if (cleanData.date) {
      cleanData.date = cleanData.date instanceof Date 
        ? Timestamp.fromDate(cleanData.date) 
        : Timestamp.fromDate(new Date(cleanData.date));
    }
    
    // Certificar que amount é um número
    if (cleanData.amount !== undefined) {
      cleanData.amount = Number(cleanData.amount);
    }
    
    // Certificar que pending é um booleano
    if (cleanData.pending !== undefined) {
      cleanData.pending = Boolean(cleanData.pending);
    }
    
    cleanData.updatedAt = serverTimestamp();
    
    // Atualizar transação
    await updateDoc(transactionRef, cleanData);
    console.log(`Transação ${transactionId} atualizada com sucesso`);
    
    // Verificar se é necessário atualizar o saldo da conta
    const shouldUpdateBalance = (
      (cleanData.amount !== undefined && cleanData.amount !== existingTransaction.amount) ||
      (cleanData.type !== undefined && cleanData.type !== existingTransaction.type) ||
      (cleanData.pending !== undefined && cleanData.pending !== existingTransaction.pending)
    );
    
    if (shouldUpdateBalance) {
      // Calcular o impacto no saldo atual antes da atualização
      let oldEffect = 0;
      if (!existingTransaction.pending) {
        oldEffect = existingTransaction.type === 'income' 
          ? existingTransaction.amount 
          : -existingTransaction.amount;
      }
      
      // Calcular o impacto no saldo após a atualização
      let newEffect = 0;
      const newPending = cleanData.pending !== undefined ? cleanData.pending : existingTransaction.pending;
      
      if (!newPending) {
        const newType = cleanData.type || existingTransaction.type;
        const newAmount = cleanData.amount !== undefined ? cleanData.amount : existingTransaction.amount;
        newEffect = newType === 'income' ? newAmount : -newAmount;
      }
      
      // Aplicar mudança no saldo
      const balanceChange = -oldEffect + newEffect;
      
      if (balanceChange !== 0) {
        console.log(`Atualizando saldo da conta ${account.id} em ${balanceChange}`);
        await updateDoc(accountRef, {
          balance: account.balance + balanceChange,
          updatedAt: serverTimestamp()
        });
      }
    }
  } catch (error) {
    console.error('Erro ao atualizar transação:', error);
    throw error;
  }
};

/**
 * Exclui uma transação
 * @param transactionId ID da transação
 * @param userId ID do usuário proprietário (para verificação)
 */
export const deleteTransaction = async (transactionId: string, userId: string): Promise<void> => {
  try {
    // Obter transação para verificar propriedade
    const transactionRef = doc(db, 'transactions', transactionId);
    const transactionSnap = await getDoc(transactionRef);
    
    if (!transactionSnap.exists()) {
      throw new Error('Transação não encontrada');
    }
    
    const existingTransaction = transactionSnap.data();
    
    // Verificar propriedade da conta
    const accountRef = doc(db, 'accounts', existingTransaction.accountId);
    const accountSnap = await getDoc(accountRef);
    
    if (!accountSnap.exists()) {
      throw new Error('Conta não encontrada');
    }
    
    const account = accountSnap.data();
    if (account.userId !== userId) {
      throw new Error('Sem permissão para excluir esta transação');
    }
    
    // Atualizar saldo da conta antes de excluir a transação
    const balanceChange = existingTransaction.type === 'income'
      ? -existingTransaction.amount
      : existingTransaction.amount;
    
    await updateDoc(accountRef, {
      balance: account.balance + balanceChange,
      updatedAt: serverTimestamp()
    });
    
    // Excluir transação
    await deleteDoc(transactionRef);
  } catch (error) {
    console.error('Erro ao excluir transação:', error);
    throw error;
  }
};

// Adicionar função createTransaction para compatibilidade com queueService
export const createTransaction = async (
  transactionData: any, 
  userId: string
): Promise<string> => {
  try {
    console.log("createTransaction: recebendo dados:", transactionData);
    
    // Garantir que o userId esteja definido no objeto
    const completeTransactionData = {
      ...transactionData,
      userId: transactionData.userId || userId
    };
    
    console.log("createTransaction: dados finais para addTransaction:", completeTransactionData);
    
    // Chamar addTransaction com os dados completos
    return addTransaction(completeTransactionData);
  } catch (error) {
    console.error("Erro em createTransaction:", error);
    throw error;
  }
};

// Métodos para Categorias
export const createCategory = async (
  categoryData: any, 
  userId: string
): Promise<string> => {
  // Validar dados da categoria
  if (!categoryData.name || !categoryData.type || !categoryData.color) {
    throw new Error('Dados da categoria incompletos');
  }
  
  const categoryRef = collection(db, 'categories');
  const newCategory = {
    ...categoryData,
    userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  
  const docRef = await addDoc(categoryRef, newCategory);
  return docRef.id;
};

export const updateCategory = async (
  categoryId: string, 
  categoryData: any, 
  userId: string
): Promise<void> => {
  const categoryRef = doc(db, 'categories', categoryId);
  
  // Verificar permissão
  const categorySnap = await getDoc(categoryRef);
  if (!categorySnap.exists()) {
    throw new Error('Categoria não encontrada');
  }
  
  const categoryFromDB = categorySnap.data();
  if (categoryFromDB.userId !== userId) {
    throw new Error('Sem permissão para editar esta categoria');
  }
  
  await updateDoc(categoryRef, {
    ...categoryData,
    updatedAt: serverTimestamp()
  });
};

export const deleteCategory = async (
  categoryId: string, 
  userId: string
): Promise<void> => {
  const categoryRef = doc(db, 'categories', categoryId);
  
  // Verificar permissão
  const categorySnap = await getDoc(categoryRef);
  if (!categorySnap.exists()) {
    throw new Error('Categoria não encontrada');
  }
  
  const categoryFromDB = categorySnap.data();
  if (categoryFromDB.userId !== userId) {
    throw new Error('Sem permissão para excluir esta categoria');
  }
  
  await deleteDoc(categoryRef);
};

// Métodos para Metas
export const createGoal = async (
  goalData: any, 
  userId: string
): Promise<string> => {
  // Validar dados da meta
  if (!goalData.name || !goalData.targetAmount || !goalData.deadline) {
    throw new Error('Dados da meta incompletos');
  }
  
  const goalRef = collection(db, 'goals');
  const newGoal = {
    ...goalData,
    userId,
    currentAmount: goalData.currentAmount || 0,
    isCompleted: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  
  const docRef = await addDoc(goalRef, newGoal);
  return docRef.id;
};

export const updateGoal = async (
  goalId: string, 
  goalData: any, 
  userId: string
): Promise<void> => {
  const goalRef = doc(db, 'goals', goalId);
  
  // Verificar permissão
  const goalSnap = await getDoc(goalRef);
  if (!goalSnap.exists()) {
    throw new Error('Meta não encontrada');
  }
  
  const goalFromDB = goalSnap.data();
  if (goalFromDB.userId !== userId) {
    throw new Error('Sem permissão para editar esta meta');
  }
  
  // Atualizar status de concluído se atingiu o valor alvo
  let updatedData = { ...goalData };
  
  if (
    goalData.currentAmount !== undefined && 
    goalFromDB.targetAmount <= goalData.currentAmount
  ) {
    updatedData.isCompleted = true;
  }
  
  await updateDoc(goalRef, {
    ...updatedData,
    updatedAt: serverTimestamp()
  });
};

export const deleteGoal = async (
  goalId: string, 
  userId: string
): Promise<void> => {
  const goalRef = doc(db, 'goals', goalId);
  
  // Verificar permissão
  const goalSnap = await getDoc(goalRef);
  if (!goalSnap.exists()) {
    throw new Error('Meta não encontrada');
  }
  
  const goalFromDB = goalSnap.data();
  if (goalFromDB.userId !== userId) {
    throw new Error('Sem permissão para excluir esta meta');
  }
  
  await deleteDoc(goalRef);
};

export const getAccount = async (
  accountId: string,
  userId: string
): Promise<any> => {
  const accountRef = doc(db, 'accounts', accountId);
  
  const accountSnap = await getDoc(accountRef);
  if (!accountSnap.exists()) {
    return null;
  }
  
  const accountData = accountSnap.data();
  if (accountData.userId !== userId) {
    throw new Error('Sem permissão para acessar esta conta');
  }
  
  return {
    id: accountSnap.id,
    ...accountData
  };
};

export const createDefaultCategories = async (userId: string): Promise<void> => {
  try {
    console.log('Criando categorias padrão para o usuário:', userId);
    
    const categoriesRef = collection(db, 'categories');
    const batch = writeBatch(db);
    
    for (const category of DEFAULT_CATEGORIES) {
      const docRef = doc(categoriesRef);
      batch.set(docRef, {
        ...category,
        userId,
        isDefault: true,
        id: `default-${category.type}-${category.name.toLowerCase().replace(/\s+/g, '-')}`,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }
    
    await batch.commit();
    console.log('Categorias padrão criadas com sucesso');
  } catch (error) {
    console.error('Erro ao criar categorias padrão:', error);
    throw error;
  }
};

/**
 * Verifica se o usuário tem categorias padrão e cria se necessário
 * @param userId ID do usuário
 */
export const ensureDefaultCategories = async (userId: string): Promise<void> => {
  try {
    const categoriesRef = collection(db, 'categories');
    const q = query(categoriesRef, where('userId', '==', userId));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      await createDefaultCategories(userId);
    } else {
      console.log('Usuário já possui categorias');
    }
  } catch (error) {
    console.error('Erro ao verificar categorias padrão:', error);
    throw error;
  }
};

/**
 * Exclui uma conta financeira
 * @param accountId ID da conta
 * @param userId ID do usuário proprietário (para verificação)
 */
export const deleteAccount = async (accountId: string, userId: string): Promise<void> => {
  try {
    // Obter conta para verificar propriedade
    const accountRef = doc(db, 'accounts', accountId);
    const accountSnap = await getDoc(accountRef);
    
    if (!accountSnap.exists()) {
      throw new Error('Conta não encontrada');
    }
    
    const existingAccount = accountSnap.data();
    if (existingAccount.userId !== userId) {
      throw new Error('Sem permissão para excluir esta conta');
    }
    
    // Verificar se há transações associadas
    const transactionsQuery = query(
      collection(db, 'transactions'), 
      where('accountId', '==', accountId),
      limit(1)
    );
    
    const transactionsSnap = await getDocs(transactionsQuery);
    if (!transactionsSnap.empty) {
      throw new Error('Não é possível excluir uma conta com transações. Exclua as transações primeiro.');
    }
    
    await deleteDoc(accountRef);
  } catch (error) {
    console.error('Erro ao excluir conta:', error);
    throw error;
  }
}; 