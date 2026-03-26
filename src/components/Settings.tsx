import React, { useState, useEffect, useRef } from 'react';
import { db, auth } from '../firebase';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { UserProfile } from '../types';
import { Card, Button, Input } from './UI';
import { Settings as SettingsIcon, Globe, User, Save, CheckCircle2, Camera } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const CURRENCIES = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'AU$', name: 'Australian Dollar' },
  { code: 'NGN', symbol: '₦', name: 'Nigerian Naira' },
  { code: 'GHS', symbol: '₵', name: 'Ghanaian Cedi' },
];

interface SettingsProps {
  onSave?: () => void;
}

export function Settings({ onSave }: SettingsProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!auth.currentUser) return;

    const fetchProfile = async () => {
      const docRef = doc(db, 'users', auth.currentUser!.uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        setProfile(docSnap.data() as UserProfile);
      } else {
        const newProfile: UserProfile = {
          uid: auth.currentUser!.uid,
          displayName: auth.currentUser!.displayName || 'User',
          email: auth.currentUser!.email || '',
          currency: 'USD',
          createdAt: new Date().toISOString(),
        };
        await setDoc(docRef, newProfile);
        setProfile(newProfile);
      }
      setLoading(false);
    };

    fetchProfile();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !profile) return;

    setSaving(true);
    try {
      const docRef = doc(db, 'users', auth.currentUser.uid);
      await updateDoc(docRef, {
        currency: profile.currency,
        displayName: profile.displayName,
        photoURL: profile.photoURL || null,
      });
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        if (onSave) onSave();
      }, 1500);
    } catch (error) {
      console.error("Failed to update profile:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !auth.currentUser || !profile) return;

    setUploadingImage(true);
    try {
      // In a real app, you would upload to Firebase Storage here
      // For this demo, we'll convert to base64 to store in Firestore
      // Note: This is not recommended for production due to document size limits (1MB)
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const base64String = reader.result as string;
        
        // Update local state
        setProfile({ ...profile, photoURL: base64String });
        
        // Auto-save the image
        const docRef = doc(db, 'users', auth.currentUser!.uid);
        await updateDoc(docRef, {
          photoURL: base64String
        });
        setUploadingImage(false);
      };
    } catch (error) {
      console.error("Error uploading image:", error);
      setUploadingImage(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <form onSubmit={handleSave} className="space-y-6">
        <Card className="p-8 space-y-6">
          <div className="flex items-center gap-4 pb-6 border-b border-slate-100">
            <div className="relative group">
              <img 
                src={profile?.photoURL || auth.currentUser?.photoURL || `https://ui-avatars.com/api/?name=${profile?.displayName}`} 
                alt="Avatar" 
                className="w-20 h-20 rounded-full border-4 border-indigo-50 object-cover"
                referrerPolicy="no-referrer"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingImage}
                className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              >
                {uploadingImage ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Camera className="w-5 h-5 text-white" />
                )}
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleImageUpload} 
                accept="image/*" 
                className="hidden" 
              />
            </div>
            <div>
              <h4 className="text-lg font-bold text-slate-900">{profile?.displayName}</h4>
              <p className="text-sm text-slate-500">{profile?.email}</p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-xs text-indigo-600 font-medium mt-1 hover:underline"
              >
                Change Photo
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                <User className="w-3 h-3" />
                Display Name
              </label>
              <Input 
                value={profile?.displayName} 
                onChange={(e) => setProfile(prev => prev ? { ...prev, displayName: e.target.value } : null)}
                placeholder="Your Name"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                <Globe className="w-3 h-3" />
                Preferred Currency
              </label>
              <select
                value={profile?.currency}
                onChange={(e) => setProfile(prev => prev ? { ...prev, currency: e.target.value } : null)}
                className="flex h-10 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.symbol} - {c.name} ({c.code})
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-slate-400 mt-1">
                All amounts across the app will be displayed using this currency symbol.
              </p>
            </div>
          </div>

          <div className="pt-4 flex items-center justify-between">
            <AnimatePresence>
              {success && (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }} 
                  animate={{ opacity: 1, x: 0 }} 
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2 text-emerald-600 text-sm font-medium"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Settings saved successfully!
                </motion.div>
              )}
            </AnimatePresence>
            <Button type="submit" disabled={saving} className="ml-auto min-w-[120px]">
              {saving ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Save Changes
            </Button>
          </div>
        </Card>

        <Card className="p-6 bg-indigo-50/50 border-indigo-100">
          <h4 className="text-sm font-bold text-indigo-900 mb-2">Data Management</h4>
          <p className="text-xs text-indigo-700 mb-4 leading-relaxed">
            Your data is stored securely in our cloud database. You can export your transactions to CSV from the Dashboard at any time.
          </p>
        </Card>
      </form>
    </div>
  );
}
