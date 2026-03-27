import { useEffect } from 'react';

export function AuthConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  loading = false,
  variant = 'primary',
  error = '',
}) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onCancel?.();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="auth-modal-overlay"
      onClick={(e) => e.target === e.currentTarget && onCancel?.()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
    >
      <div className="auth-modal confirm-dialog" onClick={(e) => e.stopPropagation()}>
        <h2 id="confirm-dialog-title" className="auth-modal-title confirm-dialog-title">
          {title}
        </h2>
        <p className="confirm-dialog-message">{message}</p>
        {error && <div className="auth-modal-error">{error}</div>}
        <div className="auth-modal-actions">
          <button type="button" className="auth-btn-cancel" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </button>
          <button
            type="button"
            className={variant === 'danger' ? 'auth-btn-danger' : 'auth-btn-save'}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? 'Please wait\u2026' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
