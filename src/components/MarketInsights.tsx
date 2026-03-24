import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { TrendingUp, TrendingDown, Search, Filter, Activity, DollarSign, PieChart, Info, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Card, Input, Button } from './UI';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { cn, formatCurrency } from '../lib/utils';
import { UserProfile } from '../types';

interface MarketInsightsProps {
  profile: UserProfile | null;
}

// Mock data for demonstration since we don't have a real financial API
const MOCK_MARKET_DATA = [
  { id: 'AAPL', name: 'Apple Inc.', type: 'stock', price: 173.50, change: 2.34, changePercent: 1.36, history: Array.from({length: 20}, (_, i) => ({ time: i, value: 160 + Math.random() * 20 })) },
  { id: 'MSFT', name: 'Microsoft Corp.', type: 'stock', price: 415.20, change: -1.20, changePercent: -0.28, history: Array.from({length: 20}, (_, i) => ({ time: i, value: 420 - Math.random() * 15 })) },
  { id: 'GOOGL', name: 'Alphabet Inc.', type: 'stock', price: 142.65, change: 0.85, changePercent: 0.60, history: Array.from({length: 20}, (_, i) => ({ time: i, value: 135 + Math.random() * 10 })) },
  { id: 'TSLA', name: 'Tesla Inc.', type: 'stock', price: 175.22, change: -5.40, changePercent: -2.98, history: Array.from({length: 20}, (_, i) => ({ time: i, value: 190 - Math.random() * 25 })) },
  { id: 'US10Y', name: 'US 10-Year Treasury', type: 'bond', price: 98.45, change: 0.12, changePercent: 0.12, history: Array.from({length: 20}, (_, i) => ({ time: i, value: 98 + Math.random() * 1 })) },
  { id: 'BTC', name: 'Bitcoin', type: 'crypto', price: 64230.00, change: 1250.00, changePercent: 1.98, history: Array.from({length: 20}, (_, i) => ({ time: i, value: 60000 + Math.random() * 5000 })) },
  { id: 'ETH', name: 'Ethereum', type: 'crypto', price: 3450.20, change: -45.30, changePercent: -1.29, history: Array.from({length: 20}, (_, i) => ({ time: i, value: 3600 - Math.random() * 300 })) },
  { id: 'SPY', name: 'S&P 500 ETF', type: 'etf', price: 512.30, change: 3.45, changePercent: 0.67, history: Array.from({length: 20}, (_, i) => ({ time: i, value: 500 + Math.random() * 15 })) },
];

