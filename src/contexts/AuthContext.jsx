import { createContext, useContext, useEffect, useState } from 'react';
import { auth, firestore, isConfigured } from '../lib/firebase.ts';
import {
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  deleteUser,
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, increment, serverTimestamp } from 'firebase/firestore';
import { setAccentPreset as applyAccentPreset, getStoredAccent } from '../lib/accentTheme';

const AuthContext = createContext(null);

/** Admins from Firestore users/{uid}.role (preferred). These emails are also admin if role is missing. */
function adminEmailAllowlist() {
  const fromEnv = (import.meta.env.VITE_ADMIN_EMAILS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return new Set([
    ...fromEnv,
    // Legacy allowlist from pre–Firestore-role AdminPage; add VITE_ADMIN_EMAILS or role: "admin" instead
    'cheng.cesar@gmail.com',
  ]);
}

function firestoreRoleIsAdmin(data) {
  if (!data || typeof data.role !== 'string') return false;
  return data.role.toLowerCase() === 'admin';
}

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [accent, setAccent] = useState(() => getStoredAccent());

  useEffect(() => {
    if (!isConfigured || !auth) {
      setLoading(false);
      return;
    }
    return onAuthStateChanged(auth, async u => {
      if (u) {
        try {
          const snap = await getDoc(doc(firestore, 'users', u.uid));
          const data = snap.exists() ? snap.data() : null;
          const email = u.email ? u.email.toLowerCase() : '';
          const allow = adminEmailAllowlist();
          setIsAdmin(
            (data && firestoreRoleIsAdmin(data)) || (Boolean(email) && allow.has(email)),
          );
          const savedAccent = data?.accentPreset;
          if (savedAccent === 'blue' || savedAccent === 'teal' || savedAccent === 'terracotta') {
            applyAccentPreset(savedAccent);
            setAccent(savedAccent);
          }
          const baseFields = { email: u.email, displayName: u.displayName || null, lastLoginAt: serverTimestamp() };
          if (!snap.exists()) baseFields.createdAt = serverTimestamp();
          await setDoc(doc(firestore, 'users', u.uid), baseFields, { merge: true });
          const today = new Date().toISOString().slice(0, 10);
          await updateDoc(doc(firestore, 'users', u.uid), {
            'usage.visits': increment(1),
            [`usage.visitsByDay.${today}`]: increment(1),
          });
        } catch {
          setIsAdmin(false);
        }
      } else {
        setIsAdmin(false);
      }
      setUser(u);
      setLoading(false);
    });
  }, []);

  const loginWithGoogle = () => {
    if (!auth) throw new Error('Firebase not configured');
    return signInWithPopup(auth, new GoogleAuthProvider());
  };
  const loginWithEmail = (email, pw) => {
    if (!auth) throw new Error('Firebase not configured');
    return signInWithEmailAndPassword(auth, email, pw);
  };
  const signupWithEmail = (email, pw) => {
    if (!auth) throw new Error('Firebase not configured');
    return createUserWithEmailAndPassword(auth, email, pw);
  };
  const logout = () => {
    if (!auth) return;
    return signOut(auth);
  };

  const deleteAccount = async () => {
    if (!auth?.currentUser) return;
    await deleteUser(auth.currentUser);
  };

  const updateAccentPreset = async (preset) => {
    applyAccentPreset(preset);
    setAccent(preset);
    if (auth?.currentUser && firestore) {
      try {
        await updateDoc(doc(firestore, 'users', auth.currentUser.uid), { accentPreset: preset });
      } catch { /* ignore */ }
    }
  };

  return (
    <AuthContext.Provider value={{ user, isAdmin, loading, isConfigured, loginWithGoogle, loginWithEmail, signupWithEmail, logout, deleteAccount, accent, updateAccentPreset }}>
      {children}
    </AuthContext.Provider>
  );
}
