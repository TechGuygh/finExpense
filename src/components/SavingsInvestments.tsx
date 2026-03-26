import React, { useState, useEffect, useRef } from 'react';
import { auth, db } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { SavingsGoal, Investment, UserProfile } from '../types';
import { Card, Button, Input, Select } from './UI';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { GoogleGenAI } from '@google/genai';
import { 
  Target, 
  TrendingUp, 
  PlusCircle, 
  Wallet, 
  PiggyBank, 
  ArrowUpRight, 
  Trash2,
  Calendar,
  AlertCircle,
  Sparkles,
  Bell,
  RefreshCw
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area
} from 'recharts';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

interface Props {
  profile: UserProfile | null;
}

export function SavingsInvestments({ profile }: Props) {
  const [activeTab, setActiveTab] = useState<'savings' | 'investments'>('savings');
  
  // Data
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  
  // Forms
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [showAddInvestment, setShowAddInvestment] = useState(false);
  
  // Goal Form State
  const [goalTitle, setGoalTitle] = useState('');
  const [goalTarget, setGoalTarget] = useState('');
  const [goalDeadline, setGoalDeadline] = useState('');
  const [goalCategory, setGoalCategory] = useState('Emergency Fund');
  const [goalAutoContribute, setGoalAutoContribute] = useState(false);
  const [goalAutoAmount, setGoalAutoAmount] = useState('');
  const [goalAutoFreq, setGoalAutoFreq] = useState<'weekly' | 'monthly'>('monthly');
  const [goalReminders, setGoalReminders] = useState(true);
  
  // Contribution State
  const [contributeGoalId, setContributeGoalId] = useState<string | null>(null);
  const [contributionAmount, setContributionAmount] = useState('');

  // Investment Form State
  const [invName, setInvName] = useState('');
  const [invAmount, setInvAmount] = useState('');
  const [invCategory, setInvCategory] = useState('Stocks');
  const [invReturn, setInvReturn] = useState('');

  // AI Tip State
  const [aiTip, setAiTip] = useState<string>('');
  const [loadingTip, setLoadingTip] = useState(false);
  const notifiedGoals = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!auth.currentUser) return;

    const qGoals = query(collection(db, 'savingsGoals'), where('userId', '==', auth.currentUser.uid));
    const unsubGoals = onSnapshot(qGoals, (snapshot) => {
      const g: SavingsGoal[] = [];
      snapshot.forEach((doc) => g.push({ id: doc.id, ...doc.data() } as SavingsGoal));
      setGoals(g);
    });

    const qInv = query(collection(db, 'investments'), where('userId', '==', auth.currentUser.uid));
    const unsubInv = onSnapshot(qInv, (snapshot) => {
      const i: Investment[] = [];
      snapshot.forEach((doc) => i.push({ id: doc.id, ...doc.data() } as Investment));
      setInvestments(i);
    });

    return () => {
      unsubGoals();
      unsubInv();
    };
  }, []);

  useEffect(() => {
    if (goals.length === 0) return;
    
    const now = new Date();
    goals.forEach(goal => {
      if (goal.remindersEnabled && goal.deadline && !notifiedGoals.current.has(goal.id)) {
        const deadline = new Date(goal.deadline);
        const daysLeft = (deadline.getTime() - now.getTime()) / (1000 * 3600 * 24);
        
        // If deadline is within 30 days and goal is not met
        if (daysLeft > 0 && daysLeft <= 30 && goal.currentAmount < goal.targetAmount) {
          toast.warning(`Reminder: Your goal "${goal.title}" is due in ${Math.ceil(daysLeft)} days! Keep contributing to stay on track.`, {
            duration: 8000,
            icon: '🎯'
          });
          notifiedGoals.current.add(goal.id);
        }
      }
    });
  }, [goals]);

  useEffect(() => {
    if (activeTab === 'investments' && !aiTip && !loadingTip) {
      fetchAiTip();
    }
  }, [activeTab]);

  const fetchAiTip = async () => {
    setLoadingTip(true);
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: "Provide a short, 2-sentence general investment tip or best practice for a retail investor. Keep it encouraging and easy to understand. Do not use markdown."
      });
      setAiTip(response.text || "Diversify your portfolio across different asset classes to reduce risk. Consistency is key to long-term wealth building.");
    } catch (error) {
      console.error("Failed to fetch AI tip", error);
      setAiTip("Diversify your portfolio across different asset classes to reduce risk. Consistency is key to long-term wealth building.");
    } finally {
      setLoadingTip(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: profile?.currency || 'USD'
    }).format(amount);
  };

  const handleAddGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;
    
    try {
      const newGoal: any = {
        userId: auth.currentUser.uid,
        title: goalTitle,
        targetAmount: Number(goalTarget),
        currentAmount: 0,
        deadline: goalDeadline,
        category: goalCategory,
        createdAt: new Date().toISOString(),
        remindersEnabled: goalReminders
      };

      if (goalAutoContribute && Number(goalAutoAmount) > 0) {
        newGoal.autoContribute = {
          amount: Number(goalAutoAmount),
          frequency: goalAutoFreq
        };
      }

      await addDoc(collection(db, 'savingsGoals'), newGoal);
      setShowAddGoal(false);
      setGoalTitle('');
      setGoalTarget('');
      setGoalDeadline('');
      setGoalAutoContribute(false);
      setGoalAutoAmount('');
      setGoalReminders(true);
      toast.success("Savings goal created successfully!");
    } catch (error) {
      console.error("Error adding goal:", error);
      toast.error("Failed to create savings goal.");
    }
  };

  const handleContribute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contributeGoalId) return;
    
    const goal = goals.find(g => g.id === contributeGoalId);
    if (!goal) return;

    try {
      await updateDoc(doc(db, 'savingsGoals', contributeGoalId), {
        currentAmount: goal.currentAmount + Number(contributionAmount)
      });
      setContributeGoalId(null);
      setContributionAmount('');
    } catch (error) {
      console.error("Error contributing:", error);
    }
  };

  const handleDeleteGoal = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'savingsGoals', id));
    } catch (error) {
      console.error("Error deleting goal:", error);
    }
  };

  const handleAddInvestment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;

    try {
      await addDoc(collection(db, 'investments'), {
        userId: auth.currentUser.uid,
        name: invName,
        category: invCategory,
        amount: Number(invAmount),
        expectedReturnRate: Number(invReturn),
        createdAt: new Date().toISOString()
      });
      setShowAddInvestment(false);
      setInvName('');
      setInvAmount('');
      setInvReturn('');
    } catch (error) {
      console.error("Error adding investment:", error);
    }
  };

  const handleDeleteInvestment = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'investments', id));
    } catch (error) {
      console.error("Error deleting investment:", error);
    }
  };

  // Calculations
  const totalSavings = goals.reduce((acc, g) => acc + g.currentAmount, 0);
  const totalTarget = goals.reduce((acc, g) => acc + g.targetAmount, 0);
  const savingsProgress = totalTarget > 0 ? (totalSavings / totalTarget) * 100 : 0;

  const totalInvested = investments.reduce((acc, i) => acc + i.amount, 0);
  const avgReturn = investments.length > 0 
    ? investments.reduce((acc, i) => acc + i.expectedReturnRate, 0) / investments.length 
    : 0;

  // Projection Data (Simple 5 year projection)
  const projectionData = Array.from({ length: 6 }).map((_, i) => {
    const year = new Date().getFullYear() + i;
    const projectedValue = investments.reduce((acc, inv) => {
      return acc + (inv.amount * Math.pow(1 + (inv.expectedReturnRate / 100), i));
    }, 0);
    return { year: year.toString(), value: Math.round(projectedValue) };
  });

  return (
    <div className="space-y-8">
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-4">
        <div className="flex bg-slate-200 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('savings')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'savings' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Savings Goals
          </button>
          <button
            onClick={() => setActiveTab('investments')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === 'investments' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Investments
          </button>
        </div>
      </div>

      {activeTab === 'savings' ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          {/* Savings Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-gradient-to-br from-[#279d48] to-emerald-600 text-white border-none">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-white/20 rounded-lg">
                  <PiggyBank className="w-5 h-5" />
                </div>
                <h3 className="font-medium text-emerald-50">Total Saved</h3>
              </div>
              <p className="text-3xl font-bold">{formatCurrency(totalSavings)}</p>
              <div className="mt-4">
                <div className="flex justify-between text-xs mb-1 text-emerald-100">
                  <span>Overall Progress</span>
                  <span>{savingsProgress.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-black/20 rounded-full h-2">
                  <div 
                    className="bg-white h-2 rounded-full transition-all duration-500" 
                    style={{ width: `${Math.min(savingsProgress, 100)}%` }}
                  />
                </div>
              </div>
            </Card>
            
            <Card>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
                  <Target className="w-5 h-5" />
                </div>
                <h3 className="font-medium text-slate-600">Active Goals</h3>
              </div>
              <p className="text-3xl font-bold text-slate-900">{goals.length}</p>
              <p className="text-sm text-slate-500 mt-2">Targeting {formatCurrency(totalTarget)}</p>
            </Card>

            <Card className="bg-amber-50 border-amber-100">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-medium text-amber-900 mb-1">Smart Tip</h3>
                  <p className="text-sm text-amber-700 leading-relaxed">
                    Aim to save at least 20% of your income. Building an emergency fund of 3-6 months of expenses should be your first priority.
                  </p>
                </div>
              </div>
            </Card>
          </div>

          {/* Goals List */}
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-900">Your Goals</h3>
            <Button 
              onClick={() => setShowAddGoal(!showAddGoal)} 
              size="sm" 
              variant={showAddGoal ? "outline" : "primary"}
              className={!showAddGoal ? "bg-[#279d48] hover:bg-emerald-600" : ""}
            >
              {showAddGoal ? "Cancel" : (
                <>
                  <PlusCircle className="w-4 h-4 mr-2" />
                  New Goal
                </>
              )}
            </Button>
          </div>

          {showAddGoal && (
            <Card className="border-emerald-200 shadow-md">
              <form onSubmit={handleAddGoal} className="space-y-4">
                <h4 className="font-bold text-slate-900">Create Savings Goal</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Goal Title</label>
                    <Input required value={goalTitle} onChange={e => setGoalTitle(e.target.value)} placeholder="e.g., New Car" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Target Amount</label>
                    <Input required type="number" min="1" step="0.01" value={goalTarget} onChange={e => setGoalTarget(e.target.value)} placeholder="5000" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                    <Select value={goalCategory} onChange={e => setGoalCategory(e.target.value)}>
                      <option value="Emergency Fund">Emergency Fund</option>
                      <option value="Gadgets">Gadgets</option>
                      <option value="Travel">Travel</option>
                      <option value="House">House</option>
                      <option value="Vehicle">Vehicle</option>
                      <option value="Other">Other</option>
                    </Select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Target Date</label>
                    <Input required type="date" value={goalDeadline} onChange={e => setGoalDeadline(e.target.value)} />
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-4 mt-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h5 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <RefreshCw className="w-4 h-4 text-emerald-600" />
                        Auto-Contribute
                      </h5>
                      <p className="text-xs text-slate-500">Set up recurring contributions to reach your goal faster.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" checked={goalAutoContribute} onChange={e => setGoalAutoContribute(e.target.checked)} />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                    </label>
                  </div>

                  {goalAutoContribute && (
                    <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Amount</label>
                        <Input type="number" min="1" step="0.01" value={goalAutoAmount} onChange={e => setGoalAutoAmount(e.target.value)} placeholder="100" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Frequency</label>
                        <Select value={goalAutoFreq} onChange={e => setGoalAutoFreq(e.target.value as 'weekly' | 'monthly')}>
                          <option value="weekly">Weekly</option>
                          <option value="monthly">Monthly</option>
                        </Select>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2">
                    <div>
                      <h5 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <Bell className="w-4 h-4 text-amber-500" />
                        Goal Reminders
                      </h5>
                      <p className="text-xs text-slate-500">Get notified when you're falling behind schedule.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" checked={goalReminders} onChange={e => setGoalReminders(e.target.checked)} />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                    </label>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                  <Button type="button" variant="outline" onClick={() => setShowAddGoal(false)}>Cancel</Button>
                  <Button type="submit" className="bg-[#279d48] hover:bg-emerald-600">Save Goal</Button>
                </div>
              </form>
            </Card>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {goals.map(goal => {
              const progress = (goal.currentAmount / goal.targetAmount) * 100;
              const isCompleted = progress >= 100;
              const daysLeft = Math.ceil((new Date(goal.deadline).getTime() - new Date().getTime()) / (1000 * 3600 * 24));

              return (
                <Card key={goal.id} className={`relative overflow-hidden ${isCompleted ? 'border-emerald-200 bg-emerald-50/30' : ''}`}>
                  {isCompleted && (
                    <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-lg">
                      COMPLETED
                    </div>
                  )}
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h4 className="font-bold text-slate-900 text-lg">{goal.title}</h4>
                      <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-full mt-1 inline-block">
                        {goal.category}
                      </span>
                    </div>
                    <button onClick={() => handleDeleteGoal(goal.id)} className="text-slate-400 hover:text-rose-500">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-2 mb-6">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium text-slate-900">{formatCurrency(goal.currentAmount)}</span>
                      <span className="text-slate-500">of {formatCurrency(goal.targetAmount)}</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2.5">
                      <div 
                        className={`h-2.5 rounded-full transition-all duration-500 ${isCompleted ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                        style={{ width: `${Math.min(progress, 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>{progress.toFixed(1)}%</span>
                      {daysLeft > 0 ? (
                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {daysLeft} days left</span>
                      ) : (
                        <span className={isCompleted ? 'text-emerald-600' : 'text-rose-500'}>
                          {isCompleted ? 'Goal reached!' : 'Deadline passed'}
                        </span>
                      )}
                    </div>
                  </div>

                  {contributeGoalId === goal.id ? (
                    <form onSubmit={handleContribute} className="flex gap-2">
                      <Input 
                        autoFocus
                        type="number" 
                        min="0.01" 
                        step="0.01" 
                        placeholder="Amount" 
                        value={contributionAmount} 
                        onChange={e => setContributionAmount(e.target.value)}
                        className="h-9"
                      />
                      <Button type="submit" size="sm" className="bg-[#279d48] hover:bg-emerald-600 shrink-0">Add</Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => setContributeGoalId(null)}>Cancel</Button>
                    </form>
                  ) : (
                    <Button 
                      variant="outline" 
                      className="w-full text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                      onClick={() => setContributeGoalId(goal.id)}
                      disabled={isCompleted}
                    >
                      <PlusCircle className="w-4 h-4 mr-2" />
                      Add Funds
                    </Button>
                  )}
                </Card>
              );
            })}
            
            {goals.length === 0 && !showAddGoal && (
              <div className="col-span-full text-center py-12 bg-white rounded-2xl border border-dashed border-slate-300">
                <Target className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-lg font-medium text-slate-900">No savings goals yet</h3>
                <p className="text-slate-500 mb-4">Set a goal to start tracking your savings progress.</p>
                <Button onClick={() => setShowAddGoal(true)} className="bg-[#279d48] hover:bg-emerald-600">
                  Create First Goal
                </Button>
              </div>
            )}
          </div>
        </motion.div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          {/* Investments Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-slate-900 text-white border-none">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-white/10 rounded-lg">
                  <Wallet className="w-5 h-5" />
                </div>
                <h3 className="font-medium text-slate-300">Total Invested</h3>
              </div>
              <p className="text-3xl font-bold">{formatCurrency(totalInvested)}</p>
              <div className="mt-4 flex items-center gap-2 text-emerald-400 text-sm font-medium">
                <TrendingUp className="w-4 h-4" />
                <span>Avg. Return: {avgReturn.toFixed(1)}%</span>
              </div>
            </Card>

            <Card className="md:col-span-2">
              <h3 className="font-bold text-slate-900 mb-4">5-Year Growth Projection</h3>
              <div className="h-[120px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={projectionData}>
                    <defs>
                      <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f29111" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#f29111" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                    <Tooltip 
                      formatter={(value: number) => [formatCurrency(value), 'Projected Value']}
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="value" 
                      stroke="#f29111" 
                      strokeWidth={3} 
                      fillOpacity={1} 
                      fill="url(#colorValue)" 
                      isAnimationActive={true}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card className="md:col-span-3 bg-indigo-50 border-indigo-100">
              <div className="flex items-start gap-3">
                <Sparkles className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-medium text-indigo-900 mb-1">AI Investment Insight</h3>
                  {loadingTip ? (
                    <div className="animate-pulse flex space-x-4 mt-2">
                      <div className="flex-1 space-y-2 py-1">
                        <div className="h-2 bg-indigo-200 rounded w-3/4"></div>
                        <div className="h-2 bg-indigo-200 rounded w-1/2"></div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-indigo-700 leading-relaxed">
                      {aiTip}
                    </p>
                  )}
                </div>
              </div>
            </Card>
          </div>

          {/* Investments List */}
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-900">Your Portfolio</h3>
            <Button 
              onClick={() => setShowAddInvestment(!showAddInvestment)} 
              size="sm" 
              variant={showAddInvestment ? "outline" : "primary"}
              className={!showAddInvestment ? "bg-[#f29111] hover:bg-orange-600 text-white border-none" : ""}
            >
              {showAddInvestment ? "Cancel" : (
                <>
                  <PlusCircle className="w-4 h-4 mr-2" />
                  Add Asset
                </>
              )}
            </Button>
          </div>

          {showAddInvestment && (
            <Card className="border-orange-200 shadow-md">
              <form onSubmit={handleAddInvestment} className="space-y-4">
                <h4 className="font-bold text-slate-900">Add Investment</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Asset Name</label>
                    <Input required value={invName} onChange={e => setInvName(e.target.value)} placeholder="e.g., S&P 500 ETF" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                    <Select value={invCategory} onChange={e => setInvCategory(e.target.value)}>
                      <option value="Stocks">Stocks</option>
                      <option value="Mutual Funds">Mutual Funds</option>
                      <option value="Crypto">Crypto</option>
                      <option value="Fixed Income">Fixed Income</option>
                      <option value="Real Estate">Real Estate</option>
                    </Select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Amount Invested</label>
                    <Input required type="number" min="1" step="0.01" value={invAmount} onChange={e => setInvAmount(e.target.value)} placeholder="1000" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Expected Return (%)</label>
                    <Input required type="number" step="0.1" value={invReturn} onChange={e => setInvReturn(e.target.value)} placeholder="7.5" />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setShowAddInvestment(false)}>Cancel</Button>
                  <Button type="submit" className="bg-[#f29111] hover:bg-orange-600 text-white border-none">Save Asset</Button>
                </div>
              </form>
            </Card>
          )}

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-4">Asset</th>
                    <th className="px-6 py-4">Category</th>
                    <th className="px-6 py-4 text-right">Amount</th>
                    <th className="px-6 py-4 text-right">Expected Return</th>
                    <th className="px-6 py-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {investments.map(inv => (
                    <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-slate-900">{inv.name}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                          {inv.category}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right font-medium">{formatCurrency(inv.amount)}</td>
                      <td className="px-6 py-4 text-right text-emerald-600 font-medium">+{inv.expectedReturnRate}%</td>
                      <td className="px-6 py-4 text-right">
                        <button onClick={() => handleDeleteInvestment(inv.id)} className="text-slate-400 hover:text-rose-500 p-1">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {investments.length === 0 && !showAddInvestment && (
                    <tr>
                      <td colSpan={5} className="px-6 py-16 text-center">
                        <div className="flex flex-col items-center justify-center">
                          <div className="w-16 h-16 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mb-4">
                            <Wallet className="w-8 h-8" />
                          </div>
                          <h3 className="text-lg font-medium text-slate-900 mb-2">No investments added yet</h3>
                          <p className="text-slate-500 mb-6 max-w-sm">
                            Start building your portfolio to track your assets and project your future wealth.
                          </p>
                          <Button onClick={() => setShowAddInvestment(true)} className="bg-[#f29111] hover:bg-orange-600 text-white border-none">
                            <PlusCircle className="w-4 h-4 mr-2" />
                            Add Your First Asset
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
