import React, { useState, useEffect } from 'react';
import { auth } from './firebase';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { Auth } from './components/Auth';
import { Dashboard } from './components/Dashboard';
import { TransactionForm } from './components/TransactionForm';
import { BudgetModule } from './components/BudgetModule';
import { SavingsInvestments } from './components/SavingsInvestments';
import { RecurringTransactions } from './components/RecurringTransactions';
import { AIInvestmentAdvisor } from './components/AIInvestmentAdvisor';
import { Analytics } from './components/Analytics';
import { SmartAIAssistant } from './components/SmartAIAssistant';
import { MarketInsights } from './components/MarketInsights';
import { Settings } from './components/Settings';
import { Button } from './components/UI';
import { db } from './firebase';
import { doc, onSnapshot, setDoc, collection, query, where, getDocs, addDoc, updateDoc } from 'firebase/firestore';
import { UserProfile, RecurringTransaction } from './types';
import { 
  LayoutDashboard, 
  PlusCircle, 
  Target, 
  Settings as SettingsIcon, 
  Menu,
  X,
  Sparkles,
  LogOut,
  PiggyBank,
  Repeat,
  BrainCircuit,
  BarChart3,
  Activity
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Logo } from './components/Logo';

type Tab = 'dashboard' | 'analytics' | 'add' | 'budgets' | 'savings' | 'recurring' | 'advisor' | 'market' | 'settings';

