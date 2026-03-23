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

export interface SavingsGoal {
  id: string;
  userId: string;
  title: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string;
  category: string;
  createdAt: string;
}

export interface Investment {
  id: string;
  userId: string;
  name: string;
  category: string;
  amount: number;
  expectedReturnRate: number;
  createdAt: string;
}

export interface RecurringTransaction {
  id: string;
  userId: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  description: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  startDate: string;
  nextDate: string;
  createdAt: string;
}

export interface InvestmentRecommendation {
  assetClass: string;
  allocationPercentage: number;
  reasoning: string;
  riskLevel: 'low' | 'medium' | 'high';
  expectedReturn: number;
}

export interface ScenarioSimulation {
  scenarioName: string;
  projectedValue: number;
  description: string;
}

export interface AIInvestmentPlan {
  riskProfile: string;
  summary: string;
  recommendations: InvestmentRecommendation[];
  tips: string[];
  behavioralNudge: string;
  scenarios: ScenarioSimulation[];
}
