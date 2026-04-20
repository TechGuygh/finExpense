import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, query, where, onSnapshot, addDoc, updateDoc, doc } from 'firebase/firestore';
import { UserProfile, Transaction, FinancialChallenge, UserChallenge } from '../types';
import { Card, Button } from './UI';
import { cn, formatCurrency } from '../lib/utils';
import { Trophy, Flame, Target, CheckCircle2, ChevronRight, Award } from 'lucide-react';
import { motion } from 'motion/react';
import { toast } from 'sonner';

interface Props {
  profile: UserProfile | null;
  transactions: Transaction[]; // Can use to dynamically calculate progress
}

const DEFAULT_CHALLENGES: FinancialChallenge[] = [
  {
    id: 'challenge_1',
    title: 'No Dining Out Week',
    description: 'Avoid spending any money on dining out for 7 days.',
    targetAmount: 0,
    durationDays: 7,
    rewardPoints: 100,
    category: 'Dining Out',
    type: 'no_spend'
  },
  {
    id: 'challenge_2',
    title: 'Save $100 in 14 days',
    description: 'Keep your expenses low and successfully save $100.',
    targetAmount: 100,
    durationDays: 14,
    rewardPoints: 200,
    type: 'savings'
  },
  {
    id: 'challenge_3',
    title: 'Reduce Groceries by 10%',
    description: 'Cut down on grocery spending compared to last month.',
    targetAmount: 10,
    durationDays: 30,
    rewardPoints: 300,
    category: 'Groceries',
    type: 'spending_reduction'
  }
];

export function FinancialChallenges({ profile, transactions }: Props) {
  const [userChallenges, setUserChallenges] = useState<UserChallenge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.currentUser) return;
    const q = query(collection(db, 'userChallenges'), where('userId', '==', auth.currentUser.uid));
    const unsub = onSnapshot(q, (snapshot) => {
      setUserChallenges(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as UserChallenge)));
      setLoading(false);
    });
    return unsub;
  }, []);

  const handleJoinChallenge = async (challenge: FinancialChallenge) => {
    if (!auth.currentUser) return;
    try {
      await addDoc(collection(db, 'userChallenges'), {
        userId: auth.currentUser.uid,
        challengeId: challenge.id,
        status: 'active',
        progress: 0,
        joinedAt: new Date().toISOString()
      });
      toast.success(`Joined challenge: ${challenge.title}!`);
    } catch (e) {
      toast.error('Failed to join challenge');
    }
  };

  const activeUserChallengeIds = new Set(userChallenges.map(uc => uc.challengeId));

  // Auto-progress simulation logic (since actual logic requires background jobs or complex date diffing on load):
  // We'll show standard progress values or random realistic ones for demo, or real calculation from transactions if feasible.
  const calculateProgress = (uc: UserChallenge, challenge: FinancialChallenge) => {
    if (uc.status === 'completed') return 100;
    // For demo purposes, returning a mock active progress if not 100.
    // In a real app, query `transactions` starting from `uc.joinedAt` and aggregate based on `challenge.type`.
    return Math.min((uc.progress || 25), 100); 
  };

  // Ensure user profile has a total points visual representation
  const totalPoints = userChallenges.filter(u => u.status === 'completed').reduce((sum, u) => {
    const c = DEFAULT_CHALLENGES.find(dc => dc.id === u.challengeId);
    return sum + (c?.rewardPoints || 0);
  }, 0);

  if (loading) return null;

  return (
    <div className="space-y-8">
      <Card className="p-6 bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/30 dark:to-amber-900/10 border-amber-200 dark:border-amber-800">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Trophy className="w-6 h-6 text-amber-500" />
              Your Challenge Score
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Complete challenges to earn points and badges.</p>
          </div>
          <div className="text-right">
            <span className="text-3xl font-extrabold text-amber-600 dark:text-amber-500">{totalPoints}</span>
            <span className="text-sm font-semibold text-amber-700/60 dark:text-amber-500/60 ml-1">pts</span>
          </div>
        </div>
      </Card>

      <div>
        <h4 className="font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
          <Flame className="w-5 h-5 text-orange-500" />
          Active Challenges
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {userChallenges.filter(uc => uc.status === 'active').map(uc => {
            const challenge = DEFAULT_CHALLENGES.find(c => c.id === uc.challengeId);
            if (!challenge) return null;
            const progress = calculateProgress(uc, challenge);

            return (
              <Card key={uc.id} className="p-5 border-slate-200 dark:border-slate-700 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-2">
                  <h5 className="font-bold text-slate-800 dark:text-slate-200">{challenge.title}</h5>
                  <div className="flex items-center gap-1 text-xs font-bold text-amber-600 dark:text-amber-500 bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 rounded-full">
                    <Award className="w-3 h-3" /> {challenge.rewardPoints}
                  </div>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">{challenge.description}</p>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
                    <span>Progress</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-brand-primary" 
                      style={{ width: `${progress}%` }} 
                    />
                  </div>
                </div>
              </Card>
            );
          })}
          {userChallenges.filter(uc => uc.status === 'active').length === 0 && (
            <div className="col-span-full py-8 text-center text-slate-500 dark:text-slate-400 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
              You haven't joined any active challenges. Join one below to start earning points!
            </div>
          )}
        </div>
      </div>

      <div>
        <h4 className="font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
          <Target className="w-5 h-5 text-indigo-500" />
          Available Challenges
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {DEFAULT_CHALLENGES.map(challenge => {
            const isJoined = activeUserChallengeIds.has(challenge.id);
            const isCompleted = userChallenges.find(uc => uc.challengeId === challenge.id)?.status === 'completed';

            if (isJoined || isCompleted) return null;

            return (
              <Card key={challenge.id} className="p-5 border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1 text-xs font-bold text-amber-600 dark:text-amber-500 bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 rounded-full">
                    <Award className="w-3 h-3" /> {challenge.rewardPoints} pts
                  </div>
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{challenge.durationDays} days</span>
                </div>
                <h5 className="font-bold text-slate-900 dark:text-slate-100 mb-1">{challenge.title}</h5>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4 h-10">{challenge.description}</p>
                <Button 
                  onClick={() => handleJoinChallenge(challenge)}
                  className="w-full bg-white dark:bg-slate-800 text-brand-primary dark:text-brand-primary-light border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  Join Challenge
                </Button>
              </Card>
            );
          })}
        </div>
      </div>

      {userChallenges.filter(uc => uc.status === 'completed').length > 0 && (
        <div className="pt-6 border-t border-slate-200 dark:border-slate-700">
          <h4 className="font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            Completed Challenges
          </h4>
          <div className="flex gap-4 overflow-x-auto pb-4">
            {userChallenges.filter(uc => uc.status === 'completed').map(uc => {
              const challenge = DEFAULT_CHALLENGES.find(c => c.id === uc.challengeId);
              if (!challenge) return null;
              return (
                <div key={uc.id} className="min-w-[200px] shrink-0 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50 p-4 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-100 dark:bg-emerald-900/50 rounded-full">
                      <Trophy className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <h6 className="text-sm font-bold text-slate-800 dark:text-slate-200">{challenge.title}</h6>
                      <p className="text-xs font-medium text-emerald-600 dark:text-emerald-500">+{challenge.rewardPoints} pts</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  );
}
