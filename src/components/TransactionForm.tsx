import React, { useState, useRef } from 'react';
import { db, auth } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { Button, Card, Input } from './UI';
import { TransactionType } from '../types';
import { categorizeTransaction, extractReceiptDetails } from '../services/geminiService';
import { Plus, Sparkles, Loader2, Camera, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

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
    } catch (error) {
      console.error("Failed to add transaction:", error);
    } finally {
      setLoading(false);
      setIsAiCategorizing(false);
    }
  };

  return (
    <Card className="p-6 bg-indigo-50/50 border-indigo-100">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-indigo-900 flex items-center gap-2">
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
              className="bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-50 hidden sm:flex"
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
              className="bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-50 sm:hidden px-2"
            >
              {receiptLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
            </Button>
            <div className="flex bg-white rounded-lg p-1 border border-indigo-100 shadow-sm">
              <button
                type="button"
                onClick={() => setType('expense')}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${
                  type === 'expense' ? 'bg-rose-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Expense
              </button>
              <button
                type="button"
                onClick={() => setType('income')}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-all ${
                  type === 'income' ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
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
              className="relative w-full h-32 rounded-xl overflow-hidden mb-4 border border-indigo-100"
            >
              <img src={receiptPreview} alt="Receipt" className="w-full h-full object-cover opacity-50" />
              <button 
                type="button"
                onClick={() => {
                  setReceiptPreview(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="absolute top-2 right-2 p-1 bg-white/80 rounded-full hover:bg-white text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
              {receiptLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-indigo-900/20 backdrop-blur-sm">
                  <div className="bg-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 text-sm font-bold text-indigo-600">
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
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="text-sm font-medium"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Amount</label>
            <Input
              type="number"
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              className="text-lg font-medium"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Description</label>
            <Input
              placeholder="What was this for?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Category (Optional)</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full h-11 px-4 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-400"
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
          className="w-full relative overflow-hidden group"
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
                {category ? <Plus className="w-4 h-4" /> : <Sparkles className="w-4 h-4 text-indigo-200 group-hover:text-white transition-colors" />}
                {category ? 'Add Transaction' : 'Add with AI Categorization'}
              </motion.div>
            )}
          </AnimatePresence>
        </Button>
      </form>
    </Card>
  );
}
