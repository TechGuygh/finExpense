import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db, auth } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, updateDoc, getDocs } from 'firebase/firestore';
import { Budget, Transaction, UserProfile, BudgetRecommendation } from '../types';
import { Card, Button, Input } from './UI';
import { cn, formatCurrency } from '../lib/utils';
import { Target, AlertTriangle, CheckCircle2, Plus, Trash2, Edit2, X, Save, Bell, RefreshCw, BrainCircuit, Sparkles, Trophy, ChevronLeft, ChevronRight,
  Pizza, ShoppingCart, Home, Car, Zap, HeartPulse, GraduationCap, Gamepad2, Users, DollarSign, Briefcase, Plane, Coffee, Smartphone, Shirt
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from 'date-fns';
import { toast } from 'sonner';
import { generateBudgetRecommendations } from '../services/geminiService';
import { FinancialChallenges } from './FinancialChallenges';
import { RecurringTransactions } from './RecurringTransactions';

interface BudgetModuleProps {
  profile: UserProfile | null;
}

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  food: Pizza, dining: Pizza, restaurant: Pizza, meal: Pizza,
  grocery: ShoppingCart, groceries: ShoppingCart, market: ShoppingCart,
  home: Home, housing: Home, rent: Home, mortgage: Home,
  transport: Car, transportation: Car, car: Car, auto: Car, gas: Car, fuel: Car,
  utility: Zap, utilities: Zap, electricity: Zap, water: Zap, internet: Zap,
  health: HeartPulse, medical: HeartPulse, doctor: HeartPulse, fitness: HeartPulse, gym: HeartPulse,
  education: GraduationCap, school: GraduationCap, college: GraduationCap, tuition: GraduationCap,
  entertainment: Gamepad2, game: Gamepad2, movie: Gamepad2, fun: Gamepad2,
  family: Users, kids: Users, child: Users, pets: Users,
  income: DollarSign, salary: Briefcase, paycheck: Briefcase, job: Briefcase,
  travel: Plane, vacation: Plane, flight: Plane, trip: Plane,
  coffee: Coffee, cafe: Coffee,
  phone: Smartphone, mobile: Smartphone, subscription: Smartphone,
  shopping: Shirt, clothes: Shirt, clothing: Shirt, apparel: Shirt
};

const getCategoryIcon = (category: string) => {
  const normalized = category.toLowerCase();
  for (const key in CATEGORY_ICONS) {
    if (normalized.includes(key)) {
      return CATEGORY_ICONS[key];
    }
  }
  return Target; // Fallback
};