export function MarketInsights({ profile }: MarketInsightsProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [selectedAsset, setSelectedAsset] = useState<any | null>(null);
  const [marketData, setMarketData] = useState(MOCK_MARKET_DATA);

  // Simulate real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      setMarketData(prev => prev.map(asset => {
        const volatility = asset.type === 'crypto' ? 0.02 : 0.005;
        const changeFactor = 1 + (Math.random() * volatility * 2 - volatility);
        const newPrice = asset.price * changeFactor;
        const priceDiff = newPrice - asset.price;
        
        return {
          ...asset,
          price: newPrice,
          change: asset.change + priceDiff,
          changePercent: ((asset.change + priceDiff) / (asset.price - asset.change)) * 100,
          history: [...asset.history.slice(1), { time: asset.history[asset.history.length - 1].time + 1, value: newPrice }]
        };
      }));
    }, 3000);
    
    return () => clearInterval(interval);
  }, []);

  const filteredData = marketData.filter(asset => {
    const matchesSearch = asset.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          asset.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = activeFilter === 'all' || asset.type === activeFilter;
    return matchesSearch && matchesFilter;
  });

  const filters = [
    { id: 'all', label: 'All Assets' },
    { id: 'stock', label: 'Stocks' },
    { id: 'bond', label: 'Bonds' },
    { id: 'etf', label: 'ETFs' },
    { id: 'crypto', label: 'Crypto' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Activity className="w-6 h-6 text-indigo-600" />
            Market Insights
          </h3>
          <p className="text-sm text-slate-500 mt-1">Real-time market data and investment trends.</p>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input 
              placeholder="Search assets..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-full sm:w-64"
            />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 gap-2 no-scrollbar">
        {filters.map(filter => (
          <button
            key={filter.id}
            onClick={() => setActiveFilter(filter.id)}
            className={cn(
              "whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-colors",
              activeFilter === filter.id 
                ? "bg-slate-900 text-white" 
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            )}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* Asset Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <AnimatePresence mode="popLayout">
          {filteredData.map((asset) => {
            const isPositive = asset.change >= 0;
            return (
              <motion.div
                key={asset.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.2 }}
                onClick={() => setSelectedAsset(asset)}
                className="cursor-pointer"
              >
                <Card className="p-4 hover:border-indigo-200 hover:shadow-md transition-all group">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h4 className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{asset.id}</h4>
                      <p className="text-xs text-slate-500 truncate max-w-[120px]">{asset.name}</p>
                    </div>
                    <div className={cn(
                      "px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider",
                      asset.type === 'stock' ? "bg-blue-50 text-blue-600" :
                      asset.type === 'crypto' ? "bg-amber-50 text-amber-600" :
                      asset.type === 'bond' ? "bg-slate-100 text-slate-600" :
                      "bg-purple-50 text-purple-600"
                    )}>
                      {asset.type}
                    </div>
                  </div>
                  
                  <div className="flex items-end justify-between">
                    <div>
                      <div className="text-xl font-bold text-slate-900">
                        {formatCurrency(asset.price, profile?.currency || 'USD')}
                      </div>
                      <div className={cn(
                        "flex items-center gap-1 text-sm font-medium mt-1",
                        isPositive ? "text-emerald-600" : "text-rose-600"
                      )}>
                        {isPositive ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                        {isPositive ? '+' : ''}{formatCurrency(asset.change, profile?.currency || 'USD')} ({isPositive ? '+' : ''}{asset.changePercent.toFixed(2)}%)
                      </div>
                    </div>
                    
                    {/* Mini Sparkline */}
                    <div className="w-20 h-10">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={asset.history}>
                          <defs>
                            <linearGradient id={`gradient-${asset.id}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={isPositive ? '#10b981' : '#f43f5e'} stopOpacity={0.3}/>
                              <stop offset="95%" stopColor={isPositive ? '#10b981' : '#f43f5e'} stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <Area 
                            type="monotone" 
                            dataKey="value" 
                            stroke={isPositive ? '#10b981' : '#f43f5e'} 
                            fillOpacity={1} 
                            fill={`url(#gradient-${asset.id})`} 
                            isAnimationActive={false}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {filteredData.length === 0 && (
        <div className="text-center py-12">
          <Search className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h4 className="text-slate-700 font-medium">No assets found</h4>
          <p className="text-slate-400 text-sm mt-1">Try adjusting your search or filters.</p>
        </div>
      )}

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedAsset && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedAsset(null)}
              className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl bg-white rounded-2xl shadow-2xl z-50 overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h2 className="text-2xl font-bold text-slate-900">{selectedAsset.id}</h2>
                    <span className="px-2 py-1 bg-slate-100 text-slate-600 text-xs font-bold uppercase rounded">
                      {selectedAsset.type}
                    </span>
                  </div>
                  <p className="text-slate-500">{selectedAsset.name}</p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-slate-900">
                    {formatCurrency(selectedAsset.price, profile?.currency || 'USD')}
                  </div>
                  <div className={cn(
                    "flex items-center justify-end gap-1 text-sm font-medium",
                    selectedAsset.change >= 0 ? "text-emerald-600" : "text-rose-600"
                  )}>
                    {selectedAsset.change >= 0 ? '+' : ''}{formatCurrency(selectedAsset.change, profile?.currency || 'USD')} 
                    ({selectedAsset.change >= 0 ? '+' : ''}{selectedAsset.changePercent.toFixed(2)}%)
                  </div>
                </div>
              </div>
              
              <div className="p-6 bg-slate-50">
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={selectedAsset.history}>
                      <defs>
                        <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={selectedAsset.change >= 0 ? '#10b981' : '#f43f5e'} stopOpacity={0.3}/>
                          <stop offset="95%" stopColor={selectedAsset.change >= 0 ? '#10b981' : '#f43f5e'} stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="time" hide />
                      <YAxis domain={['auto', 'auto']} hide />
                      <Tooltip 
                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        formatter={(value: number) => [formatCurrency(value, profile?.currency || 'USD'), 'Price']}
                        labelFormatter={() => ''}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="value" 
                        stroke={selectedAsset.change >= 0 ? '#10b981' : '#f43f5e'} 
                        strokeWidth={2}
                        fillOpacity={1} 
                        fill="url(#colorValue)" 
                        isAnimationActive={false}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
              
              <div className="p-6 border-t border-slate-100 flex justify-between items-center bg-white">
                <p className="text-sm text-slate-500 flex items-center gap-2">
                  <Info className="w-4 h-4" />
                  Ask the SUSU Assistant about {selectedAsset.id} for more insights.
                </p>
                <Button onClick={() => setSelectedAsset(null)} variant="outline">
                  Close
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
