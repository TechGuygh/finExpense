import React, { useState, useRef } from 'react';
import { db, auth } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { Button, Card, Input } from './UI';
import { TransactionType } from '../types';
import { categorizeTransaction, extractReceiptDetails } from '../services/geminiService';
import { Plus, Sparkles, Loader2, Camera, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

export function TransactionForm() {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [type, setType] = useState<TransactionType>('expense');
  const [category, setCategory] = useState<string>(''); // Empty means AI will categorize
  const [loading, setLoading] = useState(false);
  const [isAiCategorizing, setIsAiCategorizing] = useState(false);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const expenseCategories = ['Food & Dining', 'Transportation', 'Housing', 'Utilities', 'Entertainment', 'Healthcare', 'Shopping', 'Other'];
  const incomeCategories = ['Salary', 'Business', 'Investments', 'Gifts', 'Other'];

  const handleReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setReceiptLoading(true);
    
    const previewUrl = URL.createObjectURL(file);
    setReceiptPreview(previewUrl);

    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const base64String = (reader.result as string).split(',')[1];
        const mimeType = file.type;
        
        const details = await extractReceiptDetails(base64String, mimeType);
        if (details) {
          if (details.amount) setAmount(details.amount.toString());
          if (details.description) setDescription(details.description);
          if (details.date) {
            const parsedDate = new Date(details.date);
            if (!isNaN(parsedDate.getTime())) {
              setDate(parsedDate.toISOString().split('T')[0]);
            }
          }
        }
        setReceiptLoading(false);
      };
    } catch (error) {
      console.error("Error processing receipt:", error);
      setReceiptLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !amount || !description) return;

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error('Amount must be a positive number.');
      return;
    }

    const selectedDate = new Date(date);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (selectedDate > today) {
      toast.error('Date cannot be in the future.');
      return;
    }

    setLoading(true);
    setIsAiCategorizing(true);

    try {
      const finalCategory = category || await categorizeTransaction(description, parseFloat(amount));
      
      const transactionDate = new Date(date);
      transactionDate.setHours(new Date().getHours(), new Date().getMinutes());

      await addDoc(collection(db, 'transactions'), {
        userId: auth.currentUser.uid,
        amount: parseFloat(amount),
        type,
        category: finalCategory,
        description,
        date: transactionDate.toISOString(),
        isAiCategorized: !category,
        createdAt: serverTimestamp()
      });

      setAmount('');
      setDescription('');
      setDate(new Date().toISOString().split('T')[0]);
      setType('expense');
      setCategory('');
      setReceiptPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      toast.success('Transaction added successfully!');
    } catch (error) {
      console.error("Failed to add transaction:", error);
      toast.error('Failed to add transaction.');
    } finally {
      setLoading(false);
      setIsAiCategorizing(false);
    }
  };

  return (
    <Card className="p-6 bg-slate-50/50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-700">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Add Transaction
          </h3>
          <div className="flex items-center gap-2">
            <input 
              type="file" 
              accept="image/*" 
              className="hidden" 
              ref={fileInputRef}
              onChange={handleReceiptUpload}
            />
            <Button 
              type="button" 
              variant="outline" 
              size="sm" 
              onClick={() => fileInputRef.current?.click()}
              disabled={receiptLoading || loading}
              className="bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 hidden sm:flex"
            >
              {receiptLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Camera className="w-4 h-4 mr-2" />}
              Scan Receipt
            </Button>
            <Button 
              type="button" 
              variant="outline" 
              size="sm" 
              onClick={() => fileInputRef.current?.click()}
              disabled={receiptLoading || loading}
              className="bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 sm:hidden px-2"
            >
              {receiptLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
            </Button>
            <div className="flex bg-white dark:bg-slate-900 rounded-lg p-1 border border-slate-100 dark:border-slate-700 shadow-sm">
              <button
                type="button"
                onClick={() => setType('expense')}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${
                  type === 'expense' ? 'bg-rose-500 text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                Expense
              </button>
              <button
                type="button"
                onClick={() => setType('income')}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${
                  type === 'income' ? 'bg-brand-primary text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                Income
              </button>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {receiptPreview && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="relative w-full h-32 rounded-xl overflow-hidden mb-4 border border-slate-100 dark:border-slate-700"
            >
              <img src={receiptPreview} alt="Receipt" className="w-full h-full object-cover opacity-50" />
              <button 
                type="button"
                onClick={() => {
                  setReceiptPreview(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="absolute top-2 right-2 p-1 bg-white/80 dark:bg-slate-800/80 rounded-full hover:bg-white dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
              {receiptLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-900/20 dark:bg-slate-900/40 backdrop-blur-sm">
                  <div className="bg-white dark:bg-slate-800 px-4 py-2 rounded-full shadow-lg flex items-center gap-2 text-sm font-bold text-slate-600 dark:text-slate-400">
                    <Sparkles className="w-4 h-4 animate-pulse" />
                    Extracting details...
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Date</label>
            <Input
              type="date"
              value={date}
              max={new Date().toISOString().split('T')[0]}
              onChange={(e) => setDate(e.target.value)}
              required
              className="text-sm font-medium dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Amount</label>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              className="text-lg font-medium dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Description</label>
            <Input
              placeholder="What was this for?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              className="dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Category (Optional)</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full h-11 px-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
            >
              <option value="">✨ Let AI categorize automatically</option>
              {(type === 'expense' ? expenseCategories : incomeCategories).map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>

        <Button 
          type="submit" 
          disabled={loading} 
          className="w-full relative overflow-hidden group bg-brand-primary hover:bg-brand-primary-dark text-white"
        >
          <AnimatePresence mode="wait">
            {isAiCategorizing ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2"
              >
                <Loader2 className="w-4 h-4 animate-spin" />
                {category ? 'Adding...' : 'AI Categorizing...'}
              </motion.div>
            ) : (
              <motion.div
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2"
              >
                {category ? <Plus className="w-4 h-4" /> : <Sparkles className="w-4 h-4 text-brand-primary-light group-hover:text-white transition-colors" />}
                {category ? 'Add Transaction' : 'Add with AI Categorization'}
              </motion.div>
            )}
          </AnimatePresence>
        </Button>
      </form>
    </Card>
  );
}
