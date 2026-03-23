import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { RecurringTransaction, UserProfile } from '../types';
import { Card, Button, Input, Select } from './UI';
import { motion } from 'motion/react';
import { PlusCircle, Trash2, Repeat, Calendar, Clock } from 'lucide-react';

interface Props {
  profile: UserProfile | null;
}

export function RecurringTransactions({ profile }: Props) {
  const [recurring, setRecurring] = useState<RecurringTransaction[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  
  // Form State
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [category, setCategory] = useState('Subscriptions');
  const [description, setDescription] = useState('');
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('monthly');
  const [startDate, setStartDate] = useState('');

  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(collection(db, 'recurringTransactions'), where('userId', '==', auth.currentUser.uid));
    const unsub = onSnapshot(q, (snapshot) => {
      const r: RecurringTransaction[] = [];
      snapshot.forEach((doc) => r.push({ id: doc.id, ...doc.data() } as RecurringTransaction));
      setRecurring(r);
    });

    return () => unsub();
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: profile?.currency || 'USD'
    }).format(amount);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;
    
    try {
      await addDoc(collection(db, 'recurringTransactions'), {
        userId: auth.currentUser.uid,
        amount: Number(amount),
        type,
        category,
        description,
        frequency,
        startDate: new Date(startDate).toISOString(),
        nextDate: new Date(startDate).toISOString(),
        createdAt: new Date().toISOString()
      });
      setShowAdd(false);
      setAmount('');
      setDescription('');
      setStartDate('');
    } catch (error) {
      console.error("Error adding recurring transaction:", error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'recurringTransactions', id));
    } catch (error) {
      console.error("Error deleting:", error);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Recurring Transactions</h2>
          <p className="text-slate-500">Manage subscriptions, salary, and regular bills</p>
        </div>
        <Button onClick={() => setShowAdd(!showAdd)} className="bg-indigo-600 hover:bg-indigo-700">
          <PlusCircle className="w-4 h-4 mr-2" />
          Add Recurring
        </Button>
      </div>

      {showAdd && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-indigo-200 shadow-md">
            <form onSubmit={handleAdd} className="space-y-4">
              <h4 className="font-bold text-slate-900">New Recurring Transaction</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Type</label>
                  <Select value={type} onChange={e => setType(e.target.value as any)}>
                    <option value="expense">Expense</option>
                    <option value="income">Income</option>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Amount</label>
                  <Input required type="number" min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                  <Input required value={category} onChange={e => setCategory(e.target.value)} placeholder="e.g., Subscriptions, Salary" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                  <Input required value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g., Netflix, Monthly Salary" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Frequency</label>
                  <Select value={frequency} onChange={e => setFrequency(e.target.value as any)}>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Start Date</label>
                  <Input required type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
                <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700">Save</Button>
              </div>
            </form>
          </Card>
        </motion.div>
      )}

      {recurring.length === 0 && !showAdd ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-300">
          <Repeat className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-slate-900">No recurring transactions</h3>
          <p className="text-slate-500 mb-4">Set up your regular bills and income to automate your tracking.</p>
          <Button onClick={() => setShowAdd(true)} className="bg-indigo-600 hover:bg-indigo-700">
            Create First Recurring
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {recurring.map(rt => (
            <Card key={rt.id} className="relative overflow-hidden group">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${rt.type === 'income' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                    <Repeat className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900">{rt.description}</h4>
                    <p className="text-xs text-slate-500">{rt.category}</p>
                  </div>
                </div>
                <button onClick={() => handleDelete(rt.id)} className="text-slate-400 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-end">
                  <span className={`text-2xl font-bold ${rt.type === 'income' ? 'text-emerald-600' : 'text-slate-900'}`}>
                    {rt.type === 'income' ? '+' : ''}{formatCurrency(rt.amount)}
                  </span>
                  <span className="text-sm font-medium text-slate-500 capitalize bg-slate-100 px-2 py-1 rounded-md">
                    {rt.frequency}
                  </span>
                </div>
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    Started: {new Date(rt.startDate).toLocaleDateString()}
                  </span>
                  <span className="flex items-center gap-1 text-indigo-600 font-medium">
                    <Clock className="w-3 h-3" />
                    Next: {new Date(rt.nextDate).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
