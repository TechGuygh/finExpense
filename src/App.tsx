import React, { useState, useEffect } from 'react';
import { auth } from './firebase';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { Auth } from './components/Auth';
import { Dashboard } from './components/Dashboard';
import { TransactionForm } from './components/TransactionForm';
import { BudgetModule } from './components/BudgetModule';
import { Settings } from './components/Settings';
import { Button } from './components/UI';
import { db } from './firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { UserProfile } from './types';
import { 
  LayoutDashboard, 
  PlusCircle, 
  Target, 
  Settings as SettingsIcon, 
  Wallet,
  Menu,
  X,
  Sparkles,
  LogOut
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type Tab = 'dashboard' | 'add' | 'budgets' | 'settings';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 font-medium animate-pulse">Initializing FinAI...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'add', label: 'Add Transaction', icon: PlusCircle },
    { id: 'budgets', label: 'Budgets', icon: Target },
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row">
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex w-72 bg-white border-r border-slate-200 flex-col p-6 sticky top-0 h-screen">
        <div className="flex items-center gap-3 mb-10 px-2">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-100">
            <Wallet className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">FinAI</h1>
        </div>

        <nav className="flex-1 space-y-2">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as Tab)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
                activeTab === item.id
                  ? 'bg-indigo-50 text-indigo-600 shadow-sm'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <item.icon className={`w-5 h-5 ${activeTab === item.id ? 'text-indigo-600' : 'text-slate-400'}`} />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="mt-auto pt-6 border-t border-slate-100 flex flex-col gap-6">
          <div className="bg-indigo-600 rounded-2xl p-4 text-white relative overflow-hidden">
            <Sparkles className="absolute -right-2 -top-2 w-16 h-16 text-white/10 rotate-12" />
            <h4 className="text-sm font-bold mb-1">FinAI Premium</h4>
            <p className="text-[10px] text-indigo-100 mb-3">Unlock advanced AI forecasting and multi-currency support.</p>
            <Button size="sm" className="w-full bg-white text-indigo-600 hover:bg-indigo-50 border-none">
              Upgrade Now
            </Button>
          </div>
          
          <div className="flex items-center gap-3 px-2">
            <img 
              src={user.photoURL || `https://ui-avatars.com/api/?name=${profile?.displayName || user.displayName || 'Guest'}`} 
              alt="Profile" 
              className="w-10 h-10 rounded-full border-2 border-slate-100"
              referrerPolicy="no-referrer"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-900 truncate">{profile?.displayName || user.displayName || 'Guest User'}</p>
              <p className="text-xs text-slate-500 truncate">{profile?.email || user.email || 'Anonymous'}</p>
            </div>
            <button 
              onClick={() => signOut(auth)}
              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="lg:hidden bg-white border-b border-slate-200 p-4 sticky top-0 z-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <Wallet className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">FinAI</h1>
        </div>
        <div className="flex items-center gap-3">
          <img 
            src={user.photoURL || `https://ui-avatars.com/api/?name=${profile?.displayName || user.displayName || 'Guest'}`} 
            alt="Profile" 
            className="w-8 h-8 rounded-full border border-slate-200"
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
            className="lg:hidden fixed inset-x-0 top-[73px] bg-white border-b border-slate-200 z-40 p-4 shadow-xl"
          >
            <nav className="space-y-2">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id as Tab);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
                    activeTab === item.id
                      ? 'bg-indigo-50 text-indigo-600'
                      : 'text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  {item.label}
                </button>
              ))}
            </nav>
            <div className="mt-4 pt-4 border-t border-slate-100">
              <button 
                onClick={() => signOut(auth)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-rose-600 hover:bg-rose-50 transition-colors"
              >
                <LogOut className="w-5 h-5" />
                Logout
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 p-4 lg:p-10 max-w-7xl mx-auto w-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-10">
          <div>
            <h2 className="text-3xl font-bold text-slate-900">
              {activeTab === 'dashboard' ? 'Financial Overview' : 
               activeTab === 'add' ? 'New Transaction' : 
               activeTab === 'budgets' ? 'Budget Planning' : 'Settings'}
            </h2>
            <p className="text-slate-500 mt-1">
              {activeTab === 'dashboard' ? 'Track your spending and get AI insights.' : 
               activeTab === 'add' ? 'Add a new income or expense record.' : 
               activeTab === 'budgets' ? 'Set monthly limits for your categories.' : 'Manage your profile and preferences.'}
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
            {activeTab === 'add' && (
              <div className="max-w-2xl mx-auto">
                <TransactionForm />
              </div>
            )}
            {activeTab === 'budgets' && <BudgetModule profile={profile} />}
            {activeTab === 'settings' && <Settings />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
