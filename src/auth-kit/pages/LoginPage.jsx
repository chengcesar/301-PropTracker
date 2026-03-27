import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
  const { loginWithGoogle, loginWithEmail, signupWithEmail } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignup, setIsSignup] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setError('Free Trials are only available with Google Sign in');
    return;
    try {
      await signupWithEmail(email, password);
    } catch (err) {
      setError(err.message.replace('Firebase: ', '').replace(/\(auth\/.*\)/, '').trim());
    }
    setLoading(false);
  }

  async function handleGoogle() {
    setError('');
    try {
      await loginWithGoogle();
    } catch (err) {
      if (err.code !== 'auth/popup-closed-by-user') {
        setError(err.message.replace('Firebase: ', ''));
      }
    }
  }

  return (
    <div className="login-page">
      <div className="login-overlay" />
      <div className="login-card">
        <div className="login-logo">
          <svg width="32" height="32" viewBox="0 0 90 90" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M35.4551 56.9697C35.4551 56.384 35.9299 55.9091 36.5157 55.9091H54.546C55.1317 55.9091 55.6066 56.384 55.6066 56.9697V84.5455C55.6066 85.1312 55.1317 85.6061 54.546 85.6061H36.5157C35.9299 85.6061 35.4551 85.1312 35.4551 84.5455V56.9697Z" fill="#0539FF"/>
            <path d="M10 73.9394C10 73.3536 10.4748 72.8788 11.0606 72.8788H29.0909C29.6767 72.8788 30.1515 73.3536 30.1515 73.9394V84.5455C30.1515 85.1312 29.6767 85.6061 29.0909 85.6061H11.0606C10.4749 85.6061 10 85.1312 10 84.5455L10 73.9394Z" fill="#0539FF"/>
            <path d="M59.8477 46.2459C59.8477 45.6601 60.3225 45.1852 60.9083 45.1852H78.9386C79.5243 45.1852 79.9992 45.6601 79.9992 46.2458V84.4277C79.9992 85.0134 79.5243 85.4883 78.9386 85.4883H60.9083C60.3225 85.4883 59.8477 85.0134 59.8477 84.4277V46.2459Z" fill="#0539FF"/>
            <path d="M10 40C10 20.67 25.67 5 45 5C63.6176 5 78.8401 19.5364 79.9368 37.8785C80.0067 39.0479 79.0503 40 77.8788 40H61.3805C60.209 40 59.2758 39.0448 59.1036 37.886C58.0822 31.0133 52.1568 25.7407 45 25.7407C37.1248 25.7407 30.7407 32.1248 30.7407 40V65.9848C30.7407 67.1564 29.791 68.1061 28.6195 68.1061H12.1212C10.9497 68.1061 10 67.1564 10 65.9848V40Z" fill="#0539FF"/>
          </svg>
          <span className="login-logo-text">Portfolio<span>Tracker</span></span>
        </div>
        <p className="login-subtitle">Track stocks, ETFs, and real estate with a clear, intuitive dashboard.</p>

        <button className="google-btn" onClick={handleGoogle} type="button">
          <svg width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.1 24.1 0 0 0 0 21.56l7.98-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
          Continue with Google
        </button>

        <div className="login-divider"><span>or</span></div>

        <form onSubmit={handleSubmit}>
          <div className="login-field">
            <label>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required />
          </div>
          <div className="login-field">
            <label>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 6 characters" required minLength={6} />
          </div>
          {error && <div className="login-error">{error}</div>}
          <button className="login-submit" type="submit" disabled={loading}>
            {loading ? 'Please wait...' : isSignup ? 'Create Account' : 'Sign In'}
          </button>
        </form>

        <p className="login-toggle">
          {isSignup ? 'Already have an account?' : "Don't have an account?"}
          <button type="button" onClick={() => { setIsSignup(!isSignup); setError(''); }}>
            {isSignup ? 'Sign in' : 'Create one'}
          </button>
        </p>
      </div>
    </div>
  );
}
