import React, { useEffect, useState, useMemo } from 'react';
import { db, auth } from '../firebase';
import { collection, query, where, onSnapshot, orderBy, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { Transaction, SpendingInsight, UserProfile, Budget, SavingsGoal, Investment } from '../types';
import { Card, Button, Input } from './UI';
import { cn, formatCurrency, exportToCSV, exportToPDF, exportToWord } from '../lib/utils';
import { getSpendingInsights, forecastExpenses } from '../services/geminiService';
import { CurrencyConverter } from './CurrencyConverter';
import { 
  TrendingUp, TrendingDown, DollarSign, Calendar, 
  Trash2, Sparkles, BrainCircuit, ArrowUpRight, ArrowDownRight,
  PieChart as PieChartIcon, BarChart as BarChartIcon,
  Download, Filter, Search, X, Edit2, Check
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Cell, PieChart, Pie, Legend 
} from 'recharts';
import { format, parseISO, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';

interface DashboardProps {
  profile: UserProfile | null;
}

export function Dashboard({ profile }: DashboardProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [insights, setInsights] = useState<SpendingInsight[]>([]);
  const [forecast, setForecast] = useState<number>(0);
  const [loadingInsights, setLoadingInsights] = useState(false);

  // Filter states
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Transaction>>({});
  const [loadingTransactions, setLoadingTransactions] = useState(true);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, 'transactions'),
      where('userId', '==', auth.currentUser.uid),
      orderBy('date', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
      setTransactions(data);
      setLoadingTransactions(false);
    });

    const qBudgets = query(collection(db, 'budgets'), where('userId', '==', auth.currentUser.uid));
    const unsubBudgets = onSnapshot(qBudgets, (snapshot) => {
      setBudgets(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Budget)));
    });

    const qGoals = query(collection(db, 'savingsGoals'), where('userId', '==', auth.currentUser.uid));
    const unsubGoals = onSnapshot(qGoals, (snapshot) => {
      setSavingsGoals(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SavingsGoal)));
    });

    const qInv = query(collection(db, 'investments'), where('userId', '==', auth.currentUser.uid));
    const unsubInv = onSnapshot(qInv, (snapshot) => {
      setInvestments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Investment)));
    });

    return () => {
      unsubscribe();
      unsubBudgets();
      unsubGoals();
      unsubInv();
    };
  }, []);

  const categories = useMemo(() => {
    const cats = new Set(transactions.map(t => t.category));
    return ['All', ...Array.from(cats)].sort();
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const matchesCategory = categoryFilter === 'All' || t.category === categoryFilter;
      const matchesSearch = t.description.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           t.category.toLowerCase().includes(searchQuery.toLowerCase());
      
      let matchesDate = true;
      if (startDate || endDate) {
        const tDate = parseISO(t.date);
        const start = startDate ? startOfDay(parseISO(startDate)) : new Date(0);
        const end = endDate ? endOfDay(parseISO(endDate)) : new Date(8640000000000000);
        matchesDate = isWithinInterval(tDate, { start, end });
      }

      return matchesCategory && matchesSearch && matchesDate;
    });
  }, [transactions, categoryFilter, searchQuery, startDate, endDate]);

  const fetchInsights = async () => {
    if (transactions.length === 0) return;
    setLoadingInsights(true);
    try {
      const [newInsights, newForecast] = await Promise.all([
        getSpendingInsights(transactions, budgets, savingsGoals, investments),
        forecastExpenses(transactions)
      ]);
      setInsights(newInsights);
      setForecast(newForecast);
    } catch (error) {
      console.error("Failed to fetch insights:", error);
    } finally {
      setLoadingInsights(false);
    }
  };

  const totalIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((acc, t) => acc + t.amount, 0);

  const totalExpenses = transactions
    .filter(t => t.type === 'expense')
    .reduce((acc, t) => acc + t.amount, 0);

  const balance = totalIncome - totalExpenses;

  const categoryData = transactions
    .filter(t => t.type === 'expense')
    .reduce((acc: any[], t) => {
      const existing = acc.find(item => item.name === t.category);
      if (existing) {
        existing.value += t.amount;
      } else {
        acc.push({ name: t.category, value: t.amount });
      }
      return acc;
    }, []);

  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  const handleDelete = (id: string) => {
    setDeleteConfirmId(id);
  };

  const confirmDelete = async () => {
    if (!deleteConfirmId) return;
    try {
      await deleteDoc(doc(db, 'transactions', deleteConfirmId));
      setDeleteConfirmId(null);
    } catch (error) {
      console.error("Delete failed:", error);
    }
  };

  const startEdit = (t: Transaction) => {
    setEditingId(t.id);
    setEditForm({ ...t });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  const saveEdit = async () => {
    if (!editingId) return;
    try {
      await updateDoc(doc(db, 'transactions', editingId), {
        description: editForm.description,
        amount: Number(editForm.amount),
        category: editForm.category,
        type: editForm.type,
        date: editForm.date
      });
      setEditingId(null);
      setEditForm({});
    } catch (error) {
      console.error("Failed to update transaction:", error);
    }
  };

  const handleCurrencyChange = async (newCurrency: string) => {
    if (!auth.currentUser) return;
    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        currency: newCurrency
      });
    } catch (error) {
      console.error("Failed to update currency:", error);
    }
  };

  const clearFilters = () => {
    setCategoryFilter('All');
    setStartDate('');
    setEndDate('');
    setSearchQuery('');
  };

  return (
    <div className="space-y-8">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="bg-gradient-to-br from-[#279d48] to-[#f29111] text-white border-none shadow-lg shadow-orange-200/50">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-white/20 rounded-lg">
                <DollarSign className="w-6 h-6" />
              </div>
              <select 
                value={profile?.currency || 'USD'}
                onChange={(e) => handleCurrencyChange(e.target.value)}
                className="bg-white/20 text-white text-xs font-medium px-2 py-1 rounded-full outline-none border-none cursor-pointer hover:bg-white/30 transition-colors"
                aria-label="Select Currency"
              >
                <option value="USD" className="text-slate-900">USD ($)</option>
                <option value="EUR" className="text-slate-900">EUR (€)</option>
                <option value="GBP" className="text-slate-900">GBP (£)</option>
                <option value="JPY" className="text-slate-900">JPY (¥)</option>
                <option value="CAD" className="text-slate-900">CAD (CA$)</option>
                <option value="AUD" className="text-slate-900">AUD (AU$)</option>
                <option value="NGN" className="text-slate-900">NGN (₦)</option>
                <option value="GHS" className="text-slate-900">GHS (₵)</option>
              </select>
            </div>
            <h2 className="text-3xl font-bold">{formatCurrency(balance, profile?.currency)}</h2>
            <p className="text-white/80 text-sm mt-2">Total net worth tracked</p>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="border-emerald-100 bg-emerald-50/30">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600">
                <TrendingUp className="w-6 h-6" />
              </div>
              <span className="text-xs font-medium text-emerald-600 bg-emerald-100 px-2 py-1 rounded-full">Income</span>
            </div>
            <h2 className="text-3xl font-bold text-slate-900">{formatCurrency(totalIncome, profile?.currency)}</h2>
            <div className="flex items-center gap-1 text-emerald-600 text-xs mt-2 font-medium">
              <ArrowUpRight className="w-3 h-3" />
              <span>Total earnings</span>
            </div>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="border-rose-100 bg-rose-50/30">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-rose-100 rounded-lg text-rose-600">
                <TrendingDown className="w-6 h-6" />
              </div>
              <span className="text-xs font-medium text-rose-600 bg-rose-100 px-2 py-1 rounded-full">Expenses</span>
            </div>
            <h2 className="text-3xl font-bold text-slate-900">{formatCurrency(totalExpenses, profile?.currency)}</h2>
            <div className="flex items-center gap-1 text-rose-600 text-xs mt-2 font-medium">
              <ArrowDownRight className="w-3 h-3" />
              <span>Total spending</span>
            </div>
          </Card>
        </motion.div>
      </div>

      {/* AI Insights Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <BrainCircuit className="w-6 h-6 text-indigo-600" />
            AI Financial Insights
          </h3>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchInsights} 
            disabled={loadingInsights || transactions.length === 0}
            className="gap-2"
          >
            {loadingInsights ? <Sparkles className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Generate Insights
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <AnimatePresence mode="popLayout">
            {loadingInsights && [1, 2, 3, 4].map((i) => (
              <motion.div key={`skel-${i}`} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}>
                <Card className="p-4 border-l-4 border-l-slate-200 bg-slate-50/50 animate-pulse">
                  <div className="h-4 bg-slate-200 rounded w-1/2 mb-3"></div>
                  <div className="h-3 bg-slate-200 rounded w-full mb-2"></div>
                  <div className="h-3 bg-slate-200 rounded w-4/5"></div>
                </Card>
              </motion.div>
            ))}
            {!loadingInsights && forecast > 0 && (
              <motion.div key="forecast" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}>
                <Card className="bg-slate-900 text-white border-none p-4">
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Next Month Forecast</p>
                  <p className="text-2xl font-bold mt-1">{formatCurrency(forecast, profile?.currency)}</p>
                  <p className="text-[10px] text-slate-500 mt-2">Based on spending patterns</p>
                </Card>
              </motion.div>
            )}
            {!loadingInsights && insights.map((insight, idx) => (
              <motion.div
                key={`insight-${idx}`}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ delay: idx * 0.1 }}
              >
                <Card className={cn(
                  "p-4 border-l-4",
                  insight.type === 'success' ? "border-l-emerald-500 bg-emerald-50/20" :
                  insight.type === 'warning' ? "border-l-rose-500 bg-rose-50/20" :
                  "border-l-indigo-500 bg-indigo-50/20"
                )}>
                  <h4 className="text-sm font-bold text-slate-900">{insight.title}</h4>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">{insight.content}</p>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
          {insights.length === 0 && !loadingInsights && (
            <div className="col-span-full py-12 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
              <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <BrainCircuit className="w-8 h-8" />
              </div>
              <h4 className="text-lg font-bold text-slate-900 mb-2">Unlock AI Financial Insights</h4>
              <p className="text-slate-500 text-sm max-w-md mx-auto mb-6">
                Let our AI analyze your spending patterns, budget adherence, and savings progress to provide personalized recommendations and identify potential savings.
              </p>
              <Button onClick={fetchInsights} disabled={transactions.length === 0} className="gap-2">
                <Sparkles className="w-4 h-4" />
                Generate Insights Now
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Charts and Currency Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <BarChartIcon className="w-5 h-5 text-indigo-600" />
                Spending by Category
              </h3>
            </div>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={categoryData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                  <Tooltip 
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: number) => formatCurrency(value, profile?.currency)}
                  />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {categoryData.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <PieChartIcon className="w-5 h-5 text-indigo-600" />
                Expense Distribution
              </h3>
            </div>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {categoryData.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => formatCurrency(value, profile?.currency)} />
                  <Legend verticalAlign="bottom" height={36}/>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
        
        <div className="lg:col-span-1">
          <CurrencyConverter defaultCurrency={profile?.currency || 'USD'} />
        </div>
      </div>

      {/* Recent Transactions */}
      <Card className="p-0 overflow-hidden">
        <div className="p-6 border-b border-slate-100 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-600" />
              Recent Transactions
            </h3>
            <div className="flex items-center gap-2">
              <div className="relative hidden sm:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input 
                  placeholder="Search transactions..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 text-xs w-48 lg:w-64"
                />
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowFilters(!showFilters)}
                className={cn(showFilters && "bg-slate-100")}
              >
                <Filter className="w-4 h-4 mr-2" />
                Filters
              </Button>
              <div className="relative">
                <Button variant="outline" size="sm" onClick={() => setShowExportMenu(!showExportMenu)} disabled={filteredTransactions.length === 0}>
                  <Download className="w-4 h-4 mr-2" />
                  Export
                </Button>
                {showExportMenu && (
                  <div className="absolute right-0 mt-2 w-32 bg-white rounded-xl shadow-lg border border-slate-100 py-1 z-10">
                    <button onClick={() => { exportToCSV(filteredTransactions, `finai_transactions_${format(new Date(), 'yyyy_MM_dd')}.csv`, profile?.currency); setShowExportMenu(false); }} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">CSV</button>
                    <button onClick={() => { exportToPDF(filteredTransactions, `finai_transactions_${format(new Date(), 'yyyy_MM_dd')}.pdf`, profile?.currency); setShowExportMenu(false); }} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">PDF</button>
                    <button onClick={() => { exportToWord(filteredTransactions, `finai_transactions_${format(new Date(), 'yyyy_MM_dd')}.docx`, profile?.currency); setShowExportMenu(false); }} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">Word</button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                  <div className="space-y-1 sm:hidden">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Search</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input 
                        placeholder="Search transactions..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 h-9 text-xs"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Category</label>
                    <select
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                      className="flex h-9 w-full rounded-xl border border-slate-200 bg-white px-3 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      {categories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">From Date</label>
                    <Input 
                      type="date" 
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="h-9 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">To Date</label>
                    <div className="flex gap-2">
                      <Input 
                        type="date" 
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="h-9 text-xs"
                      />
                      <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 w-9 p-0 rounded-xl">
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50/50 text-slate-500 text-xs uppercase tracking-wider font-semibold">
              <tr>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Description</th>
                <th className="px-6 py-4">Category</th>
                <th className="px-6 py-4 text-right">Amount</th>
                <th className="px-6 py-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loadingTransactions ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={`skel-tr-${i}`} className="animate-pulse">
                    <td className="px-6 py-4"><div className="h-4 bg-slate-100 rounded w-24"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-slate-100 rounded w-48"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-slate-100 rounded-full w-20"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-slate-100 rounded w-16 ml-auto"></div></td>
                    <td className="px-6 py-4"><div className="h-6 bg-slate-100 rounded w-16 mx-auto"></div></td>
                  </tr>
                ))
              ) : (
                filteredTransactions.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/50 transition-colors group">
                    {editingId === t.id ? (
                    <>
                      <td className="px-6 py-4">
                        <Input type="date" value={editForm.date?.split('T')[0] || ''} onChange={(e) => setEditForm({...editForm, date: new Date(e.target.value).toISOString()})} className="h-8 text-xs w-32" />
                      </td>
                      <td className="px-6 py-4">
                        <Input value={editForm.description || ''} onChange={(e) => setEditForm({...editForm, description: e.target.value})} className="h-8 text-xs min-w-[150px]" />
                      </td>
                      <td className="px-6 py-4">
                        <Input value={editForm.category || ''} onChange={(e) => setEditForm({...editForm, category: e.target.value})} className="h-8 text-xs w-28" />
                      </td>
                      <td className="px-6 py-4">
                        <Input type="number" value={editForm.amount || ''} onChange={(e) => setEditForm({...editForm, amount: Number(e.target.value)})} className="h-8 text-xs w-24 ml-auto text-right" />
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={saveEdit} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"><Check className="w-4 h-4" /></button>
                          <button onClick={cancelEdit} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"><X className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-6 py-4 text-sm text-slate-500">
                        {format(parseISO(t.date), 'MMM dd, yyyy')}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-slate-900">{t.description}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                          t.isAiCategorized ? "bg-indigo-50 text-indigo-600 border border-indigo-100" : "bg-slate-100 text-slate-600"
                        )}>
                          {t.isAiCategorized && <Sparkles className="w-2.5 h-2.5" />}
                          {t.category}
                        </span>
                      </td>
                      <td className={cn(
                        "px-6 py-4 text-sm font-bold text-right",
                        t.type === 'income' ? "text-emerald-600" : "text-rose-600"
                      )}>
                        {t.type === 'income' ? '+' : '-'}{formatCurrency(t.amount, profile?.currency)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                          <button 
                            onClick={() => startEdit(t)}
                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={() => handleDelete(t.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              )))}
              {!loadingTransactions && filteredTransactions.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400 text-sm">
                    {transactions.length > 0 ? "No transactions match your filters." : "No transactions yet. Add your first one to get started!"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirmId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6"
            >
              <h3 className="text-lg font-bold text-slate-900 mb-2">Delete Transaction</h3>
              <p className="text-slate-500 text-sm mb-6">
                Are you sure you want to delete this transaction? This action cannot be undone.
              </p>
              <div className="flex items-center justify-end gap-3">
                <Button variant="ghost" onClick={() => setDeleteConfirmId(null)}>
                  Cancel
                </Button>
                <Button variant="danger" onClick={confirmDelete} className="bg-rose-600 hover:bg-rose-700 text-white">
                  Delete
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
