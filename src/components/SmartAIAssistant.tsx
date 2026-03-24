import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, X, Send, Sparkles, TrendingUp, ShieldAlert, ChevronDown, ChevronLeft, Bot } from 'lucide-react';
import { auth, db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Transaction, SavingsGoal, Investment, UserProfile } from '../types';
import { GoogleGenAI, Type } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface SmartAIAssistantProps {
  profile: UserProfile | null;
}

export function SmartAIAssistant({ profile }: SmartAIAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: 'Hi! I am your SUSU AI Assistant. I can help you with investment guidance, stock prices, or analyzing your spending. How can I help you today?',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [contextData, setContextData] = useState<any>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (isOpen && containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && !contextData) {
      fetchContextData();
    }
  }, [isOpen]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchContextData = async () => {
    if (!auth.currentUser) return;
    try {
      const [txSnap, goalsSnap, invSnap] = await Promise.all([
        getDocs(query(collection(db, 'transactions'), where('userId', '==', auth.currentUser.uid))),
        getDocs(query(collection(db, 'savingsGoals'), where('userId', '==', auth.currentUser.uid))),
        getDocs(query(collection(db, 'investments'), where('userId', '==', auth.currentUser.uid)))
      ]);

      const transactions = txSnap.docs.map(d => d.data() as Transaction);
      
      const totalIncome = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
      const totalExpense = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
      const surplus = totalIncome - totalExpense;

      setContextData({
        totalIncome,
        totalExpense,
        surplus,
        savingsGoals: goalsSnap.docs.map(d => d.data() as SavingsGoal),
        investments: invSnap.docs.map(d => d.data() as Investment),
        currency: profile?.currency || 'USD'
      });
    } catch (error) {
      console.error("Failed to fetch context data:", error);
    }
  };

  const handleSend = async (text: string = input) => {
    if (!text.trim()) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      if (!chatRef.current) {
        chatRef.current = ai.chats.create({
          model: "gemini-3.1-pro-preview",
          config: {
            systemInstruction: `You are the SUSU AI Assistant, an expert financial advisor. 
            The user's financial context: ${JSON.stringify(contextData)}.
            Provide clear, accurate, and concise answers about stocks, bonds, crypto, mutual funds, and investments.
            Cross-reference user savings and expense trends to suggest realistic investment options.
            For example, if they have a surplus, suggest how to invest it.
            Explain risk levels, expected returns, and diversification tips in simple language.
            Keep responses friendly, colorful (use emojis), and easy to read.
            Do not provide guaranteed financial advice.`,
          }
        });
      }

      const response = await chatRef.current.sendMessage({ message: text });
      
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.text || "I'm sorry, I couldn't process that request.",
        timestamp: new Date()
      };

      setMessages(prev => [...prev, aiMsg]);
    } catch (error) {
      console.error("AI Chat Error:", error);
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "Oops! I encountered an error while thinking. Please try again.",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  const quickReplies = [
    "Stock Prices",
    "Bonds Overview",
    "Investment Tips",
    "Analyze my surplus"
  ];

  return (
    <>
      {/* Floating Button */}
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 w-14 h-14 rounded-full bg-gradient-to-r from-[#279d48] to-[#1e7b38] text-white shadow-xl shadow-emerald-500/30 flex items-center justify-center z-40 ${isOpen ? 'hidden' : 'flex'}`}
      >
        <Sparkles className="w-6 h-6" />
      </motion.button>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Dimmed Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
              aria-hidden="true"
            />
            
            <motion.div
              ref={containerRef}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 md:inset-auto md:bottom-6 md:right-6 md:w-[400px] md:h-[650px] md:max-h-[85vh] bg-white md:rounded-2xl shadow-2xl border-0 md:border border-slate-100 flex flex-col z-50 overflow-hidden"
            >
            {/* Header */}
            <div className="bg-gradient-to-r from-[#279d48] to-[#1e7b38] p-4 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setIsOpen(false)}
                  className="md:hidden p-2 -ml-2 hover:bg-white/20 rounded-full transition-colors"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                  <Bot className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-lg leading-tight">SUSU Assistant</h3>
                  <p className="text-emerald-100 text-xs flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" /> Online
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="hidden md:block p-2 hover:bg-white/20 rounded-full transition-colors"
              >
                <ChevronDown className="w-5 h-5" />
              </button>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div 
                    className={`max-w-[85%] p-3 rounded-2xl ${
                      msg.role === 'user' 
                        ? 'bg-[#279d48] text-white rounded-tr-sm' 
                        : 'bg-white text-slate-800 shadow-sm border border-slate-100 rounded-tl-sm'
                    }`}
                  >
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    <span className={`text-[10px] mt-1 block ${msg.role === 'user' ? 'text-emerald-100' : 'text-slate-400'}`}>
                      {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </motion.div>
              ))}
              
              {isTyping && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-start"
                >
                  <div className="bg-white p-4 rounded-2xl rounded-tl-sm shadow-sm border border-slate-100 flex items-center gap-1">
                    <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </motion.div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Replies */}
            {messages.length < 3 && !isTyping && (
              <div className="px-4 pb-2 bg-slate-50 flex gap-2 overflow-x-auto no-scrollbar shrink-0">
                {quickReplies.map((reply, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSend(reply)}
                    className="whitespace-nowrap px-3 py-1.5 bg-emerald-50 text-[#279d48] border border-emerald-100 rounded-full text-xs font-medium hover:bg-emerald-100 transition-colors"
                  >
                    {reply}
                  </button>
                ))}
              </div>
            )}

            {/* Input Area */}
            <div className="p-4 bg-white border-t border-slate-100 shrink-0">
              <form 
                onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about investments..."
                  className="flex-1 bg-slate-100 border-transparent focus:bg-white focus:border-[#279d48] focus:ring-2 focus:ring-emerald-100 rounded-full px-4 py-2.5 text-sm transition-all outline-none"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isTyping}
                  className="w-10 h-10 rounded-full bg-[#279d48] text-white flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed hover:bg-emerald-600 transition-colors shrink-0"
                >
                  <Send className="w-4 h-4 ml-0.5" />
                </button>
              </form>
            </div>
          </motion.div>
        </>
        )}
      </AnimatePresence>
    </>
  );
}
