import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db, auth } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, updateDoc, getDocs } from 'firebase/firestore';
import { Budget, Transaction, UserProfile } from '../types';
import { Card, Button, Input } from './UI';
import { cn, formatCurrency } from '../lib/utils';
import { Target, AlertTriangle, CheckCircle2, Plus, Trash2, Edit2, X, Save, Bell, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { toast } from 'sonner';

interface BudgetModuleProps {
  profile: UserProfile | null;
}

export function BudgetModule({ profile }: BudgetModuleProps) {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [newCategory, setNewCategory] = useState('');
  const [newLimit, setNewLimit] = useState('');
  const [newType, setNewType] = useState<'income' | 'expense'>('expense');
  const [loading, setLoading] = useState(false);
  const [loadingBudgets, setLoadingBudgets] = useState(true);

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

    const currentMonth = format(new Date(), 'yyyy-MM');
    
    const budgetQuery = query(
      collection(db, 'budgets'),
      where('userId', '==', auth.currentUser.uid),
      where('month', '==', currentMonth)
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
  }, []);

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
    const start = startOfMonth(new Date());
    const end = endOfMonth(new Date());
    
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
        month: format(new Date(), 'yyyy-MM'),
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
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Target className="w-6 h-6 text-indigo-600" />
          Monthly Budgets
        </h3>
        <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-full uppercase tracking-wider">
          {format(new Date(), 'MMMM yyyy')}
        </span>
      </div>

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
                  notification.type === 'danger' ? "bg-rose-50 border-rose-200" : 
                  notification.type === 'success' ? "bg-emerald-50 border-emerald-200" : 
                  "bg-amber-50 border-amber-200"
                )}
              >
                <Bell className={cn(
                  "w-5 h-5 shrink-0 mt-0.5", 
                  notification.type === 'danger' ? "text-rose-500" : 
                  notification.type === 'success' ? "text-emerald-500" : 
                  "text-amber-500"
                )} />
                <div className="flex-1">
                  <p className={cn(
                    "text-sm font-medium", 
                    notification.type === 'danger' ? "text-rose-800" : 
                    notification.type === 'success' ? "text-emerald-800" : 
                    "text-amber-800"
                  )}>
                    {notification.message}
                  </p>
                </div>
                <button 
                  onClick={() => dismissNotification(notification.id)}
                  className={cn(
                    "p-1 rounded-md hover:bg-black/5 transition-colors", 
                    notification.type === 'danger' ? "text-rose-600" : 
                    notification.type === 'success' ? "text-emerald-600" : 
                    "text-amber-600"
                  )}
                >
                  <X className="w-4 h-4" />
                </button>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <Card className="p-6 bg-slate-50 border-slate-200">
        <form onSubmit={handleAddBudget} className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Type</label>
            <select
              value={newType}
              onChange={(e) => setNewType(e.target.value as 'income' | 'expense')}
              className="flex h-10 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Category</label>
            <Input 
              placeholder="e.g. Food, Rent" 
              value={newCategory} 
              onChange={(e) => setNewCategory(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Monthly Limit</label>
            <Input 
              type="number" 
              placeholder="0.00" 
              value={newLimit} 
              onChange={(e) => setNewLimit(e.target.value)}
              required
            />
          </div>
          <Button type="submit" disabled={loading} className="w-full">
            <Plus className="w-4 h-4 mr-2" />
            Set Budget
          </Button>
        </form>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <AnimatePresence mode="popLayout">
          {loadingBudgets && [1, 2, 3, 4].map((i) => (
            <motion.div key={`skel-budget-${i}`} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}>
              <Card className="relative overflow-hidden border-slate-100 animate-pulse">
                <div className="flex items-center justify-between mb-4">
                  <div className="space-y-2">
                    <div className="h-5 bg-slate-200 rounded w-24"></div>
                    <div className="h-3 bg-slate-200 rounded w-32"></div>
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
                layout
              >
                <Card className={cn(
                  "relative overflow-hidden group transition-colors",
                  isIncome 
                    ? (isOver ? "border-emerald-200 bg-emerald-50/30" : isNear ? "border-amber-200 bg-amber-50/30" : "border-slate-200 hover:border-emerald-200")
                    : (isOver ? "border-rose-200 bg-rose-50/30" : isNear ? "border-amber-200 bg-amber-50/30" : "border-slate-200 hover:border-emerald-200")
                )}>
                  {isEditing ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Type</label>
                          <select
                            value={editType}
                            onChange={(e) => setEditType(e.target.value as 'income' | 'expense')}
                            className="flex h-8 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-950 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <option value="expense">Expense</option>
                            <option value="income">Income</option>
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Category</label>
                          <Input 
                            value={editCategory} 
                            onChange={(e) => setEditCategory(e.target.value)} 
                            className="h-8 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Limit</label>
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
                            className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                          />
                          <span className="text-sm text-slate-600 flex items-center gap-1">
                            <RefreshCw className="w-3 h-3" />
                            Rollover remaining
                          </span>
                        </label>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" onClick={cancelEditing} className="h-8 px-2">
                            <X className="w-4 h-4" />
                          </Button>
                          <Button size="sm" onClick={() => saveEdit(budget.id)} className="h-8 px-3 bg-emerald-600 hover:bg-emerald-700">
                            <Save className="w-4 h-4 mr-1" /> Save
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-lg font-bold text-slate-900">{budget.category}</h4>
                            <span className={cn(
                              "text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider",
                              budget.type === 'income' ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-700"
                            )}>
                              {budget.type || 'expense'}
                            </span>
                            {budget.rollover && (
                              <span className="bg-indigo-100 text-indigo-700 text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1" title="Unspent amount rolls over to next month">
                                <RefreshCw className="w-3 h-3" /> Rollover
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">
                            <span className={cn("font-medium", isIncome ? (isOver ? "text-emerald-600" : "text-slate-700") : (isOver ? "text-rose-600" : "text-slate-700"))}>
                              {formatCurrency(spent, profile?.currency)}
                            </span>
                            {' '}of {formatCurrency(budget.limit, profile?.currency)} {isIncome ? 'earned' : 'spent'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {isOver ? (
                            <div className={cn("flex items-center gap-1 text-xs font-bold uppercase tracking-wider px-2 py-1 rounded-full", isIncome ? "text-emerald-600 bg-emerald-100" : "text-rose-600 bg-rose-100")}>
                              {isIncome ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                              {isIncome ? 'Goal Met' : 'Over Budget'}
                            </div>
                          ) : isNear ? (
                            <div className="flex items-center gap-1 text-amber-600 text-xs font-bold uppercase tracking-wider bg-amber-100 px-2 py-1 rounded-full">
                              <AlertTriangle className="w-3 h-3" />
                              Near Limit
                            </div>
                          ) : (
                            <div className={cn("flex items-center gap-1 text-xs font-bold uppercase tracking-wider px-2 py-1 rounded-full", isIncome ? "text-slate-500 bg-slate-100" : "text-emerald-600 bg-emerald-100")}>
                              {isIncome ? <Target className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                              {isIncome ? 'In Progress' : 'On Track'}
                            </div>
                          )}
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => startEditing(budget)}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                              title="Edit Budget"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleDeleteBudget(budget.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                              title="Delete Budget"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden shadow-inner">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${percent}%` }}
                          transition={{ duration: 1, ease: "easeOut" }}
                          className={cn(
                            "h-full rounded-full relative",
                            isIncome 
                              ? (isOver ? "bg-emerald-500" : isNear ? "bg-amber-500" : "bg-slate-400")
                              : (isOver ? "bg-rose-500" : isNear ? "bg-amber-500" : "bg-emerald-500")
                          )}
                        >
                          <div className="absolute inset-0 bg-white/20 w-full h-full" style={{ backgroundImage: 'linear-gradient(45deg,rgba(255,255,255,.15) 25%,transparent 25%,transparent 50%,rgba(255,255,255,.15) 50%,rgba(255,255,255,.15) 75%,transparent 75%,transparent)', backgroundSize: '1rem 1rem' }} />
                        </motion.div>
                      </div>
                      <div className="mt-2 flex justify-between text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                        <span>0%</span>
                        <span>{percent.toFixed(0)}%</span>
                        <span>100%</span>
                      </div>
                    </>
                  )}
                </Card>
              </motion.div>
            );
          })}
        </AnimatePresence>
        {!loadingBudgets && budgets.length === 0 && (
          <div className="col-span-full py-12 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
            <Target className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h4 className="text-slate-700 font-medium">No budgets set</h4>
            <p className="text-slate-400 text-sm mt-1">Plan your spending for this month to stay on track.</p>
          </div>
        )}
      </div>
    </div>
  );
}
