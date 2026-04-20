import React, { useState, useEffect } from 'react';
import { auth } from './firebase';
import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { Auth } from './components/Auth';
import { Dashboard } from './components/Dashboard';
import { TransactionForm } from './components/TransactionForm';
import { BudgetModule } from './components/BudgetModule';
import { SavingsInvestments } from './components/SavingsInvestments';
import { AIInvestmentAdvisor } from './components/AIInvestmentAdvisor';
import { Analytics } from './components/Analytics';
import { SmartAIAssistant } from './components/SmartAIAssistant';
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
  BrainCircuit,
  BarChart3,
  Globe,
  Moon,
  Sun
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Logo } from './components/Logo';

type Tab = 'dashboard' | 'analytics' | 'add' | 'budgets' | 'savings' | 'advisor' | 'settings';

import { Toaster } from 'sonner';

const TRANSLATIONS: Record<string, Record<string, string>> = {
  EN: {
    dashboard: 'Financial Overview',
    analytics: 'Income & Expenses',
    add: 'New Transaction',
    recurring: 'Recurring Transactions',
    budgets: 'Budgets & Recurring',
    savings: 'Wealth & Markets',
    market: 'Market Insights',
    advisor: 'AI Investment Advisor',
    settings: 'Settings',
    desc_dashboard: 'Track your spending and get AI insights.',
    desc_analytics: 'Visual insights into your financial health.',
    desc_add: 'Add a new income or expense record.',
    desc_budgets: 'Manage budgets and recurring transactions.',
    desc_savings: 'Manage savings, investments and markets.',
    desc_advisor: 'Get personalized investment recommendations.',
    desc_settings: 'Manage your profile and preferences.',
    nav_overview: 'Overview',
    nav_management: 'Management',
    nav_wealth: 'Wealth & AI',
    nav_preferences: 'Preferences',
  },
  FR: {
    dashboard: 'Aperçu Financier',
    analytics: 'Revenus et Dépenses',
    add: 'Nouvelle Transaction',
    recurring: 'Transactions Récurrentes',
    budgets: 'Budgets et Récurrents',
    savings: 'Richesse et Marchés',
    market: 'Aperçus du Marché',
    advisor: 'Conseiller en Investissement IA',
    settings: 'Paramètres',
    desc_dashboard: 'Suivez vos dépenses et obtenez des conseils IA.',
    desc_analytics: 'Aperçus visuels de votre santé financière.',
    desc_add: 'Ajoutez un nouveau revenu ou une dépense.',
    desc_budgets: 'Gérez les budgets et les transactions récurrentes.',
    desc_savings: 'Gérez l\'épargne, les investissements et les marchés.',
    desc_advisor: 'Obtenez des recommandations d\'investissement personnalisées.',
    desc_settings: 'Gérez votre profil et vos préférences.',
    nav_overview: 'Aperçu',
    nav_management: 'Gestion',
    nav_wealth: 'Richesse et IA',
    nav_preferences: 'Préférences',
  },
  ES: {
    dashboard: 'Resumen Financiero',
    analytics: 'Ingresos y Gastos',
    add: 'Nueva Transacción',
    recurring: 'Transacciones Recurrentes',
    budgets: 'Presupuestos y Recurrentes',
    savings: 'Riqueza y Mercados',
    market: 'Perspectivas del Mercado',
    advisor: 'Asesor de Inversiones con IA',
    settings: 'Configuración',
    desc_dashboard: 'Haz un seguimiento de tus gastos y obtén consejos de IA.',
    desc_analytics: 'Perspectivas visuales de tu salud financiera.',
    desc_add: 'Añade un nuevo registro de ingresos o gastos.',
    desc_budgets: 'Gestiona presupuestos y transacciones recurrentes.',
    desc_savings: 'Gestiona ahorros, inversiones y mercados.',
    desc_advisor: 'Obtén recomendaciones de inversión personalizadas.',
    desc_settings: 'Gestiona tu perfil y preferencias.',
    nav_overview: 'Resumen',
    nav_management: 'Gestión',
    nav_wealth: 'Riqueza e IA',
    nav_preferences: 'Preferencias',
  }
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [language, setLanguage] = useState(localStorage.getItem('app_language') || 'EN');
  const [isDarkMode, setIsDarkMode] = useState(
    localStorage.getItem('app_theme') === 'dark' || 
    (!localStorage.getItem('app_theme') && window.matchMedia('(prefers-color-scheme: dark)').matches)
  );

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('app_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('app_theme', 'light');
    }
  }, [isDarkMode]);

  const toggleDarkMode = () => setIsDarkMode(!isDarkMode);

  const handleLanguageChange = (lang: string) => {
    setLanguage(lang);
    localStorage.setItem('app_language', lang);
  };

  const t = (key: string) => TRANSLATIONS[language]?.[key] || TRANSLATIONS['EN'][key] || key;

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
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 transition-colors duration-200">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-500 dark:text-slate-400 font-medium animate-pulse transition-colors duration-200">Initializing SUSU...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Auth />;
  }

  const navGroups = [
    {
      title: t('nav_overview'),
      items: [
        { id: 'dashboard', label: t('dashboard'), icon: LayoutDashboard },
        { id: 'analytics', label: t('analytics'), icon: BarChart3 },
      ]
    },
    {
      title: t('nav_management'),
      items: [
        { id: 'add', label: t('add'), icon: PlusCircle },
        { id: 'budgets', label: t('budgets'), icon: Target },
      ]
    },
    {
      title: t('nav_wealth'),
      items: [
        { id: 'savings', label: t('savings'), icon: PiggyBank },
        { id: 'advisor', label: t('advisor'), icon: BrainCircuit },
      ]
    },
    {
      title: t('nav_preferences'),
      items: [
        { id: 'settings', label: t('settings'), icon: SettingsIcon },
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col lg:flex-row transition-colors duration-200">
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex w-72 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex-col sticky top-0 h-screen transition-colors duration-200">
        <div className="p-6 flex flex-col h-full overflow-hidden">
          <div className="flex items-center gap-3 mb-8 px-2 shrink-0">
            <div className="w-10 h-10 bg-white dark:bg-slate-700 rounded-xl flex items-center justify-center shadow-lg shadow-slate-100 dark:shadow-none border border-slate-100 dark:border-slate-600 transition-colors duration-200">
              <Logo className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white transition-colors duration-200">SUSU</h1>
          </div>

          {/* User Profile - Top */}
          <div className="flex items-center gap-3 px-4 py-3 mb-6 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-100 dark:border-slate-600 shrink-0 transition-colors duration-200">
            <img 
              src={profile?.photoURL || user.photoURL || `https://ui-avatars.com/api/?name=${profile?.displayName || user.displayName || 'Guest'}`} 
              alt="Profile" 
              className="w-10 h-10 rounded-full border-2 border-white dark:border-slate-600 shadow-sm object-cover transition-colors duration-200"
              referrerPolicy="no-referrer"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-900 dark:text-white truncate transition-colors duration-200">{profile?.displayName || user.displayName || 'Guest User'}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate transition-colors duration-200">{profile?.email || user.email || 'Anonymous'}</p>
            </div>
            <button 
              onClick={() => setShowLogoutConfirm(true)}
              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>

          {/* Scrollable Navigation */}
          <nav className="flex-1 overflow-y-auto pr-2 -mr-2 space-y-6 custom-scrollbar pb-12">
            {navGroups.map((group, idx) => (
              <div key={idx} className="space-y-1">
                <h3 className="px-4 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 transition-colors duration-200">
                  {group.title}
                </h3>
                {group.items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id as Tab)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl font-medium transition-all ${
                      activeTab === item.id
                        ? 'bg-brand-primary-light dark:bg-brand-primary-dark/20 text-brand-primary dark:text-brand-primary-light shadow-sm'
                        : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <item.icon className={`w-5 h-5 ${activeTab === item.id ? 'text-brand-primary dark:text-brand-primary-light' : 'text-slate-400 dark:text-slate-500'}`} />
                    {item.label}
                  </button>
                ))}
              </div>
            ))}
          </nav>

        </div>
      </aside>

      {/* Mobile Header */}
      <header className="lg:hidden bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-4 sticky top-0 z-50 flex items-center justify-between transition-colors duration-200">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-white dark:bg-slate-700 rounded-lg flex items-center justify-center border border-slate-100 dark:border-slate-600 transition-colors duration-200">
            <Logo className="w-5 h-5" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white transition-colors duration-200">SUSU</h1>
        </div>
        <div className="flex items-center gap-3">
          <img 
            src={profile?.photoURL || user.photoURL || `https://ui-avatars.com/api/?name=${profile?.displayName || user.displayName || 'Guest'}`} 
            alt="Profile" 
            className="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-600 object-cover transition-colors duration-200"
            referrerPolicy="no-referrer"
          />
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="p-2 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
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
            className="lg:hidden fixed inset-x-0 top-[73px] bottom-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 z-40 flex flex-col shadow-xl overflow-hidden transition-colors duration-200"
          >
            <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-24">
              {/* User Profile - Mobile */}
              <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-100 dark:border-slate-600 mb-6 transition-colors duration-200">
                <div className="flex items-center gap-3 min-w-0">
                  <img 
                    src={profile?.photoURL || user.photoURL || `https://ui-avatars.com/api/?name=${profile?.displayName || user.displayName || 'Guest'}`} 
                    alt="Profile" 
                    className="w-10 h-10 rounded-full border-2 border-white dark:border-slate-600 shadow-sm shrink-0 object-cover transition-colors duration-200"
                    referrerPolicy="no-referrer"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 dark:text-white truncate transition-colors duration-200">{profile?.displayName || user.displayName || 'Guest User'}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate transition-colors duration-200">{profile?.email || user.email || 'Anonymous'}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowLogoutConfirm(true)}
                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors shrink-0"
                  title="Logout"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>

              {navGroups.map((group, idx) => (
                <div key={idx} className="space-y-1">
                  <h3 className="px-4 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 transition-colors duration-200">
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
                          ? 'bg-brand-primary-light dark:bg-brand-primary-dark/20 text-brand-primary dark:text-brand-primary-light'
                          : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                      }`}
                    >
                      <item.icon className={`w-5 h-5 ${activeTab === item.id ? 'text-brand-primary dark:text-brand-primary-light' : 'text-slate-400 dark:text-slate-500'}`} />
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
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white transition-colors duration-200">
              {t(activeTab)}
            </h2>
            <p className="text-slate-500 dark:text-slate-400 mt-1 transition-colors duration-200">
              {t(`desc_${activeTab}`)}
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="relative group">
              <button className="p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl transition-colors flex items-center gap-2">
                <Globe className="w-5 h-5" />
                <span className="text-sm font-medium hidden sm:block">{language}</span>
              </button>
              <div className="absolute right-0 top-full mt-2 w-40 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                <div className="p-2 space-y-1">
                  <button onClick={() => handleLanguageChange('EN')} className={`w-full text-left px-3 py-2 text-sm rounded-lg font-medium transition-colors ${language === 'EN' ? 'bg-brand-primary-light dark:bg-brand-primary-dark/20 text-brand-primary dark:text-brand-primary-light' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>English (EN)</button>
                  <button onClick={() => handleLanguageChange('FR')} className={`w-full text-left px-3 py-2 text-sm rounded-lg font-medium transition-colors ${language === 'FR' ? 'bg-brand-primary-light dark:bg-brand-primary-dark/20 text-brand-primary dark:text-brand-primary-light' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>French (FR)</button>
                  <button onClick={() => handleLanguageChange('ES')} className={`w-full text-left px-3 py-2 text-sm rounded-lg font-medium transition-colors ${language === 'ES' ? 'bg-brand-primary-light dark:bg-brand-primary-dark/20 text-brand-primary dark:text-brand-primary-light' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'}`}>Spanish (ES)</button>
                </div>
              </div>
            </div>
            
            <button 
              onClick={toggleDarkMode}
              className="p-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl transition-colors"
              title="Toggle Dark Mode"
            >
              {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
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
            {activeTab === 'budgets' && <BudgetModule profile={profile} />}
            {activeTab === 'savings' && <SavingsInvestments profile={profile} />}
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
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-sm overflow-hidden transition-colors duration-200"
            >
              <div className="p-6 text-center">
                <div className="w-16 h-16 bg-rose-100 dark:bg-rose-500/10 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4 transition-colors duration-200">
                  <LogOut className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 transition-colors duration-200">Log Out</h3>
                <p className="text-slate-500 dark:text-slate-400 mb-6 transition-colors duration-200">Are you sure you want to log out of your account?</p>
                <div className="flex gap-3">
                  <Button 
                    variant="outline" 
                    className="flex-1 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
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
