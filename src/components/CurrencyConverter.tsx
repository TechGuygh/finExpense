import React, { useState, useEffect } from 'react';
import { Card, Input, Select, Button } from './UI';
import { ArrowRightLeft, RefreshCw } from 'lucide-react';

const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'INR'];

export function CurrencyConverter({ defaultCurrency = 'USD' }: { defaultCurrency?: string }) {
  const [amount, setAmount] = useState('100');
  const [fromCurrency, setFromCurrency] = useState(defaultCurrency);
  const [toCurrency, setToCurrency] = useState('EUR');
  const [result, setResult] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [rates, setRates] = useState<Record<string, number>>({});

  const fetchRates = async (base: string) => {
    try {
      setLoading(true);
      const res = await fetch(`https://api.exchangerate-api.com/v4/latest/${base}`);
      const data = await res.json();
      setRates(data.rates);
      if (data.rates[toCurrency]) {
        setResult(Number(amount) * data.rates[toCurrency]);
      }
    } catch (error) {
      console.error("Failed to fetch rates", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRates(fromCurrency);
  }, [fromCurrency]);

  useEffect(() => {
    if (rates[toCurrency] && amount) {
      setResult(Number(amount) * rates[toCurrency]);
    }
  }, [amount, toCurrency, rates]);

  const handleSwap = () => {
    setFromCurrency(toCurrency);
    setToCurrency(fromCurrency);
  };

  return (
    <Card className="bg-white">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-slate-900 flex items-center gap-2">
          <ArrowRightLeft className="w-5 h-5 text-indigo-600" />
          Currency Converter
        </h3>
        {loading && <RefreshCw className="w-4 h-4 text-slate-400 animate-spin" />}
      </div>
      
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Amount</label>
          <Input 
            type="number" 
            value={amount} 
            onChange={(e) => setAmount(e.target.value)} 
            className="text-lg font-medium"
          />
        </div>
        
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <label className="block text-xs font-medium text-slate-500 mb-1">From</label>
            <Select value={fromCurrency} onChange={(e) => setFromCurrency(e.target.value)}>
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </Select>
          </div>
          
          <button 
            onClick={handleSwap}
            className="mt-5 p-2 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors"
          >
            <ArrowRightLeft className="w-4 h-4 text-slate-600" />
          </button>
          
          <div className="flex-1">
            <label className="block text-xs font-medium text-slate-500 mb-1">To</label>
            <Select value={toCurrency} onChange={(e) => setToCurrency(e.target.value)}>
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </Select>
          </div>
        </div>

        {result !== null && (
          <div className="pt-4 mt-4 border-t border-slate-100">
            <p className="text-sm text-slate-500 mb-1">Converted Amount</p>
            <p className="text-2xl font-bold text-slate-900">
              {new Intl.NumberFormat('en-US', { style: 'currency', currency: toCurrency }).format(result)}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              1 {fromCurrency} = {rates[toCurrency]} {toCurrency}
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}
