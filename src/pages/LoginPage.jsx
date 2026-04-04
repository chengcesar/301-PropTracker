import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

function formatAuthError(err) {
  const code = err?.code ?? '';
  const msg = err?.message?.replace(/^Firebase:\s*\(?|\)\.?$/gi, '').trim() ?? 'Something went wrong.';
  const map = {
    'auth/invalid-email': 'Enter a valid email address.',
    'auth/user-disabled': 'This account has been disabled.',
    'auth/user-not-found': 'No account found for this email.',
    'auth/wrong-password': 'Incorrect password.',
    'auth/invalid-credential': 'Incorrect email or password.',
    'auth/email-already-in-use': 'An account already exists with this email.',
    'auth/weak-password': 'Password should be at least 6 characters.',
    'auth/too-many-requests': 'Too many attempts. Try again later.',
    'auth/operation-not-allowed': 'Email sign-in is not enabled in Firebase (enable Email/Password in the console).',
  };
  return map[code] || msg;
}

export default function LoginPage() {
  const {
    loginWithGoogle,
    loginWithEmail,
    signupWithEmail,
    sendPasswordReset,
  } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignup, setIsSignup] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resetSending, setResetSending] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);
    try {
      if (isSignup) {
        await signupWithEmail(email.trim(), password);
        setSuccess('Account created. Check your email for a verification link (you can still sign in).');
        setPassword('');
      } else {
        await loginWithEmail(email.trim(), password);
      }
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user') {
        setError(formatAuthError(err));
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogle() {
    setError('');
    setSuccess('');
    try {
      await loginWithGoogle();
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user') {
        setError(formatAuthError(err));
      }
    }
  }

  async function handleForgotPassword() {
    setError('');
    setSuccess('');
    const trimmed = email.trim();
    if (!trimmed) {
      setError('Enter your email above, then click Forgot password.');
      return;
    }
    setResetSending(true);
    try {
      await sendPasswordReset(trimmed);
      setSuccess('If an account exists for that email, we sent a link to reset your password.');
    } catch (err) {
      setError(formatAuthError(err));
    } finally {
      setResetSending(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-overlay" />
      <div className="login-card">
        <div className="login-logo">
          <svg width="32" height="32" viewBox="0 0 90 90" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="65.6367" y="30.0342" width="12.3568" height="52.4532" fill="#6D2F20"/>
            <rect x="38.832" y="30.3232" width="12.2887" height="52.1643" fill="#6D2F20"/>
            <rect x="12" y="30.3232" width="12.2887" height="52.1643" fill="#6D2F20"/>
            <path d="M78.001 30.3232H65.623C65.5666 22.9727 59.5914 17.0313 52.2275 17.0312C44.8636 17.0312 38.8884 22.9726 38.832 30.3232H24.332V7H78.001V30.3232Z" fill="#6D2F20"/>
          </svg>
          <span className="login-logo-text">Property<span>Tracker</span></span>
        </div>
        <p className="login-subtitle">Track rental income and performance across your properties with a clear, intuitive dashboard.</p>

        <button className="google-btn" onClick={handleGoogle} type="button">
          <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.1 24.1 0 0 0 0 21.56l7.98-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
          Continue with Google
        </button>

        <div className="login-divider"><span>or</span></div>

        <form onSubmit={handleSubmit}>
          <div className="login-field">
            <label>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required autoComplete="email" />
          </div>
          <div className="login-field">
            <label>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 6 characters" required minLength={6} autoComplete={isSignup ? 'new-password' : 'current-password'} />
            {!isSignup && (
              <button type="button" className="login-forgot-link" onClick={handleForgotPassword} disabled={resetSending}>
                {resetSending ? 'Sending\u2026' : 'Forgot password?'}
              </button>
            )}
          </div>
          {error && <div className="login-error">{error}</div>}
          {success && <div className="login-success">{success}</div>}
          <button className="login-submit" type="submit" disabled={submitting}>
            {submitting ? 'Please wait\u2026' : (isSignup ? 'Create Account' : 'Sign In')}
          </button>
        </form>

        <p className="login-toggle">
          {isSignup ? 'Already have an account?' : "Don't have an account?"}
          <button type="button" onClick={() => { setIsSignup(!isSignup); setError(''); setSuccess(''); }}>
            {isSignup ? 'Sign in' : 'Create one'}
          </button>
        </p>
      </div>
    </div>
  );
}
