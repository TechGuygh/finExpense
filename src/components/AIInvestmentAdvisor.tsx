import React, { useState, useEffect } from 'react';
import { Card, Button, Input, Select } from './UI';
import { BrainCircuit, TrendingUp, AlertTriangle, Info, ShieldAlert, Sparkles, PieChartIcon, Activity } from 'lucide-react';
import { auth, db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Transaction, SavingsGoal, Investment, AIInvestmentPlan, UserProfile } from '../types';
import { getInvestmentAdvice } from '../services/geminiService';
import { formatCurrency } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

interface AIInvestmentAdvisorProps {
  profile: UserProfile | null;
}

export function AIInvestmentAdvisor({ profile }: AIInvestmentAdvisorProps) {
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<AIInvestmentPlan | null>(null);
  const [riskTolerance, setRiskTolerance] = useState('medium');
  const [investmentHorizon, setInvestmentHorizon] = useState('5-10 years');

  const generatePlan = async () => {
    if (!auth.currentUser) return;
    setLoading(true);

    try {
      // Fetch user data
      const [txSnap, goalsSnap, invSnap] = await Promise.all([
        getDocs(query(collection(db, 'transactions'), where('userId', '==', auth.currentUser.uid))),
        getDocs(query(collection(db, 'savingsGoals'), where('userId', '==', auth.currentUser.uid))),
        getDocs(query(collection(db, 'investments'), where('userId', '==', auth.currentUser.uid)))
      ]);

      const transactions = txSnap.docs.map(d => ({ id: d.id, ...d.data() } as Transaction));
      const savingsGoals = goalsSnap.docs.map(d => ({ id: d.id, ...d.data() } as SavingsGoal));
      const investments = invSnap.docs.map(d => ({ id: d.id, ...d.data() } as Investment));

      const newPlan = await getInvestmentAdvice(transactions, savingsGoals, investments, riskTolerance, investmentHorizon);
      setPlan(newPlan);
    } catch (error) {
      console.error("Failed to generate plan:", error);
    } finally {
      setLoading(false);
    }
  };

  const chartData = plan?.recommendations.map(r => ({
    name: r.assetClass,
    value: r.allocationPercentage
  })) || [];

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <BrainCircuit className="w-6 h-6 text-indigo-600" />
            AI Investment Advisor
          </h2>
          <p className="text-slate-500">Personalized, data-driven investment strategies</p>
        </div>
      </div>

      <Card className="bg-white border-slate-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Risk Tolerance</label>
            <Select value={riskTolerance} onChange={e => setRiskTolerance(e.target.value)}>
              <option value="low">Low (Conservative)</option>
              <option value="medium">Medium (Moderate)</option>
              <option value="high">High (Aggressive)</option>
            </Select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Investment Horizon</label>
            <Select value={investmentHorizon} onChange={e => setInvestmentHorizon(e.target.value)}>
              <option value="< 1 year">Less than 1 year</option>
              <option value="1-5 years">1 to 5 years</option>
              <option value="5-10 years">5 to 10 years</option>
              <option value="10+ years">10+ years</option>
            </Select>
          </div>
          <Button 
            onClick={generatePlan} 
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {loading ? <Sparkles className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
            {plan ? "Regenerate Plan" : "Generate AI Plan"}
          </Button>
        </div>
      </Card>

      <AnimatePresence mode="wait">
        {loading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="py-12 text-center">
            <div className="w-16 h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900">Analyzing your financial profile...</h3>
            <p className="text-slate-500">Our AI is crafting your personalized investment strategy.</p>
          </motion.div>
        )}

        {!loading && !plan && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="py-16 text-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
            <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <TrendingUp className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Ready to grow your wealth?</h3>
            <p className="text-slate-500 max-w-md mx-auto mb-6">
              Set your risk tolerance and investment horizon above to get a personalized, AI-driven investment plan tailored to your financial goals.
            </p>
          </motion.div>
        )}

        {!loading && plan && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            
            {/* Summary & Risk Profile */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white border-none">
                <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
                  <Info className="w-5 h-5" /> Financial Summary
                </h3>
                <p className="text-indigo-50 leading-relaxed text-sm">{plan.summary}</p>
              </Card>
              <Card className="bg-white border-slate-200">
                <h3 className="text-lg font-bold text-slate-900 mb-2 flex items-center gap-2">
                  <Activity className="w-5 h-5 text-indigo-600" /> Assessed Risk Profile
                </h3>
                <p className="text-slate-600 leading-relaxed text-sm">{plan.riskProfile}</p>
              </Card>
            </div>

            {/* Allocation & Recommendations */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-1 p-6">
                <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                  <PieChartIcon className="w-5 h-5 text-indigo-600" />
                  Recommended Allocation
                </h3>
                <div className="h-[250px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => `${value}%`} />
                      <Legend verticalAlign="bottom" height={36}/>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card className="lg:col-span-2 p-6">
                <h3 className="text-lg font-bold text-slate-900 mb-4">Asset Class Breakdown</h3>
                <div className="space-y-4">
                  {plan.recommendations.map((rec, idx) => (
                    <div key={idx} className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex flex-col sm:flex-row gap-4">
                      <div className="sm:w-1/4 shrink-0">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                          <span className="font-bold text-slate-900">{rec.assetClass}</span>
                        </div>
                        <div className="text-2xl font-bold text-indigo-600">{rec.allocationPercentage}%</div>
                        <div className="text-xs text-slate-500 mt-1">Exp. Return: {rec.expectedReturn}%</div>
                      </div>
                      <div className="sm:w-3/4">
                        <p className="text-sm text-slate-600 mb-2">{rec.reasoning}</p>
                        <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${
                          rec.riskLevel === 'low' ? 'bg-emerald-100 text-emerald-700' :
                          rec.riskLevel === 'medium' ? 'bg-amber-100 text-amber-700' :
                          'bg-rose-100 text-rose-700'
                        }`}>
                          Risk: {rec.riskLevel.charAt(0).toUpperCase() + rec.riskLevel.slice(1)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            {/* Scenarios & Tips */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="bg-white">
                <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-indigo-600" />
                  "What-If" Scenarios
                </h3>
                <div className="space-y-4">
                  {plan.scenarios.map((scenario, idx) => (
                    <div key={idx} className="p-3 rounded-lg bg-slate-50 border border-slate-100 border-l-4 border-l-indigo-500">
                      <div className="flex justify-between items-start mb-1">
                        <h4 className="font-bold text-slate-900 text-sm">{scenario.scenarioName}</h4>
                        <span className="font-bold text-indigo-600">{formatCurrency(scenario.projectedValue, profile?.currency)}</span>
                      </div>
                      <p className="text-xs text-slate-500">{scenario.description}</p>
                    </div>
                  ))}
                </div>
              </Card>

              <div className="space-y-6">
                <Card className="bg-amber-50 border-amber-100">
                  <h3 className="text-lg font-bold text-amber-900 mb-3 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-amber-600" />
                    AI Insights & Tips
                  </h3>
                  <ul className="space-y-2">
                    {plan.tips.map((tip, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-amber-800">
                        <span className="text-amber-500 mt-0.5">•</span>
                        {tip}
                      </li>
                    ))}
                  </ul>
                </Card>

                <Card className="bg-emerald-50 border-emerald-100">
                  <h3 className="text-sm font-bold text-emerald-900 mb-1">Behavioral Nudge</h3>
                  <p className="text-sm text-emerald-800">{plan.behavioralNudge}</p>
                </Card>
              </div>
            </div>

            {/* Disclaimer */}
            <div className="flex items-start gap-3 p-4 bg-slate-100 rounded-xl text-slate-500 text-xs">
              <ShieldAlert className="w-5 h-5 shrink-0 text-slate-400" />
              <p>
                <strong>Disclaimer:</strong> This investment plan is generated by AI based on the data provided and is for informational and educational purposes only. It does not constitute professional financial advice. Always conduct your own research or consult with a certified financial advisor before making investment decisions.
              </p>
            </div>

          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
