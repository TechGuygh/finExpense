import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { Budget, Transaction, UserProfile } from '../types';
import { Card, Button, Input } from './UI';
import { cn, formatCurrency } from '../lib/utils';
import { Target, AlertTriangle, CheckCircle2, Plus, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, startOfMonth, endOfMonth } from 'date-fns';

interface BudgetModuleProps {
  profile: UserProfile | null;
}

export function BudgetModule({ profile }: BudgetModuleProps) {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [newCategory, setNewCategory] = useState('');
  const [newLimit, setNewLimit] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingBudgets, setLoadingBudgets] = useState(true);

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
      where('userId', '==', auth.currentUser.uid),
      where('type', '==', 'expense')
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

  const handleAddBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !newCategory || !newLimit) return;

    setLoading(true);
    try {
      await addDoc(collection(db, 'budgets'), {
        userId: auth.currentUser.uid,
        category: newCategory,
        limit: parseFloat(newLimit),
        month: format(new Date(), 'yyyy-MM')
      });
      setNewCategory('');
      setNewLimit('');
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

  const getSpendingForCategory = (category: string) => {
    const start = startOfMonth(new Date());
    const end = endOfMonth(new Date());
    
    return transactions
      .filter(t => 
        t.category.toLowerCase() === category.toLowerCase() && 
        new Date(t.date) >= start && 
        new Date(t.date) <= end
      )
      .reduce((acc, t) => acc + t.amount, 0);
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

      <Card className="p-6 bg-slate-50 border-slate-200">
        <form onSubmit={handleAddBudget} className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
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
            const spent = getSpendingForCategory(budget.category);
            const percent = Math.min((spent / budget.limit) * 100, 100);
            const isOver = spent > budget.limit;
            const isNear = spent > budget.limit * 0.8 && !isOver;

            return (
              <motion.div
                key={budget.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                layout
              >
                <Card className={cn(
                  "relative overflow-hidden group",
                  isOver ? "border-rose-200 bg-rose-50/10" : isNear ? "border-amber-200 bg-amber-50/10" : "border-slate-100"
                )}>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="text-lg font-bold text-slate-900">{budget.category}</h4>
                      <p className="text-xs text-slate-500">
                        {formatCurrency(spent, profile?.currency)} of {formatCurrency(budget.limit, profile?.currency)} spent
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {isOver ? (
                        <div className="flex items-center gap-1 text-rose-600 text-xs font-bold uppercase tracking-wider">
                          <AlertTriangle className="w-4 h-4" />
                          Over Budget
                        </div>
                      ) : isNear ? (
                        <div className="flex items-center gap-1 text-amber-600 text-xs font-bold uppercase tracking-wider">
                          <AlertTriangle className="w-4 h-4" />
                          Near Limit
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-emerald-600 text-xs font-bold uppercase tracking-wider">
                          <CheckCircle2 className="w-4 h-4" />
                          On Track
                        </div>
                      )}
                      <button 
                        onClick={() => handleDeleteBudget(budget.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${percent}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                      className={cn(
                        "h-full rounded-full",
                        isOver ? "bg-rose-500" : isNear ? "bg-amber-500" : "bg-emerald-500"
                      )}
                    />
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </AnimatePresence>
        {!loadingBudgets && budgets.length === 0 && (
          <div className="col-span-full py-12 text-center border-2 border-dashed border-slate-200 rounded-2xl">
            <p className="text-slate-400 text-sm">No budgets set for this month. Plan your spending now!</p>
          </div>
        )}
      </div>
    </div>
  );
}
