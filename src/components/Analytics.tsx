import React, { useState, useEffect, useMemo } from 'react';
import { Card, Select } from './UI';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, LineChart, Line, XAxis, YAxis, CartesianGrid, AreaChart, Area } from 'recharts';
import { TrendingUp, TrendingDown, Activity, AlertCircle, PieChartIcon, BarChart3, Calendar } from 'lucide-react';
import { auth, db } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { Transaction, UserProfile } from '../types';
import { formatCurrency } from '../lib/utils';
import { format, parseISO, subDays, isAfter, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns';
import { motion } from 'motion/react';

const COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEEAD', '#D4A5A5', '#9B59B6', '#3498DB', '#E67E22', '#2ECC71'];

interface AnalyticsProps {
  profile: UserProfile | null;
}

export function Analytics({ profile }: AnalyticsProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [timeRange, setTimeRange] = useState('monthly'); // daily, weekly, monthly
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(collection(db, 'transactions'), where('userId', '==', auth.currentUser.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
      setTransactions(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const filteredTransactions = useMemo(() => {
    const now = new Date();
    let start = new Date(0);
    
    if (timeRange === 'daily') {
      start = subDays(now, 7); // Last 7 days
    } else if (timeRange === 'weekly') {
      start = subDays(now, 30); // Last 4 weeks
    } else if (timeRange === 'monthly') {
      start = subDays(now, 365); // Last 12 months
    }

    return transactions.filter(t => isAfter(parseISO(t.date), start));
  }, [transactions, timeRange]);

  const { income, expense, surplus, categoryData, trendData } = useMemo(() => {
    let totalIncome = 0;
    let totalExpense = 0;
    const catMap = new Map<string, number>();
    const trendMap = new Map<string, { income: number, expense: number, sortDate: Date }>();

    filteredTransactions.forEach(t => {
      const amount = t.amount;
      if (t.type === 'income') totalIncome += amount;
      else totalExpense += amount;

      if (t.type === 'expense') {
        catMap.set(t.category, (catMap.get(t.category) || 0) + amount);
      }

      let dateKey = '';
      const date = parseISO(t.date);
      let sortDate = date;
      if (timeRange === 'daily') {
        dateKey = format(date, 'MMM dd');
      } else if (timeRange === 'weekly') {
        dateKey = `Week of ${format(startOfWeek(date), 'MMM dd')}`;
        sortDate = startOfWeek(date);
      } else {
        dateKey = format(date, 'MMM yyyy');
        sortDate = startOfMonth(date);
      }

      const currentTrend = trendMap.get(dateKey) || { income: 0, expense: 0, sortDate };
      if (t.type === 'income') currentTrend.income += amount;
      else currentTrend.expense += amount;
      trendMap.set(dateKey, currentTrend);
    });

    const categoryData = Array.from(catMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const trendData = Array.from(trendMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.sortDate.getTime() - b.sortDate.getTime());

    return { 
      income: totalIncome, 
      expense: totalExpense, 
      surplus: totalIncome - totalExpense,
      categoryData,
      trendData
    };
  }, [filteredTransactions, timeRange]);

  const savingsRate = income > 0 ? ((surplus / income) * 100).toFixed(1) : '0.0';
  const topCategory = categoryData.length > 0 ? categoryData[0] : null;

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="w-8 h-8 border-4 border-[#279d48] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-4">
        <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
          <Calendar className="w-4 h-4 text-slate-400 ml-2" />
          <select 
            value={timeRange} 
            onChange={(e) => setTimeRange(e.target.value)}
            className="bg-transparent border-none text-sm font-medium text-slate-700 focus:ring-0 cursor-pointer py-1.5 pr-8"
          >
            <option value="daily">Last 7 Days</option>
            <option value="weekly">Last 4 Weeks</option>
            <option value="monthly">Last 12 Months</option>
          </select>
        </div>
      </div>

      {/* Key Insights Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="bg-gradient-to-br from-emerald-500 to-teal-600 text-white border-none shadow-lg shadow-emerald-200/50 relative overflow-hidden">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-xl" />
            <h3 className="text-emerald-50 font-medium text-sm mb-1">Total Income</h3>
            <p className="text-3xl font-bold tracking-tight">{formatCurrency(income, profile?.currency)}</p>
            <div className="mt-4 flex items-center gap-1 text-emerald-100 text-xs font-medium bg-white/20 w-fit px-2 py-1 rounded-full">
              <TrendingUp className="w-3 h-3" /> Income Stream
            </div>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="bg-gradient-to-br from-rose-500 to-orange-500 text-white border-none shadow-lg shadow-rose-200/50 relative overflow-hidden">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-xl" />
            <h3 className="text-rose-50 font-medium text-sm mb-1">Total Expenses</h3>
            <p className="text-3xl font-bold tracking-tight">{formatCurrency(expense, profile?.currency)}</p>
            <div className="mt-4 flex items-center gap-1 text-rose-100 text-xs font-medium bg-white/20 w-fit px-2 py-1 rounded-full">
              <TrendingDown className="w-3 h-3" /> Spending
            </div>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white border-none shadow-lg shadow-indigo-500/20 relative overflow-hidden">
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-white/10 rounded-full blur-xl" />
            <h3 className="text-indigo-50 font-medium text-sm mb-1">Savings Rate</h3>
            <p className="text-3xl font-bold tracking-tight">{savingsRate}%</p>
            <div className="mt-4 flex items-center gap-1 text-indigo-100 text-xs font-medium bg-white/20 w-fit px-2 py-1 rounded-full">
              <Activity className="w-3 h-3" /> Surplus: {formatCurrency(surplus, profile?.currency)}
            </div>
          </Card>
        </motion.div>
      </div>

      {/* Smart Alerts */}
      {expense > income && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-start gap-3 shadow-sm">
          <div className="bg-rose-100 p-2 rounded-full shrink-0">
            <AlertCircle className="w-5 h-5 text-rose-600" />
          </div>
          <div>
            <h4 className="text-rose-800 font-bold text-sm">Overspending Alert</h4>
            <p className="text-rose-600 text-sm mt-0.5">Your expenses have exceeded your income for this period. Consider reviewing your top spending categories.</p>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Category Breakdown */}
        <Card className="lg:col-span-1 bg-white border-slate-100 shadow-sm hover:shadow-md transition-shadow">
          <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
            <PieChartIcon className="w-5 h-5 text-[#279d48]" />
            Spending by Category
          </h3>
          
          {categoryData.length > 0 ? (
            <>
              <div className="h-[240px] w-full relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%"
                      cy="50%"
                      innerRadius={65}
                      outerRadius={85}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    >
                      {categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number) => formatCurrency(value, profile?.currency)}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Center Text */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-xs text-slate-400 font-medium uppercase tracking-wider">Top Category</span>
                  <span className="text-sm font-bold text-slate-800 truncate max-w-[100px]">{topCategory?.name}</span>
                </div>
              </div>
              
              <div className="mt-6 space-y-3 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                {categoryData.map((cat, idx) => (
                  <div key={cat.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                      <span className="text-slate-600 font-medium truncate max-w-[120px]">{cat.name}</span>
                    </div>
                    <span className="font-bold text-slate-900">{formatCurrency(cat.value, profile?.currency)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-[300px] flex flex-col items-center justify-center text-slate-400">
              <PieChartIcon className="w-12 h-12 mb-2 opacity-20" />
              <p>No expense data for this period</p>
            </div>
          )}
        </Card>

        {/* Trends Over Time */}
        <Card className="lg:col-span-2 bg-white border-slate-100 shadow-sm hover:shadow-md transition-shadow">
          <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
            <Activity className="w-5 h-5 text-[#279d48]" />
            Cash Flow Trends
          </h3>
          
          {trendData.length > 0 ? (
            <div className="h-[350px] w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="date" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 12, fill: '#64748b' }} 
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 12, fill: '#64748b' }}
                    tickFormatter={(value) => `$${value >= 1000 ? (value/1000).toFixed(1) + 'k' : value}`}
                    dx={-10}
                  />
                  <Tooltip 
                    formatter={(value: number) => formatCurrency(value, profile?.currency)}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend verticalAlign="top" height={36} iconType="circle" />
                  <Area 
                    type="monotone" 
                    dataKey="income" 
                    name="Income" 
                    stroke="#10b981" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorIncome)" 
                    activeDot={{ r: 6, strokeWidth: 0 }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="expense" 
                    name="Expenses" 
                    stroke="#ef4444" 
                    strokeWidth={3}
                    fillOpacity={1} 
                    fill="url(#colorExpense)" 
                    activeDot={{ r: 6, strokeWidth: 0 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[350px] flex flex-col items-center justify-center text-slate-400">
              <Activity className="w-12 h-12 mb-2 opacity-20" />
              <p>Not enough data to show trends</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