export function BudgetModule({ profile }: BudgetModuleProps) {
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [newCategory, setNewCategory] = useState('');
  const [newLimit, setNewLimit] = useState('');
  const [newType, setNewType] = useState<'income' | 'expense'>('expense');
  const [loading, setLoading] = useState(false);
  const [loadingBudgets, setLoadingBudgets] = useState(true);

  const [activeTab, setActiveTab] = useState<'planning' | 'challenges' | 'recurring'>('planning');
  const [recommendations, setRecommendations] = useState<BudgetRecommendation[]>([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);
  const [showRecommendations, setShowRecommendations] = useState(false);

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editCategory, setEditCategory] = useState('');
  const [editLimit, setEditLimit] = useState('');
  const [editType, setEditType] = useState<'income' | 'expense'>('expense');
  const [editRollover, setEditRollover] = useState(false);

  // Notifications state
  const [notifications, setNotifications] = useState<{id: string, message: string, type: 'warning' | 'danger' | 'success'}[]>([]);
  const notifiedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!auth.currentUser) return;

    const formattedMonth = format(selectedMonth, 'yyyy-MM');
    
    const budgetQuery = query(
      collection(db, 'budgets'),
      where('userId', '==', auth.currentUser.uid),
      where('month', '==', formattedMonth)
    );

    const transactionQuery = query(
      collection(db, 'transactions'),
      where('userId', '==', auth.currentUser.uid)
    );

    const unsubscribeBudgets = onSnapshot(budgetQuery, (snapshot) => {
      setBudgets(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Budget)));
      setLoadingBudgets(false);
    });

    const unsubscribeTransactions = onSnapshot(transactionQuery, (snapshot) => {
      setTransactions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction)));
    });

    return () => {
      unsubscribeBudgets();
      unsubscribeTransactions();
    };
  }, [selectedMonth]);

  const processingRolloversRef = React.useRef(false);

  // Process Rollovers
  useEffect(() => {
    const processRollovers = async () => {
      if (!auth.currentUser || loadingBudgets || processingRolloversRef.current) return;
      
      const currentMonth = format(new Date(), 'yyyy-MM');
      const lastMonthDate = subMonths(new Date(), 1);
      const lastMonth = format(lastMonthDate, 'yyyy-MM');

      // Check if we already processed rollovers for this month
      const hasProcessedThisMonth = localStorage.getItem(`rollover_processed_${currentMonth}`);
      if (hasProcessedThisMonth) return;

      processingRolloversRef.current = true;

      try {
        // Get last month's budgets
        const lastMonthBudgetsQuery = query(
          collection(db, 'budgets'),
          where('userId', '==', auth.currentUser.uid),
          where('month', '==', lastMonth)
        );
        
        const lastMonthBudgetsSnap = await getDocs(lastMonthBudgetsQuery);
        const rolloverBudgets = lastMonthBudgetsSnap.docs
          .map(d => ({ id: d.id, ...d.data() } as Budget))
          .filter(b => b.rollover === true);
        
        if (rolloverBudgets.length === 0) {
          localStorage.setItem(`rollover_processed_${currentMonth}`, 'true');
          return;
        }

        // Get last month's transactions to calculate remaining amount
        const lastMonthStart = startOfMonth(lastMonthDate);
        const lastMonthEnd = endOfMonth(lastMonthDate);
        
        const lastMonthTxQuery = query(
          collection(db, 'transactions'),
          where('userId', '==', auth.currentUser.uid)
        );
        
        const lastMonthTxSnap = await getDocs(lastMonthTxQuery);
        const lastMonthTxs = lastMonthTxSnap.docs.map(d => d.data() as Transaction)
          .filter(t => new Date(t.date) >= lastMonthStart && new Date(t.date) <= lastMonthEnd);

        // Process each rollover budget
        for (const budget of rolloverBudgets) {
          const budgetType = budget.type || 'expense';
          const spent = lastMonthTxs
            .filter(t => t.type === budgetType && t.category.toLowerCase() === budget.category.toLowerCase())
            .reduce((acc, t) => acc + t.amount, 0);
            
          const remaining = budget.limit - spent;
          
          if (remaining > 0) {
            // Check if budget already exists for current month
            const existingBudget = budgets.find(b => 
              b.category.toLowerCase() === budget.category.toLowerCase() && 
              (b.type || 'expense') === budgetType
            );
            
            if (existingBudget) {
              // Update existing budget by adding remaining amount
              await updateDoc(doc(db, 'budgets', existingBudget.id), {
                limit: existingBudget.limit + remaining
              });
            } else {
              // Create new budget with rolled over amount
              await addDoc(collection(db, 'budgets'), {
                userId: auth.currentUser!.uid,
                category: budget.category,
                limit: budget.limit + remaining, // Base limit + rollover
                month: currentMonth,
                rollover: true,
                type: budgetType
              });
            }
          }
        }
        
        localStorage.setItem(`rollover_processed_${currentMonth}`, 'true');
      } catch (error) {
        console.error("Error processing rollovers:", error);
      } finally {
        processingRolloversRef.current = false;
      }
    };

    processRollovers();
  }, [loadingBudgets, budgets]);

  const getSpendingForCategory = (category: string, budgetType: 'income' | 'expense' = 'expense') => {
    const start = startOfMonth(selectedMonth);
    const end = endOfMonth(selectedMonth);
    
    return transactions
      .filter(t => 
        t.type === budgetType &&
        t.category.toLowerCase() === category.toLowerCase() && 
        new Date(t.date) >= start && 
        new Date(t.date) <= end
      )
      .reduce((acc, t) => acc + t.amount, 0);
  };

  // Generate Notifications
  useEffect(() => {
    if (loadingBudgets) return;

    const newNotifications: typeof notifications = [];

    budgets.forEach(budget => {
      const isIncome = budget.type === 'income';
      const spent = getSpendingForCategory(budget.category, budget.type || 'expense');
      const percent = (spent / budget.limit) * 100;
      const remaining = budget.limit - spent;

      if (percent >= 100) {
        const id = `over-${budget.id}`;
        const message = isIncome 
          ? `Congratulations! You have reached your ${budget.category} income goal.`
          : `You have exceeded your ${budget.category} budget by ${formatCurrency(Math.abs(remaining), profile?.currency)}.`;
        
        newNotifications.push({ id, type: isIncome ? 'success' : 'danger', message });
        
        if (!notifiedRef.current.has(id)) {
          isIncome ? toast.success(message) : toast.error(message);
          notifiedRef.current.add(id);
        }
      } else if (percent >= 80) {
        const id = `near-${budget.id}`;
        const message = isIncome
          ? `You are close to your ${budget.category} income goal. Only ${formatCurrency(remaining, profile?.currency)} to go!`
          : `You are close to your ${budget.category} budget limit. Only ${formatCurrency(remaining, profile?.currency)} remaining.`;
          
        newNotifications.push({ id, type: 'warning', message });
        
        if (!notifiedRef.current.has(id)) {
          toast.warning(message);
          notifiedRef.current.add(id);
        }
      }
    });

    setNotifications(newNotifications);
  }, [budgets, transactions, profile?.currency]);

  const handleAddBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !newCategory || !newLimit) return;

    setLoading(true);
    try {
      await addDoc(collection(db, 'budgets'), {
        userId: auth.currentUser.uid,
        category: newCategory,
        limit: parseFloat(newLimit),
        month: format(selectedMonth, 'yyyy-MM'),
        rollover: false,
        type: newType
      });
      setNewCategory('');
      setNewLimit('');
      setNewType('expense');
    } catch (error) {
      console.error("Failed to add budget:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBudget = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'budgets', id));
    } catch (error) {
      console.error("Delete failed:", error);
    }
  };

  const startEditing = (budget: Budget) => {
    setEditingId(budget.id);
    setEditCategory(budget.category);
    setEditLimit(budget.limit.toString());
    setEditType(budget.type || 'expense');
    setEditRollover(budget.rollover || false);
  };

  const handleGetRecommendations = async () => {
    if (!auth.currentUser) return;
    setLoadingRecommendations(true);
    setShowRecommendations(true);
    try {
      // Estimate monthly income from current month transactions + some past ones or user's standard income
      const income = transactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + t.amount, 0) || 5000; // default generic fallback if no income set

      const recs = await generateBudgetRecommendations(transactions, income);
      setRecommendations(recs);
    } catch (e) {
      console.error(e);
      toast.error('Failed to generate budget recommendations');
    } finally {
      setLoadingRecommendations(false);
    }
  };

  const applyRecommendation = async (rec: BudgetRecommendation) => {
    if (!auth.currentUser) return;
    setLoading(true);
    try {
      await addDoc(collection(db, 'budgets'), {
        userId: auth.currentUser.uid,
        category: rec.category,
        limit: rec.suggestedLimit,
        month: format(selectedMonth, 'yyyy-MM'),
        rollover: false,
        type: 'expense'
      });
      // Remove the recommendation from the list once applied
      setRecommendations(prev => prev.filter(r => r.category !== rec.category));
      toast.success(`Applied budget for ${rec.category}`);
    } catch (e) {
      toast.error("Failed to apply recommendation.");
    } finally {
      setLoading(false);
    }
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditCategory('');
    setEditLimit('');
    setEditType('expense');
    setEditRollover(false);
  };

  const saveEdit = async (id: string) => {
    if (!editCategory || !editLimit) return;
    
    try {
      await updateDoc(doc(db, 'budgets', id), {
        category: editCategory,
        limit: parseFloat(editLimit),
        rollover: editRollover,
        type: editType
      });
      setEditingId(null);
    } catch (error) {
      console.error("Failed to update budget:", error);
    }
  };

  const dismissNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Target className="w-6 h-6 text-brand-primary" />
          Budget & Challenges
        </h3>
        
        <div className="flex items-center gap-3 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-xl self-start sm:self-auto">
          <button 
            onClick={() => setSelectedMonth(prev => subMonths(prev, 1))}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-white dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-700 transition-all shadow-sm"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-bold text-slate-700 dark:text-slate-300 min-w-[100px] text-center uppercase">
            {format(selectedMonth, 'MMM yyyy')}
          </span>
          <button 
            onClick={() => setSelectedMonth(prev => addMonths(prev, 1))}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-white dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-slate-700 transition-all shadow-sm"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex bg-slate-100 dark:bg-slate-800/50 p-1 rounded-xl w-max mb-6">
        <button
          onClick={() => setActiveTab('planning')}
          className={cn("px-4 py-2 rounded-lg text-sm font-medium transition-colors", activeTab === 'planning' ? "bg-white dark:bg-slate-700 shadow-sm text-brand-primary dark:text-brand-primary-light" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200")}
        >
          Budget Planning
        </button>
        <button
          onClick={() => setActiveTab('challenges')}
          className={cn("px-4 py-2 rounded-lg text-sm font-medium transition-colors", activeTab === 'challenges' ? "bg-white dark:bg-slate-700 shadow-sm text-brand-primary dark:text-brand-primary-light" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200")}
        >
          Financial Challenges
        </button>
        <button
          onClick={() => setActiveTab('recurring')}
          className={cn("px-4 py-2 rounded-lg text-sm font-medium transition-colors", activeTab === 'recurring' ? "bg-white dark:bg-slate-700 shadow-sm text-brand-primary dark:text-brand-primary-light" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200")}
        >
          Recurring
        </button>
      </div>

      {activeTab === 'planning' ? (
        <>
          {/* Notifications Area */}
      <AnimatePresence>
        {notifications.length > 0 && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-2"
          >
            {notifications.map(notification => (
              <motion.div 
                key={notification.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className={cn(
                  "p-3 rounded-xl border flex items-start gap-3 shadow-sm",
                  notification.type === 'danger' ? "bg-rose-50 border-rose-200 dark:bg-rose-900/20 dark:border-rose-800" : 
                  notification.type === 'success' ? "bg-brand-primary/10 border-brand-primary/20 dark:bg-brand-primary-dark/20 dark:border-brand-primary-dark/40" : 
                  "bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800"
                )}
              >
                <Bell className={cn(
                  "w-5 h-5 shrink-0 mt-0.5", 
                  notification.type === 'danger' ? "text-rose-500 dark:text-rose-400" : 
                  notification.type === 'success' ? "text-brand-primary dark:text-brand-primary-light" : 
                  "text-amber-500 dark:text-amber-400"
                )} />
                <div className="flex-1">
                  <p className={cn(
                    "text-sm font-medium", 
                    notification.type === 'danger' ? "text-rose-800 dark:text-rose-200" : 
                    notification.type === 'success' ? "text-brand-primary-dark dark:text-brand-primary-light" : 
                    "text-amber-800 dark:text-amber-200"
                  )}>
                    {notification.message}
                  </p>
                </div>
                <button 
                  onClick={() => dismissNotification(notification.id)}
                  className={cn(
                    "p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/5 transition-colors", 
                    notification.type === 'danger' ? "text-rose-600 dark:text-rose-400" : 
                    notification.type === 'success' ? "text-brand-primary dark:text-brand-primary-light" : 
                    "text-amber-600 dark:text-amber-400"
                  )}
                >
                  <X className="w-4 h-4" />
                </button>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <Card className="p-6 bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
        <form onSubmit={handleAddBudget} className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Type</label>
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value as 'income' | 'expense')}
              className="flex h-10 w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm ring-offset-white dark:ring-offset-slate-950 file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-500 dark:placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Category</label>
            <Input 
              placeholder="e.g. Food, Rent" 
              value={newCategory} 
              onChange={(e) => setNewCategory(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Monthly Limit</label>
            <Input 
              type="number" 
              placeholder="0.00" 
              value={newLimit} 
              onChange={(e) => setNewLimit(e.target.value)}
              required
            />
          </div>
          <Button type="submit" disabled={loading} className="w-full bg-brand-primary hover:bg-brand-primary-hover dark:bg-brand-primary dark:hover:bg-brand-primary-hover">
            <Plus className="w-4 h-4 mr-2" />
            Set Budget
          </Button>
        </form>

        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Need help planning? Let our AI suggest personalized budget limits based on your past spending.
          </p>
          <Button 
            variant="outline" 
            onClick={handleGetRecommendations} 
            disabled={loadingRecommendations}
            className="flex items-center gap-2 border-indigo-200 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-400 dark:hover:bg-indigo-900/30"
          >
            {loadingRecommendations ? <RefreshCw className="w-4 h-4 animate-spin" /> : <BrainCircuit className="w-4 h-4" />}
            Get AI Recommendations
          </Button>
        </div>
      </Card>

      <AnimatePresence>
        {showRecommendations && recommendations.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <Card className="p-6 bg-gradient-to-br from-indigo-50 to-white dark:from-slate-800 dark:to-slate-900 border-indigo-100 dark:border-indigo-900 shadow-inner">
              <div className="flex justify-between items-center mb-4">
                <h4 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  Personalized AI Budget Recommendations
                </h4>
                <button
                  onClick={() => setShowRecommendations(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="grid grid-cols-1 gap-3">
                {recommendations.map((rec, idx) => (
                  <div key={idx} className="bg-white dark:bg-slate-800 p-4 border border-indigo-100 dark:border-indigo-900/50 rounded-xl flex items-center justify-between shadow-sm">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 dark:text-slate-100">{rec.category}</span>
                        <span className="text-sm font-semibold text-brand-primary dark:text-brand-primary-light bg-brand-primary/10 dark:bg-brand-primary-dark/30 px-2 py-0.5 rounded-full">
                          {formatCurrency(rec.suggestedLimit, profile?.currency)}
                        </span>
                      </div>
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{rec.reason}</p>
                    </div>
                    <Button 
                      size="sm" 
                      onClick={() => applyRecommendation(rec)}
                      className="ml-4 shrink-0 bg-indigo-600 hover:bg-indigo-700 text-white"
                    >
                      Apply
                    </Button>
                  </div>
                ))}
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <AnimatePresence mode="popLayout">
          {loadingBudgets && [1, 2, 3, 4].map((i) => (
            <motion.div key={`skel-budget-${i}`} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
              <Card className="relative overflow-hidden border-slate-100 dark:border-slate-700 animate-pulse">
                <div className="flex items-center justify-between mb-4">
                  <div className="space-y-2">
                    <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-24"></div>
                    <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-32"></div>
                  </div>
                  <div className="h-4 bg-slate-200 rounded w-20"></div>
                </div>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden"></div>
              </Card>
            </motion.div>
          ))}
          {!loadingBudgets && budgets.map((budget) => {
            const isIncome = budget.type === 'income';
            const spent = getSpendingForCategory(budget.category, budget.type || 'expense');
            const percent = Math.min((spent / budget.limit) * 100, 100);
            const isOver = spent > budget.limit;
            const isNear = spent >= budget.limit * 0.8 && !isOver;
            const isEditing = editingId === budget.id;

            return (
              <motion.div
                key={budget.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                whileHover={{ y: -4, scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                layout
              >
                <Card className={cn(
                  "relative overflow-hidden group transition-all duration-300 shadow-sm hover:shadow-md cursor-pointer dark:bg-slate-800/50 dark:border-slate-700",
                  isIncome 
                    ? (isOver ? "border-brand-primary-light bg-gradient-to-br from-brand-primary/10 to-brand-primary/5 dark:from-brand-primary-dark/30 dark:to-brand-primary-dark/10" : isNear ? "border-amber-200 bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-900/30 dark:to-amber-900/10 dark:border-amber-800" : "border-slate-200 bg-white hover:border-brand-primary-light dark:hover:border-brand-primary-dark")
                    : (isOver ? "border-rose-200 bg-gradient-to-br from-rose-50 to-rose-100/50 dark:from-rose-900/30 dark:to-rose-900/10 dark:border-rose-800" : isNear ? "border-amber-200 bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-900/30 dark:to-amber-900/10 dark:border-amber-800" : "border-slate-200 bg-white hover:border-brand-primary-light dark:hover:border-brand-primary-dark")
                )}>
                  {isEditing ? (
                    <div className="p-5 space-y-4">
                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Type</label>
                          <select
                            value={editType}
                            onChange={(e) => setEditType(e.target.value as 'income' | 'expense')}
                            className="flex h-8 w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-2 py-1 text-sm ring-offset-white dark:ring-offset-slate-950 file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-500 dark:placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <option value="expense">Expense</option>
                            <option value="income">Income</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Category</label>
                          <Input 
                            value={editCategory} 
                            onChange={(e) => setEditCategory(e.target.value)} 
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Limit</label>
                          <Input 
                            type="number" 
                            value={editLimit} 
                            onChange={(e) => setEditLimit(e.target.value)} 
                            className="h-8 text-sm"
                          />
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={editRollover} 
                            onChange={(e) => setEditRollover(e.target.checked)}
                            className="w-4 h-4 text-brand-primary rounded border-slate-300 focus:ring-brand-primary"
                          />
                          <span className="text-sm text-slate-600 dark:text-slate-300 flex items-center gap-1">
                            <RefreshCw className="w-3 h-3" />
                            Rollover remaining
                          </span>
                        </label>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" onClick={cancelEditing} className="h-8 px-2 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800">
                            <X className="w-4 h-4" />
                          </Button>
                          <Button size="sm" onClick={() => saveEdit(budget.id)} className="h-8 px-3 bg-brand-primary hover:bg-brand-primary-dark text-white">
                            <Save className="w-4 h-4 mr-1" /> Save
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-5">
                      {/* Top Section: Category name and icon */}
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center shadow-sm",
                            isIncome ? "bg-brand-primary/10 text-brand-primary dark:bg-brand-primary-dark/30 dark:text-brand-primary-light" : "bg-brand-secondary/10 text-brand-secondary dark:bg-brand-secondary-dark/30 dark:text-brand-secondary-light"
                          )}>
                            {(() => {
                              const IconComponent = getCategoryIcon(budget.category);
                              return <IconComponent className="w-5 h-5" />;
                            })()}
                          </div>
                          <div>
                            <h4 className="text-lg font-bold text-slate-900 dark:text-slate-100 leading-tight">{budget.category}</h4>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={cn(
                                "text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider",
                                budget.type === 'income' ? "bg-brand-primary/10 text-brand-primary dark:bg-brand-primary-dark/30 dark:text-brand-primary-light" : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                              )}>
                                {budget.type || 'expense'}
                              </span>
                              {budget.rollover && (
                                <span className="bg-brand-secondary/10 text-brand-secondary dark:bg-brand-secondary-dark/30 dark:text-brand-secondary-light text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1">
                                  <RefreshCw className="w-3 h-3" /> Rollover
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={(e) => { e.stopPropagation(); startEditing(budget); }}
                            className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-brand-primary dark:hover:text-brand-primary-light hover:bg-brand-primary-light/30 dark:hover:bg-brand-primary-dark/30 rounded-lg transition-all"
                            title="Edit Budget"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleDeleteBudget(budget.id); }}
                            className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg transition-all"
                            title="Delete Budget"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Middle Section: Budget amount vs. spent amount */}
                      <div className="flex items-end justify-between mb-3">
                        <div>
                          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                            {isIncome ? 'Earned' : 'Spent'}
                          </p>
                          <div className="flex items-baseline gap-1">
                            <span className={cn(
                              "text-2xl font-bold",
                              isIncome ? (isOver ? "text-brand-primary" : "text-slate-900 dark:text-slate-100") : (isOver ? "text-rose-600 dark:text-rose-400" : "text-slate-900 dark:text-slate-100")
                            )}>
                              {formatCurrency(spent, profile?.currency)}
                            </span>
                            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                              / {formatCurrency(budget.limit, profile?.currency)}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                            Remaining
                          </p>
                          <span className={cn(
                            "text-sm font-bold",
                            isIncome ? (isOver ? "text-brand-primary" : "text-slate-700 dark:text-slate-300") : (isOver ? "text-rose-600 dark:text-rose-400" : "text-slate-700 dark:text-slate-300")
                          )}>
                            {formatCurrency(Math.abs(budget.limit - spent), profile?.currency)}
                          </span>
                        </div>
                      </div>

                      {/* Bottom Section: Progress indicator */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center">
                          <div className={cn(
                            "flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full",
                            isOver ? (isIncome ? "text-brand-primary dark:text-brand-primary-light bg-brand-primary/10 dark:bg-brand-primary-dark/30" : "text-rose-700 dark:text-rose-400 bg-rose-100 dark:bg-rose-900/30") :
                            isNear ? "text-amber-700 dark:text-amber-500 bg-amber-100 dark:bg-amber-900/30" :
                            "text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800"
                          )}>
                            {isOver ? (isIncome ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />) :
                             isNear ? <AlertTriangle className="w-3 h-3" /> :
                             (isIncome ? <Target className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />)}
                            {isOver ? (isIncome ? 'Goal Met' : 'Over Budget') :
                             isNear ? 'Near Limit' :
                             (isIncome ? 'In Progress' : 'On Track')}
                          </div>
                          <span className="text-xs font-bold text-slate-500 dark:text-slate-400">{percent.toFixed(0)}%</span>
                        </div>
                        <div className="h-2.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden shadow-inner">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${percent}%` }}
                            transition={{ duration: 1, ease: "easeOut" }}
                            className={cn(
                              "h-full rounded-full relative",
                              isIncome 
                                ? (isOver ? "bg-brand-primary" : isNear ? "bg-amber-500" : "bg-slate-400 dark:bg-slate-600")
                                : (isOver ? "bg-rose-500" : isNear ? "bg-amber-500" : "bg-brand-primary")
                            )}
                          >
                            <div className="absolute inset-0 bg-white/20 w-full h-full" style={{ backgroundImage: 'linear-gradient(45deg,rgba(255,255,255,.15) 25%,transparent 25%,transparent 50%,rgba(255,255,255,.15) 50%,rgba(255,255,255,.15) 75%,transparent 75%,transparent)', backgroundSize: '1rem 1rem' }} />
                          </motion.div>
                        </div>
                      </div>
                    </div>
                  )}
                </Card>
              </motion.div>
            );
          })}
        </AnimatePresence>
        {!loadingBudgets && budgets.length === 0 && (
          <div className="col-span-full py-12 text-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl bg-slate-50/50 dark:bg-slate-800/50">
            <Target className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <h4 className="text-slate-700 dark:text-slate-300 font-medium">No budgets set</h4>
            <p className="text-slate-400 dark:text-slate-500 text-sm mt-1">Plan your spending for this month to stay on track.</p>
          </div>
        )}
      </div>
      </>
      ) : activeTab === 'challenges' ? (
        <FinancialChallenges profile={profile} transactions={transactions} />
      ) : (
        <RecurringTransactions profile={profile} />
      )}
    </div>
  );
}