import { Toaster } from 'sonner';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setUser(user);
      if (!user) {
        setProfile(null);
        setIsAuthReady(true);
      }
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user) return;

    const docRef = doc(db, 'users', user.uid);
    const unsubscribeProfile = onSnapshot(docRef, async (docSnap) => {
      if (docSnap.exists()) {
        setProfile(docSnap.data() as UserProfile);
      } else {
        const newProfile: UserProfile = {
          uid: user.uid,
          displayName: user.displayName || 'User',
          email: user.email || '',
          currency: 'USD',
          createdAt: new Date().toISOString(),
        };
        await setDoc(docRef, newProfile);
        setProfile(newProfile);
      }
      setIsAuthReady(true);
    });

    return () => unsubscribeProfile();
  }, [user]);

  useEffect(() => {
    if (!user || !isAuthReady) return;

    const processRecurring = async () => {
      try {
        const q = query(collection(db, 'recurringTransactions'), where('userId', '==', user.uid));
        const snapshot = await getDocs(q);
        const today = new Date();
        
        for (const docSnap of snapshot.docs) {
          const rt = { id: docSnap.id, ...docSnap.data() } as RecurringTransaction;
          let nextDate = new Date(rt.nextDate);
          
          let updated = false;
          while (nextDate <= today) {
            // Create transaction
            await addDoc(collection(db, 'transactions'), {
              userId: user.uid,
              amount: rt.amount,
              type: rt.type,
              category: rt.category,
              description: rt.description,
              date: nextDate.toISOString(),
              isAiCategorized: false
            });

            // Calculate next date
            if (rt.frequency === 'daily') {
              nextDate.setDate(nextDate.getDate() + 1);
            } else if (rt.frequency === 'weekly') {
              nextDate.setDate(nextDate.getDate() + 7);
            } else if (rt.frequency === 'monthly') {
              nextDate.setMonth(nextDate.getMonth() + 1);
            } else if (rt.frequency === 'yearly') {
              nextDate.setFullYear(nextDate.getFullYear() + 1);
            }
            updated = true;
          }

          if (updated) {
            await updateDoc(doc(db, 'recurringTransactions', rt.id), {
              nextDate: nextDate.toISOString()
            });
          }
        }
      } catch (error) {
        console.error("Error processing recurring transactions:", error);
      }
    };

    processRecurring();
  }, [user, isAuthReady]);

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 font-medium animate-pulse">Initializing SUSU...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  const navGroups = [
    {
      title: 'Overview',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'analytics', label: 'Analytics', icon: BarChart3 },
      ]
    },
    {
      title: 'Management',
      items: [
        { id: 'add', label: 'Transactions', icon: PlusCircle },
        { id: 'recurring', label: 'Recurring', icon: Repeat },
        { id: 'budgets', label: 'Budgets', icon: Target },
      ]
    },
    {
      title: 'Wealth & AI',
      items: [
        { id: 'savings', label: 'Savings & Invest', icon: PiggyBank },
        { id: 'market', label: 'Market Insights', icon: Activity },
        { id: 'advisor', label: 'AI Advisor', icon: BrainCircuit },
      ]
    },
    {
      title: 'Preferences',
      items: [
        { id: 'settings', label: 'Settings', icon: SettingsIcon },
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row">
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex w-72 bg-white border-r border-slate-200 flex-col sticky top-0 h-screen">
        <div className="p-6 flex flex-col h-full overflow-hidden">
          <div className="flex items-center gap-3 mb-8 px-2 shrink-0">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-lg shadow-slate-100 border border-slate-100">
              <Logo className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">SUSU</h1>
          </div>

          {/* User Profile - Top */}
          <div className="flex items-center gap-3 px-4 py-3 mb-6 bg-slate-50 rounded-xl border border-slate-100 shrink-0">
            <img 
              src={profile?.photoURL || user.photoURL || `https://ui-avatars.com/api/?name=${profile?.displayName || user.displayName || 'Guest'}`} 
              alt="Profile" 
              className="w-10 h-10 rounded-full border-2 border-white shadow-sm object-cover"
              referrerPolicy="no-referrer"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-900 truncate">{profile?.displayName || user.displayName || 'Guest User'}</p>
              <p className="text-xs text-slate-500 truncate">{profile?.email || user.email || 'Anonymous'}</p>
            </div>
            <button 
              onClick={() => setShowLogoutConfirm(true)}
              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>

          {/* Scrollable Navigation */}
          <nav className="flex-1 overflow-y-auto pr-2 -mr-2 space-y-6 custom-scrollbar pb-12">
            {navGroups.map((group, idx) => (
              <div key={idx} className="space-y-1">
                <h3 className="px-4 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  {group.title}
                </h3>
                {group.items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id as Tab)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl font-medium transition-all ${
                      activeTab === item.id
                        ? 'bg-emerald-50 text-[#279d48] shadow-sm'
                        : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <item.icon className={`w-5 h-5 ${activeTab === item.id ? 'text-[#279d48]' : 'text-slate-400'}`} />
                    {item.label}
                  </button>
                ))}
              </div>
            ))}
          </nav>

          <div className="mt-6 pt-6 border-t border-slate-100 shrink-0">
            <div className="bg-[#279d48] rounded-2xl p-4 text-white relative overflow-hidden">
              <Sparkles className="absolute -right-2 -top-2 w-16 h-16 text-white/10 rotate-12" />
              <h4 className="text-sm font-bold mb-1">SUSU Premium</h4>
              <p className="text-[10px] text-white/80 mb-3">Unlock advanced AI forecasting and multi-currency support.</p>
              <Button size="sm" className="w-full bg-white text-[#279d48] hover:bg-emerald-50 border-none">
                Upgrade Now
              </Button>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="lg:hidden bg-white border-b border-slate-200 p-4 sticky top-0 z-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center border border-slate-100">
            <Logo className="w-5 h-5" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">SUSU</h1>
        </div>
        <div className="flex items-center gap-3">
          <img 
            src={profile?.photoURL || user.photoURL || `https://ui-avatars.com/api/?name=${profile?.displayName || user.displayName || 'Guest'}`} 
            alt="Profile" 
            className="w-8 h-8 rounded-full border border-slate-200 object-cover"
            referrerPolicy="no-referrer"
          />
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
          >
            {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="lg:hidden fixed inset-x-0 top-[73px] bottom-0 bg-white border-b border-slate-200 z-40 flex flex-col shadow-xl overflow-hidden"
          >
            <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-24">
              {/* User Profile - Mobile */}
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 mb-6">
                <div className="flex items-center gap-3 min-w-0">
                  <img 
                    src={profile?.photoURL || user.photoURL || `https://ui-avatars.com/api/?name=${profile?.displayName || user.displayName || 'Guest'}`} 
                    alt="Profile" 
                    className="w-10 h-10 rounded-full border-2 border-white shadow-sm shrink-0 object-cover"
                    referrerPolicy="no-referrer"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{profile?.displayName || user.displayName || 'Guest User'}</p>
                    <p className="text-xs text-slate-500 truncate">{profile?.email || user.email || 'Anonymous'}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowLogoutConfirm(true)}
                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors shrink-0"
                  title="Logout"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>

              {navGroups.map((group, idx) => (
                <div key={idx} className="space-y-1">
                  <h3 className="px-4 text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    {group.title}
                  </h3>
                  {group.items.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveTab(item.id as Tab);
                        setIsMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
                        activeTab === item.id
                          ? 'bg-emerald-50 text-[#279d48]'
                          : 'text-slate-500 hover:bg-slate-50'
                      }`}
                    >
                      <item.icon className="w-5 h-5" />
                      {item.label}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 p-4 lg:p-10 max-w-7xl mx-auto w-full pb-32">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-10">
          <div>
            <h2 className="text-3xl font-bold text-slate-900">
              {activeTab === 'dashboard' ? 'Financial Overview' : 
               activeTab === 'analytics' ? 'Income & Expenses' : 
               activeTab === 'add' ? 'New Transaction' : 
               activeTab === 'recurring' ? 'Recurring Transactions' : 
               activeTab === 'budgets' ? 'Budget Planning' : 
               activeTab === 'savings' ? 'Savings & Investments' : 
               activeTab === 'market' ? 'Market Insights' : 
               activeTab === 'advisor' ? 'AI Investment Advisor' : 'Settings'}
            </h2>
            <p className="text-slate-500 mt-1">
              {activeTab === 'dashboard' ? 'Track your spending and get AI insights.' : 
               activeTab === 'analytics' ? 'Visual insights into your financial health.' : 
               activeTab === 'add' ? 'Add a new income or expense record.' : 
               activeTab === 'recurring' ? 'Manage subscriptions and regular income.' : 
               activeTab === 'budgets' ? 'Set monthly limits for your categories.' : 
               activeTab === 'savings' ? 'Set goals and track your portfolio.' : 
               activeTab === 'market' ? 'Real-time market data and investment trends.' : 
               activeTab === 'advisor' ? 'Get personalized investment recommendations.' : 'Manage your profile and preferences.'}
            </p>
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            {activeTab === 'dashboard' && <Dashboard profile={profile} />}
            {activeTab === 'analytics' && <Analytics profile={profile} />}
            {activeTab === 'add' && (
              <div className="max-w-2xl mx-auto">
                <TransactionForm />
              </div>
            )}
            {activeTab === 'recurring' && <RecurringTransactions profile={profile} />}
            {activeTab === 'budgets' && <BudgetModule profile={profile} />}
            {activeTab === 'savings' && <SavingsInvestments profile={profile} />}
            {activeTab === 'market' && <MarketInsights profile={profile} />}
            {activeTab === 'advisor' && <AIInvestmentAdvisor profile={profile} />}
            {activeTab === 'settings' && <Settings onSave={() => setActiveTab('dashboard')} />}
          </motion.div>
        </AnimatePresence>
      </main>
      
      {/* Global Smart AI Assistant */}
      <SmartAIAssistant profile={profile} />
      
      {/* Logout Confirmation Modal */}
      <AnimatePresence>
        {showLogoutConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden"
            >
              <div className="p-6 text-center">
                <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <LogOut className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Log Out</h3>
                <p className="text-slate-500 mb-6">Are you sure you want to log out of your account?</p>
                <div className="flex gap-3">
                  <Button 
                    variant="outline" 
                    className="flex-1"
                    onClick={() => setShowLogoutConfirm(false)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    className="flex-1 bg-rose-600 hover:bg-rose-700 text-white border-none"
                    onClick={() => {
                      setShowLogoutConfirm(false);
                      signOut(auth);
                    }}
                  >
                    Log Out
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <Toaster position="top-center" richColors />
    </div>
  );
}
