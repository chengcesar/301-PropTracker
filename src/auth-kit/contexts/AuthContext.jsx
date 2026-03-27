import { createContext, useContext, useEffect, useState } from 'react';
import { auth, db, isConfigured } from '../firebase';
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

const AuthContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isConfigured || !auth) {
      setLoading(false);
      return;
    }
    return onAuthStateChanged(auth, async u => {
      if (u) {
        try {
          const snap = await getDoc(doc(db, 'users', u.uid));
          setIsAdmin(snap.exists() && snap.data().role === 'admin');
          const baseFields = { email: u.email, displayName: u.displayName || null, lastLoginAt: serverTimestamp() };
          if (!snap.exists()) baseFields.createdAt = serverTimestamp();
          await setDoc(doc(db, 'users', u.uid), baseFields, { merge: true });
          const today = new Date().toISOString().slice(0, 10);
          await updateDoc(doc(db, 'users', u.uid), {
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

  return (
    <AuthContext.Provider value={{ user, isAdmin, loading, isConfigured, loginWithGoogle, loginWithEmail, signupWithEmail, logout, deleteAccount }}>
      {children}
    </AuthContext.Provider>
  );
}
