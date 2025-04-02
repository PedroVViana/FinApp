export interface Account {
  id: string;
  name: string;
  type: 'wallet' | 'savings' | 'investment';
  balance: number;
  userId: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  pending?: boolean;
}

export interface Transaction {
  id: string;
  accountId: string;
  type: 'income' | 'expense';
  amount: number;
  category: string;
  description: string;
  date: Date | string;
  tags?: string[];
  isRecurrent?: boolean;
  userId?: string;
  createdAt: Date | string;
  updatedAt: Date | string;
  pending?: boolean;
  pendingOperation?: boolean;
  status?: 'pending' | 'paid' | 'cancelled';
}

export interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense';
  color: string;
  userId?: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  pending?: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  planType: 'free' | 'pro' | 'enterprise';
  isPremium: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface Goal {
  id: string;
  userId: string;
  name: string;
  description?: string;
  targetAmount: number;
  currentAmount: number;
  deadline: Date | string;
  category?: string;
  isCompleted: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
  pending?: boolean;
}

// Predefined categories for free version
export const DEFAULT_CATEGORIES: Omit<Category, 'id'>[] = [
  { name: 'Salário', type: 'income', color: '#4CAF50' },
  { name: 'Alimentação', type: 'expense', color: '#FF5722' },
  { name: 'Transporte', type: 'expense', color: '#2196F3' },
  { name: 'Moradia', type: 'expense', color: '#9C27B0' },
  { name: 'Outros', type: 'expense', color: '#607D8B' },
];

export interface Filter {
  id: string;
  name: string;
  userId: string;
  type: 'transaction' | 'account';
  conditions: {
    field: string;
    operator: 'equals' | 'notEquals' | 'greaterThan' | 'lessThan' | 'contains';
    value: any;
  }[];
  createdAt: Date | string;
  updatedAt: Date | string;
} 