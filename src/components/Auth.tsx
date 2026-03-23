import React, { useState } from 'react';
import { auth } from '../firebase';
import { signInWithPopup, GoogleAuthProvider, signOut, signInAnonymously } from 'firebase/auth';
import { Button, Card } from './UI';
import { LogIn, LogOut, Wallet, User as UserIcon, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';

export function Auth() {
  const [loading, setLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleLogin = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      console.error("Login failed:", error);
      setErrorMsg(error.message || "Failed to sign in with Google.");
    } finally {
      setLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setGuestLoading(true);
    setErrorMsg(null);
    try {
      await signInAnonymously(auth);
    } catch (error: any) {
      console.error("Guest login failed:", error);
      if (error.code === 'auth/admin-restricted-operation' || error.code === 'auth/operation-not-allowed') {
        setErrorMsg("Guest login is disabled. Please enable 'Anonymous' in the Firebase Console under Authentication > Sign-in method.");
      } else {
        setErrorMsg(error.message || "Failed to sign in as guest.");
      }
    } finally {
      setGuestLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  if (auth.currentUser) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <Card className="max-w-md w-full text-center space-y-8 p-12">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200">
              <Wallet className="w-8 h-8 text-white" />
            </div>
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">FinAI</h1>
            <p className="text-slate-500">Smart Personal Finance powered by AI</p>
          </div>
          
          {errorMsg && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-left">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <p className="text-sm text-rose-700 font-medium leading-relaxed">{errorMsg}</p>
            </div>
          )}

          <div className="space-y-4">
            <Button 
              onClick={handleLogin} 
              disabled={loading || guestLoading} 
              className="w-full py-6 text-lg"
            >
              <LogIn className="w-5 h-5 mr-2" />
              {loading ? "Signing in..." : "Sign in with Google"}
            </Button>
            <Button 
              onClick={handleGuestLogin} 
              disabled={loading || guestLoading} 
              variant="outline"
              className="w-full py-6 text-lg"
            >
              <UserIcon className="w-5 h-5 mr-2" />
              {guestLoading ? "Signing in..." : "Continue as Guest"}
            </Button>
            <p className="text-xs text-slate-400 pt-2">
              By signing in, you agree to our Terms of Service and Privacy Policy.
            </p>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
