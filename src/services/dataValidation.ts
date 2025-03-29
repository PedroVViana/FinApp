import { Transaction, Account, Goal } from '../types';

/**
 * Funções de validação de dados para garantir consistência com as regras do Firestore
 */

/**
 * Valida os dados de uma transação
 * @param transaction Objeto de transação a ser validado
 * @returns Objeto com resultado da validação e mensagens de erro
 */
export const validateTransaction = (transaction: Partial<Transaction>): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  // Verificar campos obrigatórios
  if (!transaction.accountId) {
    errors.push('Conta é obrigatória');
  }
  
  if (!transaction.type) {
    errors.push('Tipo de transação é obrigatório');
  } else if (transaction.type !== 'income' && transaction.type !== 'expense') {
    errors.push('Tipo de transação inválido. Use "income" ou "expense"');
  }
  
  if (!transaction.amount || transaction.amount <= 0) {
    errors.push('Valor deve ser maior que zero');
  }
  
  if (!transaction.category) {
    errors.push('Categoria é obrigatória');
  }
  
  if (!transaction.description) {
    errors.push('Descrição é obrigatória');
  }
  
  if (!transaction.date) {
    errors.push('Data é obrigatória');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * Valida os dados de uma conta financeira
 * @param account Objeto de conta a ser validado
 * @returns Objeto com resultado da validação e mensagens de erro
 */
export const validateAccount = (account: Partial<Account>): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (!account.name) {
    errors.push('Nome da conta é obrigatório');
  }
  
  if (!account.type) {
    errors.push('Tipo de conta é obrigatório');
  } else if (
    account.type !== 'wallet' && 
    account.type !== 'savings' && 
    account.type !== 'investment'
  ) {
    errors.push('Tipo de conta inválido. Use "wallet", "savings" ou "investment"');
  }
  
  // Verifica se balance é um número (pode ser 0)
  if (account.balance === undefined || account.balance === null || isNaN(account.balance)) {
    errors.push('Saldo inicial deve ser um número');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * Valida os dados de uma meta financeira
 * @param goal Objeto de meta a ser validado
 * @returns Objeto com resultado da validação e mensagens de erro
 */
export const validateGoal = (goal: Partial<Goal>): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  
  if (!goal.name) {
    errors.push('Nome da meta é obrigatório');
  }
  
  if (!goal.targetAmount || goal.targetAmount <= 0) {
    errors.push('Valor alvo deve ser maior que zero');
  }
  
  if (!goal.currentAmount && goal.currentAmount !== 0) {
    errors.push('Valor atual é obrigatório');
  } else if (goal.currentAmount < 0) {
    errors.push('Valor atual não pode ser negativo');
  }
  
  if (!goal.deadline) {
    errors.push('Data limite é obrigatória');
  } else {
    const deadlineDate = new Date(goal.deadline);
    const today = new Date();
    if (deadlineDate < today) {
      errors.push('A data limite não pode ser no passado');
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}; 