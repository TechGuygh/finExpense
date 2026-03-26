import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { TrendingUp, TrendingDown, Search, Filter, Activity, DollarSign, PieChart, Info, ArrowUpRight, ArrowDownRight, Star, Bell, BellRing, Trash2, X, CheckCircle2 } from 'lucide-react';
import { Card, Input, Button } from './UI';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { cn, formatCurrency } from '../lib/utils';
import { UserProfile, PriceAlert } from '../types';
import { db, auth } from '../firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { toast } from 'sonner';

interface MarketInsightsProps {
  profile: UserProfile | null;
}

// Mock data for demonstration since we don't have a real financial API
const MOCK_MARKET_DATA = [
  { id: 'MTNGH', name: 'MTN Ghana', type: 'stock', market: 'GSE', sector: 'Telecommunications', price: 1.40, change: 0.02, changePercent: 1.45, assetCurrency: 'GHS', description: 'Leading telecommunications provider in Ghana, offering voice, data, and mobile money services.', logo: 'https://logo.clearbit.com/mtn.com.gh', history: Array.from({length: 20}, (_, i) => ({ time: i, value: 1.30 + Math.random() * 0.2 })) },
  { id: 'GCB', name: 'GCB Bank PLC', type: 'stock', market: 'GSE', sector: 'Banking', price: 3.40, change: -0.05, changePercent: -1.45, assetCurrency: 'GHS', description: 'One of the largest and oldest indigenous banks in Ghana.', logo: 'https://logo.clearbit.com/gcbbank.com.gh', history: Array.from({length: 20}, (_, i) => ({ time: i, value: 3.50 - Math.random() * 0.3 })) },
  { id: 'EGH', name: 'Ecobank Ghana', type: 'stock', market: 'GSE', sector: 'Banking', price: 5.50, change: 0.10, changePercent: 1.85, assetCurrency: 'GHS', description: 'A leading pan-African bank providing wholesale, retail, investment and transaction banking services.', logo: 'https://logo.clearbit.com/ecobank.com', history: Array.from({length: 20}, (_, i) => ({ time: i, value: 5.30 + Math.random() * 0.4 })) },
  { id: 'CAL', name: 'CAL Bank', type: 'stock', market: 'GSE', sector: 'Banking', price: 0.50, change: 0.01, changePercent: 2.04, assetCurrency: 'GHS', description: 'Innovative indigenous bank in Ghana focusing on corporate and retail banking.', logo: 'https://logo.clearbit.com/calbank.net', history: Array.from({length: 20}, (_, i) => ({ time: i, value: 0.45 + Math.random() * 0.1 })) },
  { id: 'UNIL', name: 'Unilever Ghana', type: 'stock', market: 'GSE', sector: 'Consumer Goods', price: 8.20, change: 0.15, changePercent: 1.86, assetCurrency: 'GHS', description: 'Major manufacturer of fast-moving consumer goods including home and personal care products.', logo: 'https://logo.clearbit.com/unilever.com', history: Array.from({length: 20}, (_, i) => ({ time: i, value: 8.00 + Math.random() * 0.5 })) },
  { id: 'FML', name: 'Fan Milk PLC', type: 'stock', market: 'GSE', sector: 'Consumer Goods', price: 3.00, change: -0.10, changePercent: -3.22, assetCurrency: 'GHS', description: 'Leading manufacturer and distributor of dairy products and fruit drinks.', logo: 'https://logo.clearbit.com/danone.com', history: Array.from({length: 20}, (_, i) => ({ time: i, value: 3.20 - Math.random() * 0.4 })) },
  { id: 'GOIL', name: 'Ghana Oil Company', type: 'stock', market: 'GSE', sector: 'Energy', price: 1.50, change: 0.00, changePercent: 0.00, assetCurrency: 'GHS', description: 'State-owned oil and gas marketing company in Ghana.', logo: 'https://logo.clearbit.com/goil.com.gh', history: Array.from({length: 20}, (_, i) => ({ time: i, value: 1.45 + Math.random() * 0.1 })) },
  { id: 'AAPL', name: 'Apple Inc.', type: 'stock', market: 'US', sector: 'Technology', price: 173.50, change: 2.34, changePercent: 1.36, assetCurrency: 'USD', description: 'Global technology company known for consumer electronics, software, and services.', logo: 'https://logo.clearbit.com/apple.com', history: Array.from({length: 20}, (_, i) => ({ time: i, value: 160 + Math.random() * 20 })) },
  { id: 'BTC', name: 'Bitcoin', type: 'crypto', market: 'Global', sector: 'Cryptocurrency', price: 64230.00, change: 1250.00, changePercent: 1.98, assetCurrency: 'USD', description: 'The first and largest decentralized digital currency.', logo: 'https://cryptologos.cc/logos/bitcoin-btc-logo.png', history: Array.from({length: 20}, (_, i) => ({ time: i, value: 60000 + Math.random() * 5000 })) },
  { id: 'ETH', name: 'Ethereum', type: 'crypto', market: 'Global', sector: 'Cryptocurrency', price: 3450.20, change: -45.30, changePercent: -1.29, assetCurrency: 'USD', description: 'Decentralized open-source blockchain system featuring smart contract functionality.', logo: 'https://cryptologos.cc/logos/ethereum-eth-logo.png', history: Array.from({length: 20}, (_, i) => ({ time: i, value: 3600 - Math.random() * 300 })) },
];

