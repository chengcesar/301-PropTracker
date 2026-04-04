import { useEffect, useState } from 'react';

export function ChangePasswordModal({ open, onClose, changePassword }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCurrent('');
    setNext('');
    setConfirm('');
    setError('');
    setDone(false);
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (next.length < 6) {
      setError('New password must be at least 6 characters.');
      return;
    }
    if (next !== confirm) {
      setError('New passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      await changePassword(current, next);
      setDone(true);
      setTimeout(() => {
        onClose?.();
      }, 1200);
    } catch (err) {
      if (err?.code === 'auth/invalid-credential' || err?.code === 'auth/wrong-password') {
        setError('Current password is incorrect.');
      } else if (err?.code === 'auth/requires-recent-login') {
        setError('For security, sign out and sign in again, then change your password.');
      } else if (err?.code === 'auth/weak-password') {
        setError('Password is too weak. Try a stronger one.');
      } else {
        setError(err?.message?.replace(/^Firebase:\s*/i, '') || 'Could not update password.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="auth-modal-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="change-pw-title"
    >
      <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
        <h2 id="change-pw-title" className="auth-modal-title">
          Change password
        </h2>
        {done ? (
          <p className="confirm-dialog-message" style={{ color: '#15803d' }}>
            Password updated successfully.
          </p>
        ) : (
          <form className="auth-modal-form" onSubmit={handleSubmit}>
            <div className="login-field">
              <label htmlFor="change-pw-current">Current password</label>
              <input
                id="change-pw-current"
                type="password"
                autoComplete="current-password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                required
              />
            </div>
            <div className="login-field">
              <label htmlFor="change-pw-new">New password</label>
              <input
                id="change-pw-new"
                type="password"
                autoComplete="new-password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <div className="login-field">
              <label htmlFor="change-pw-confirm">Confirm new password</label>
              <input
                id="change-pw-confirm"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={6}
              />
            </div>
            {error && <div className="auth-modal-error">{error}</div>}
            <div className="auth-modal-actions">
              <button type="button" className="auth-btn-cancel" onClick={onClose} disabled={loading}>
                Cancel
              </button>
              <button type="submit" className="auth-btn-save" disabled={loading}>
                {loading ? 'Please wait\u2026' : 'Update password'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
