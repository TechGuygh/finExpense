export type TransactionType = 'income' | 'expense';

export interface Transaction {
  id: string;
  userId: string;
  amount: number;
  type: TransactionType;
  category: string;
  description: string;
  date: string;
  isAiCategorized?: boolean;
}

export interface Budget {
  id: string;
  userId: string;
  category: string;
  limit: number;
  month: string;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  currency: string;
  createdAt: string;
}

export interface SpendingInsight {
  title: string;
  content: string;
  type: 'info' | 'warning' | 'success';
}