export function MarketInsights({ profile }: MarketInsightsProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [selectedAsset, setSelectedAsset] = useState<any | null>(null);
  const [marketData, setMarketData] = useState(MOCK_MARKET_DATA);
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<string>('name');
  const [timeRange, setTimeRange] = useState<string>('1D');
  const [modalHistory, setModalHistory] = useState<any[]>([]);
  const [gseSectorFilter, setGseSectorFilter] = useState<string>('all');
  const [alerts, setAlerts] = useState<PriceAlert[]>(profile?.priceAlerts || []);
  const [showAlertsModal, setShowAlertsModal] = useState(false);
  const [showSetAlertModal, setShowSetAlertModal] = useState(false);
  const [alertTargetPrice, setAlertTargetPrice] = useState<string>('');
  const [alertCondition, setAlertCondition] = useState<'above' | 'below'>('above');

  // Fetch watchlist and alerts
  useEffect(() => {
    if (!auth.currentUser) return;
    const fetchData = async () => {
      try {
        const docRef = doc(db, 'users', auth.currentUser!.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.watchlist) setWatchlist(data.watchlist);
          if (data.priceAlerts) setAlerts(data.priceAlerts);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };
    fetchData();
  }, []);

  const toggleWatchlist = async (e: React.MouseEvent, assetId: string) => {
    e.stopPropagation();
    if (!auth.currentUser) return;
    
    const newWatchlist = watchlist.includes(assetId) 
      ? watchlist.filter(id => id !== assetId)
      : [...watchlist, assetId];
      
    setWatchlist(newWatchlist);
    
    try {
      const docRef = doc(db, 'users', auth.currentUser.uid);
      await updateDoc(docRef, { watchlist: newWatchlist });
    } catch (error) {
      console.error("Error updating watchlist:", error);
    }
  };

  // Fetch real-time data from API and simulate others
  useEffect(() => {
    const fetchRealTimeData = async () => {
      try {
        // Fetch real crypto data from Binance API (very reliable CORS)
        const response = await fetch('https://api.binance.com/api/v3/ticker/24hr?symbols=%5B%22BTCUSDT%22,%22ETHUSDT%22%5D');
        if (!response.ok) throw new Error('API response not ok');
        const data = await response.json();
        
        const btcData = data.find((d: any) => d.symbol === 'BTCUSDT');
        const ethData = data.find((d: any) => d.symbol === 'ETHUSDT');
        
        setMarketData(prev => prev.map(asset => {
          // Update crypto with real API data
          if (asset.id === 'BTC' && btcData) {
            const newPrice = parseFloat(btcData.lastPrice);
            const changePercent = parseFloat(btcData.priceChangePercent);
            const change = parseFloat(btcData.priceChange);
            return {
              ...asset,
              price: newPrice,
              change,
              changePercent,
              history: [...asset.history.slice(1), { time: asset.history[asset.history.length - 1].time + 1, value: newPrice }]
            };
          }
          if (asset.id === 'ETH' && ethData) {
            const newPrice = parseFloat(ethData.lastPrice);
            const changePercent = parseFloat(ethData.priceChangePercent);
            const change = parseFloat(ethData.priceChange);
            return {
              ...asset,
              price: newPrice,
              change,
              changePercent,
              history: [...asset.history.slice(1), { time: asset.history[asset.history.length - 1].time + 1, value: newPrice }]
            };
          }
          
          // Simulate real-time updates for stocks/bonds/etfs
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
      } catch (error) {
        // Silently fallback to simulation if API fails (e.g., adblocker, network issue)
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
      }
    };

    fetchRealTimeData();
    const interval = setInterval(fetchRealTimeData, 5000); // Update every 5 seconds
    
    return () => clearInterval(interval);
  }, []);

  const getHistoricalData = (asset: any, range: string) => {
    const points = range === '1D' ? 24 : range === '7D' ? 7 : range === '1M' ? 30 : 12;
    const volatility = asset.type === 'crypto' ? 0.05 : 0.02;
    let currentPrice = asset.price;
    
    const history = [{ time: points - 1, value: currentPrice }];
    for (let i = points - 2; i >= 0; i--) {
      const change = 1 + (Math.random() * volatility * 2 - volatility);
      currentPrice = currentPrice / change;
      history.unshift({ time: i, value: currentPrice });
    }
    return history;
  };

  useEffect(() => {
    if (selectedAsset) {
      setModalHistory(getHistoricalData(selectedAsset, timeRange));
    }
  }, [selectedAsset, timeRange]);

  // Check price alerts
  useEffect(() => {
    if (!auth.currentUser || alerts.length === 0) return;

    let alertsUpdated = false;
    const updatedAlerts = alerts.map(alert => {
      if (!alert.active) return alert;

      const asset = marketData.find(a => a.id === alert.assetId);
      if (!asset) return alert;

      let triggered = false;
      if (alert.condition === 'above' && asset.price >= alert.targetPrice) {
        triggered = true;
      } else if (alert.condition === 'below' && asset.price <= alert.targetPrice) {
        triggered = true;
      }

      if (triggered) {
        alertsUpdated = true;
        toast.success(`Price Alert Triggered!`, {
          description: `${asset.name} has reached your target price of ${formatCurrency(alert.targetPrice, asset.assetCurrency || 'USD')}. Current price: ${formatCurrency(asset.price, asset.assetCurrency || 'USD')}`,
          duration: 10000,
          icon: <BellRing className="w-5 h-5 text-indigo-500" />
        });
        
        // Optional: Trigger browser notification if permitted
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('SUSU Price Alert', {
            body: `${asset.name} has reached your target price of ${formatCurrency(alert.targetPrice, asset.assetCurrency || 'USD')}.`,
            icon: asset.logo || '/favicon.ico'
          });
        }

        return { ...alert, active: false, triggeredAt: new Date().toISOString() };
      }
      return alert;
    });

    if (alertsUpdated) {
      setAlerts(updatedAlerts);
      const docRef = doc(db, 'users', auth.currentUser.uid);
      updateDoc(docRef, { priceAlerts: updatedAlerts }).catch(console.error);
    }
  }, [marketData]);

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const handleSaveAlert = async () => {
    if (!auth.currentUser || !selectedAsset || !alertTargetPrice) return;
    
    const targetPriceNum = parseFloat(alertTargetPrice);
    if (isNaN(targetPriceNum) || targetPriceNum <= 0) {
      toast.error("Please enter a valid target price");
      return;
    }

    const newAlert: PriceAlert = {
      id: Math.random().toString(36).substring(2, 9),
      userId: auth.currentUser.uid,
      assetId: selectedAsset.id,
      assetName: selectedAsset.name,
      targetPrice: targetPriceNum,
      condition: alertCondition,
      active: true,
      createdAt: new Date().toISOString()
    };

    const updatedAlerts = [...alerts, newAlert];
    setAlerts(updatedAlerts);
    
    try {
      const docRef = doc(db, 'users', auth.currentUser.uid);
      await updateDoc(docRef, { priceAlerts: updatedAlerts });
      toast.success("Price alert set successfully");
      setShowSetAlertModal(false);
      setAlertTargetPrice('');
    } catch (error) {
      console.error("Error saving alert:", error);
      toast.error("Failed to save price alert");
    }
  };

  const deleteAlert = async (alertId: string) => {
    if (!auth.currentUser) return;
    const updatedAlerts = alerts.filter(a => a.id !== alertId);
    setAlerts(updatedAlerts);
    try {
      const docRef = doc(db, 'users', auth.currentUser.uid);
      await updateDoc(docRef, { priceAlerts: updatedAlerts });
      toast.success("Alert deleted");
    } catch (error) {
      console.error("Error deleting alert:", error);
    }
  };

  const filteredData = marketData.filter(asset => {
    const matchesSearch = asset.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          asset.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (asset.sector && asset.sector.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesFilter = activeFilter === 'all' || 
                          (activeFilter === 'watchlist' ? watchlist.includes(asset.id) : 
                           activeFilter === 'gse' ? (asset.market === 'GSE' && (gseSectorFilter === 'all' || asset.sector === gseSectorFilter)) : 
                           asset.type === activeFilter && asset.market !== 'GSE');
    return matchesSearch && matchesFilter;
  }).sort((a, b) => {
    if (sortBy === 'price') return b.price - a.price;
    if (sortBy === 'change') return Math.abs(b.changePercent) - Math.abs(a.changePercent);
    if (sortBy === 'type') return a.type.localeCompare(b.type);
    if (sortBy === 'sector') return (a.sector || '').localeCompare(b.sector || '');
    return a.name.localeCompare(b.name);
  });

  const filters = [
    { id: 'all', label: 'All Assets' },
    { id: 'watchlist', label: 'Watchlist' },
    { id: 'gse', label: 'Ghana Market (GSE)' },
    { id: 'stock', label: 'Global Stocks' },
    { id: 'crypto', label: 'Crypto' },
  ];

  const topGainer = [...marketData].sort((a, b) => b.changePercent - a.changePercent)[0];
  const topLoser = [...marketData].sort((a, b) => a.changePercent - b.changePercent)[0];
  const mostActive = marketData.find(a => a.id === 'MTNGH') || marketData[0];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-900">Market Insights</h2>
        <Button 
          variant="outline" 
          onClick={() => setShowAlertsModal(true)}
          className="flex items-center gap-2 border-indigo-200 text-indigo-700 hover:bg-indigo-50 hover:text-indigo-800 transition-colors shadow-sm"
        >
          <Bell className="w-4 h-4" />
          Price Alerts
          {alerts.filter(a => a.active).length > 0 && (
            <span className="bg-indigo-600 text-white text-xs font-bold px-2 py-0.5 rounded-full shadow-sm">
              {alerts.filter(a => a.active).length}
            </span>
          )}
        </Button>
      </div>

      {/* Investment Trends */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4 bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-emerald-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-emerald-800 flex items-center gap-1">
              <TrendingUp className="w-4 h-4" /> Top Gainer
            </span>
            <span className="text-xs font-bold text-emerald-600 bg-emerald-100 px-2 py-1 rounded-full">+{topGainer?.changePercent.toFixed(2)}%</span>
          </div>
          <div className="flex items-center gap-3">
            {topGainer?.logo ? (
              <img src={topGainer.logo} alt={topGainer.name} className="w-8 h-8 rounded-full object-cover bg-white p-0.5 shadow-sm" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-emerald-200 flex items-center justify-center text-emerald-700 font-bold text-xs">{topGainer?.id.substring(0, 2)}</div>
            )}
            <div>
              <p className="font-bold text-slate-900">{topGainer?.name}</p>
              <p className="text-sm text-slate-600">{formatCurrency(topGainer?.price || 0, topGainer?.assetCurrency || profile?.currency || 'USD')}</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-4 bg-gradient-to-br from-rose-50 to-rose-100/50 border-rose-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-rose-800 flex items-center gap-1">
              <TrendingDown className="w-4 h-4" /> Top Loser
            </span>
            <span className="text-xs font-bold text-rose-600 bg-rose-100 px-2 py-1 rounded-full">{topLoser?.changePercent.toFixed(2)}%</span>
          </div>
          <div className="flex items-center gap-3">
            {topLoser?.logo ? (
              <img src={topLoser.logo} alt={topLoser.name} className="w-8 h-8 rounded-full object-cover bg-white p-0.5 shadow-sm" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-rose-200 flex items-center justify-center text-rose-700 font-bold text-xs">{topLoser?.id.substring(0, 2)}</div>
            )}
            <div>
              <p className="font-bold text-slate-900">{topLoser?.name}</p>
              <p className="text-sm text-slate-600">{formatCurrency(topLoser?.price || 0, topLoser?.assetCurrency || profile?.currency || 'USD')}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-gradient-to-br from-indigo-50 to-indigo-100/50 border-indigo-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-indigo-800 flex items-center gap-1">
              <Activity className="w-4 h-4" /> Most Active
            </span>
            <span className="text-xs font-bold text-indigo-600 bg-indigo-100 px-2 py-1 rounded-full">GSE</span>
          </div>
          <div className="flex items-center gap-3">
            {mostActive?.logo ? (
              <img src={mostActive.logo} alt={mostActive.name} className="w-8 h-8 rounded-full object-cover bg-white p-0.5 shadow-sm" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-indigo-200 flex items-center justify-center text-indigo-700 font-bold text-xs">{mostActive?.id.substring(0, 2)}</div>
            )}
            <div>
              <p className="font-bold text-slate-900">{mostActive?.name}</p>
              <p className="text-sm text-slate-600">{formatCurrency(mostActive?.price || 0, mostActive?.assetCurrency || profile?.currency || 'USD')}</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 gap-2 no-scrollbar flex-1">
          {filters.map(filter => (
            <button
              key={filter.id}
              onClick={() => setActiveFilter(filter.id)}
              className={cn(
                "whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-colors shadow-sm",
                activeFilter === filter.id 
                  ? filter.id === 'gse' ? "bg-emerald-500 text-white shadow-emerald-200" : "bg-slate-900 text-white shadow-slate-200"
                  : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>
        
        <div className="flex items-center gap-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="h-10 px-3 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          >
            <option value="name">Sort by Name</option>
            <option value="price">Sort by Price</option>
            <option value="change">Sort by Volatility</option>
            <option value="type">Sort by Type</option>
            <option value="sector">Sort by Sector</option>
          </select>
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

      {/* GSE Sub-filters */}
      <AnimatePresence>
        {activeFilter === 'gse' && (
          <motion.div 
            initial={{ opacity: 0, height: 0, marginTop: 0 }}
            animate={{ opacity: 1, height: 'auto', marginTop: -8 }}
            exit={{ opacity: 0, height: 0, marginTop: 0 }}
            className="flex overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 gap-2 no-scrollbar"
          >
            {['all', 'Banking', 'Telecommunications', 'Consumer Goods', 'Energy'].map(sector => (
              <button
                key={sector}
                onClick={() => setGseSectorFilter(sector)}
                className={cn(
                  "whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-medium transition-colors border shadow-sm",
                  gseSectorFilter === sector 
                    ? "bg-emerald-500 text-white border-emerald-600 shadow-emerald-200" 
                    : "bg-white text-slate-600 border-slate-200 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200"
                )}
              >
                {sector === 'all' ? 'All Sectors' : sector}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Asset Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <AnimatePresence mode="popLayout">
          {filteredData.map((asset) => {
            const isPositive = asset.change >= 0;
            
            // Determine card gradient based on sector and market
            const getCardGradient = (sector: string, market: string) => {
              if (market === 'GSE') {
                switch(sector) {
                  case 'Banking': return 'from-emerald-100 to-teal-200/60 border-emerald-300 shadow-emerald-100/50';
                  case 'Telecommunications': return 'from-amber-100 to-orange-200/60 border-amber-300 shadow-amber-100/50';
                  case 'Consumer Goods': return 'from-purple-100 to-fuchsia-200/60 border-purple-300 shadow-purple-100/50';
                  case 'Energy': return 'from-rose-100 to-red-200/60 border-rose-300 shadow-rose-100/50';
                  default: return 'from-blue-100 to-indigo-200/60 border-blue-300 shadow-blue-100/50';
                }
              }
              switch(sector) {
                case 'Banking': return 'from-emerald-50 to-teal-100/50 border-emerald-100';
                case 'Telecommunications': return 'from-amber-50 to-orange-100/50 border-amber-100';
                case 'Consumer Goods': return 'from-purple-50 to-fuchsia-100/50 border-purple-100';
                case 'Energy': return 'from-rose-50 to-red-100/50 border-rose-100';
                case 'Technology': return 'from-blue-50 to-indigo-100/50 border-blue-100';
                case 'Cryptocurrency': return 'from-slate-50 to-gray-100/50 border-slate-200';
                default: return 'from-slate-50 to-slate-100/50 border-slate-100';
              }
            };

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
                <Card className={cn(
                  "p-4 transition-all duration-300 group hover:-translate-y-1 hover:shadow-xl bg-gradient-to-br", 
                  getCardGradient(asset.sector || '', asset.market),
                  asset.market === 'GSE' ? "shadow-lg ring-1 ring-black/5" : ""
                )}>
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        {asset.logo ? (
                          <img src={asset.logo} alt={asset.name} className="w-6 h-6 rounded-full object-cover bg-white p-0.5 shadow-sm" referrerPolicy="no-referrer" />
                        ) : (
                          <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-slate-700 font-bold text-[10px]">{asset.id.substring(0, 2)}</div>
                        )}
                        <h4 className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{asset.id}</h4>
                        <button 
                          onClick={(e) => toggleWatchlist(e, asset.id)}
                          className="text-slate-300 hover:text-amber-400 transition-colors"
                        >
                          <Star className={cn("w-4 h-4", watchlist.includes(asset.id) && "fill-amber-400 text-amber-400")} />
                        </button>
                      </div>
                      <p className="text-xs text-slate-600 truncate max-w-[120px] font-medium mt-1">{asset.name}</p>
                      {asset.sector && <p className="text-[10px] text-slate-500 mt-0.5">{asset.sector}</p>}
                    </div>
                    <div className={cn(
                      "px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider shadow-sm",
                      asset.market === 'GSE' ? "bg-emerald-500 text-white shadow-emerald-200" :
                      asset.type === 'stock' ? "bg-blue-100 text-blue-700" :
                      asset.type === 'crypto' ? "bg-amber-100 text-amber-700" :
                      asset.type === 'bond' ? "bg-slate-200 text-slate-700" :
                      "bg-purple-100 text-purple-700"
                    )}>
                      {asset.market === 'GSE' ? 'GSE' : asset.type}
                    </div>
                  </div>
                  
                  <div className="flex items-end justify-between">
                    <div>
                      <motion.div 
                        key={asset.price}
                        initial={{ backgroundColor: 'rgba(16, 185, 129, 0.2)' }}
                        animate={{ backgroundColor: 'rgba(16, 185, 129, 0)' }}
                        transition={{ duration: 1 }}
                        className="text-xl font-bold text-slate-900 rounded px-1 -mx-1"
                      >
                        {formatCurrency(asset.price, asset.assetCurrency || profile?.currency || 'USD')}
                      </motion.div>
                      <motion.div 
                        key={asset.change}
                        initial={{ opacity: 0.5 }}
                        animate={{ opacity: 1 }}
                        className={cn(
                          "flex items-center gap-1 text-sm font-bold mt-1",
                          isPositive ? "text-emerald-600" : "text-rose-600"
                        )}
                      >
                        {isPositive ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                        {isPositive ? '+' : ''}{formatCurrency(asset.change, asset.assetCurrency || profile?.currency || 'USD')} ({isPositive ? '+' : ''}{asset.changePercent.toFixed(2)}%)
                      </motion.div>
                    </div>
                    
                    {/* Mini Sparkline */}
                    <div className="w-20 h-10">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={asset.history}>
                          <defs>
                            <linearGradient id={`gradient-${asset.id}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={isPositive ? '#10b981' : '#f43f5e'} stopOpacity={0.4}/>
                              <stop offset="95%" stopColor={isPositive ? '#10b981' : '#f43f5e'} stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <Area 
                            type="monotone" 
                            dataKey="value" 
                            stroke={isPositive ? '#10b981' : '#f43f5e'} 
                            strokeWidth={2}
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
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-3xl bg-white rounded-2xl shadow-2xl z-50 overflow-hidden"
            >
              <div className={cn(
                "p-6 border-b flex justify-between items-start",
                selectedAsset.market === 'GSE' 
                  ? "bg-gradient-to-r from-emerald-50 via-teal-50 to-cyan-50 border-emerald-100" 
                  : "bg-white border-slate-100"
              )}>
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    {selectedAsset.logo ? (
                      <img src={selectedAsset.logo} alt={selectedAsset.name} className="w-10 h-10 rounded-full object-cover bg-white p-0.5 shadow-sm" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-700 font-bold text-sm">{selectedAsset.id.substring(0, 2)}</div>
                    )}
                    <h2 className="text-2xl font-bold text-slate-900">{selectedAsset.id}</h2>
                    <span className={cn(
                      "px-2 py-1 text-xs font-bold uppercase rounded shadow-sm",
                      selectedAsset.market === 'GSE' ? "bg-emerald-500 text-white shadow-emerald-200" : "bg-slate-100 text-slate-600"
                    )}>
                      {selectedAsset.market === 'GSE' ? 'GSE' : selectedAsset.type}
                    </span>
                    <button 
                      onClick={(e) => toggleWatchlist(e, selectedAsset.id)}
                      className="text-slate-300 hover:text-amber-400 transition-colors ml-2"
                    >
                      <Star className={cn("w-6 h-6", watchlist.includes(selectedAsset.id) && "fill-amber-400 text-amber-400")} />
                    </button>
                  </div>
                  <p className="text-slate-700 font-medium text-lg">{selectedAsset.name}</p>
                  {selectedAsset.sector && <p className="text-sm text-slate-500 mt-1">{selectedAsset.sector}</p>}
                </div>
                <div className="text-right flex flex-col items-end">
                  <motion.div 
                    key={selectedAsset.price}
                    initial={{ backgroundColor: 'rgba(16, 185, 129, 0.2)' }}
                    animate={{ backgroundColor: 'rgba(16, 185, 129, 0)' }}
                    transition={{ duration: 1 }}
                    className="text-3xl font-bold text-slate-900 rounded px-2 py-1 -mx-2 -my-1"
                  >
                    {formatCurrency(selectedAsset.price, selectedAsset.assetCurrency || profile?.currency || 'USD')}
                  </motion.div>
                  <motion.div 
                    key={selectedAsset.change}
                    initial={{ opacity: 0.5 }}
                    animate={{ opacity: 1 }}
                    className={cn(
                      "flex items-center justify-end gap-1 text-sm font-bold mt-2",
                      selectedAsset.change >= 0 ? "text-emerald-600" : "text-rose-600"
                    )}
                  >
                    {selectedAsset.change >= 0 ? '+' : ''}{formatCurrency(selectedAsset.change, selectedAsset.assetCurrency || profile?.currency || 'USD')} 
                    ({selectedAsset.change >= 0 ? '+' : ''}{selectedAsset.changePercent.toFixed(2)}%)
                  </motion.div>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="mt-4 text-xs flex items-center gap-1 bg-white shadow-sm"
                    onClick={() => {
                      setAlertTargetPrice(selectedAsset.price.toString());
                      setShowSetAlertModal(true);
                    }}
                  >
                    <Bell className="w-3 h-3" /> Set Alert
                  </Button>
                </div>
              </div>
              
              {selectedAsset.description && (
                <div className="px-6 pt-5 pb-4 bg-slate-50/50 border-b border-slate-100">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">About {selectedAsset.name}</h4>
                  <p className="text-sm text-slate-700 leading-relaxed">{selectedAsset.description}</p>
                </div>
              )}
              
              <div className="p-6 bg-slate-50">
                <div className="flex items-center justify-end gap-2 mb-4">
                  {['1D', '7D', '1M', '1Y'].map(range => (
                    <button
                      key={range}
                      onClick={() => setTimeRange(range)}
                      className={cn(
                        "px-3 py-1 text-xs font-bold rounded-md transition-colors",
                        timeRange === range 
                          ? "bg-indigo-100 text-indigo-700" 
                          : "text-slate-500 hover:bg-slate-200"
                      )}
                    >
                      {range}
                    </button>
                  ))}
                </div>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={modalHistory}>
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
                        formatter={(value: number) => [formatCurrency(value, selectedAsset.assetCurrency || profile?.currency || 'USD'), 'Price']}
                        labelFormatter={() => ''}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="value" 
                        stroke={selectedAsset.change >= 0 ? '#10b981' : '#f43f5e'} 
                        strokeWidth={2}
                        fillOpacity={1} 
                        fill="url(#colorValue)" 
                        isAnimationActive={true}
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

      {/* Set Alert Modal */}
      <AnimatePresence>
        {showSetAlertModal && selectedAsset && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSetAlertModal(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-sm bg-white rounded-2xl shadow-2xl z-[60] overflow-hidden"
            >
              <div className="p-6">
                <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-100">
                  <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                    <Bell className="w-5 h-5 text-indigo-500" /> Set Price Alert
                  </h3>
                  <button onClick={() => setShowSetAlertModal(false)} className="text-slate-400 hover:text-slate-600 bg-slate-50 p-1.5 rounded-full hover:bg-slate-100 transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                <div className="mb-6 bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <p className="text-xs text-slate-500 uppercase tracking-wider font-bold mb-1">Asset</p>
                  <p className="font-bold text-slate-900 text-lg">{selectedAsset.name} ({selectedAsset.id})</p>
                  <p className="text-sm text-slate-600 mt-1 flex items-center gap-1">
                    Current Price: <span className="font-bold text-slate-900">{formatCurrency(selectedAsset.price, selectedAsset.assetCurrency || 'USD')}</span>
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Alert Condition</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setAlertCondition('above')}
                        className={cn(
                          "px-4 py-2 text-sm font-medium rounded-xl border transition-colors",
                          alertCondition === 'above' 
                            ? "bg-emerald-50 border-emerald-200 text-emerald-700" 
                            : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                        )}
                      >
                        Goes Above
                      </button>
                      <button
                        onClick={() => setAlertCondition('below')}
                        className={cn(
                          "px-4 py-2 text-sm font-medium rounded-xl border transition-colors",
                          alertCondition === 'below' 
                            ? "bg-rose-50 border-rose-200 text-rose-700" 
                            : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                        )}
                      >
                        Drops Below
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Target Price</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <DollarSign className="w-4 h-4 text-slate-400" />
                      </div>
                      <Input
                        type="number"
                        value={alertTargetPrice}
                        onChange={(e) => setAlertTargetPrice(e.target.value)}
                        placeholder="Enter target price"
                        step="0.01"
                        className="pl-9"
                      />
                    </div>
                  </div>

                  <Button className="w-full mt-6 bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-200" onClick={handleSaveAlert}>
                    Save Alert
                  </Button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Alerts List Modal */}
      <AnimatePresence>
        {showAlertsModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAlertsModal(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60]"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white rounded-2xl shadow-2xl z-[60] overflow-hidden flex flex-col max-h-[80vh]"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-indigo-50 to-blue-50">
                <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <BellRing className="w-5 h-5 text-indigo-500" /> Your Price Alerts
                </h3>
                <button onClick={() => setShowAlertsModal(false)} className="text-slate-400 hover:text-slate-600 bg-white p-1.5 rounded-full shadow-sm">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto flex-1">
                {alerts.length === 0 ? (
                  <div className="text-center py-8">
                    <Bell className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                    <h4 className="text-slate-600 font-medium">No alerts set</h4>
                    <p className="text-slate-400 text-sm mt-1">Set price alerts to get notified when assets reach your target price.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {alerts.map(alert => (
                      <div key={alert.id} className={cn(
                        "p-4 rounded-xl border flex items-center justify-between",
                        alert.active ? "bg-white border-slate-200" : "bg-slate-50 border-slate-200 opacity-75"
                      )}>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-slate-900">{alert.assetName}</span>
                            <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded">{alert.assetId}</span>
                          </div>
                          <div className="flex items-center gap-1 text-sm">
                            <span className="text-slate-500">Target:</span>
                            <span className={cn(
                              "font-bold",
                              alert.condition === 'above' ? "text-emerald-600" : "text-rose-600"
                            )}>
                              {alert.condition === 'above' ? '≥' : '≤'} {alert.targetPrice}
                            </span>
                          </div>
                          {!alert.active && alert.triggeredAt && (
                            <div className="text-xs text-indigo-600 font-medium mt-1 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Triggered
                            </div>
                          )}
                        </div>
                        <button 
                          onClick={() => deleteAlert(alert.id)}
                          className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
