import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import ConfirmDialog from './ConfirmDialog';

function getInitials(email) {
  const local = email.split('@')[0];
  const parts = local.split(/[._-]/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return local.slice(0, 2).toUpperCase();
}

function getDisplayName(user) {
  if (user.displayName && user.displayName.trim()) return user.displayName.trim();
  const local = user.email?.split('@')[0] ?? '';
  return local.replace(/[._-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) || 'Account';
}

export default function Header() {
  const { user, logout, deleteAccount } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const menuRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    if (menuOpen) {
      document.addEventListener('mousedown', handler);
      return () => document.removeEventListener('mousedown', handler);
    }
  }, [menuOpen]);

  function openDeleteModal() {
    setDeleteError('');
    setMenuOpen(false);
    setDeleteModalOpen(true);
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    setDeleteError('');
    try {
      await deleteAccount();
      setDeleteModalOpen(false);
    } catch (err) {
      if (err?.code === 'auth/requires-recent-login') {
        setDeleteError('For security, please sign out and sign in again, then try Delete account.');
      } else {
        setDeleteError(err?.message || 'Could not delete account.');
      }
    } finally {
      setDeleting(false);
    }
  }

  return (
    <header className="app-header">
      <div className="header-left">
        <a href="/" className="logo" style={{ cursor: 'pointer', textDecoration: 'none', color: 'inherit' }}>
          <svg width="26" height="26" viewBox="0 0 90 90" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M35.4551 56.9697C35.4551 56.384 35.9299 55.9091 36.5157 55.9091H54.546C55.1317 55.9091 55.6066 56.384 55.6066 56.9697V84.5455C55.6066 85.1312 55.1317 85.6061 54.546 85.6061H36.5157C35.9299 85.6061 35.4551 85.1312 35.4551 84.5455V56.9697Z" fill="#0539FF"/>
            <path d="M10 73.9394C10 73.3536 10.4748 72.8788 11.0606 72.8788H29.0909C29.6767 72.8788 30.1515 73.3536 30.1515 73.9394V84.5455C30.1515 85.1312 29.6767 85.6061 29.0909 85.6061H11.0606C10.4749 85.6061 10 85.1312 10 84.5455L10 73.9394Z" fill="#0539FF"/>
            <path d="M59.8477 46.2459C59.8477 45.6601 60.3225 45.1852 60.9083 45.1852H78.9386C79.5243 45.1852 79.9992 45.6601 79.9992 46.2458V84.4277C79.9992 85.0134 79.5243 85.4883 78.9386 85.4883H60.9083C60.3225 85.4883 59.8477 85.0134 59.8477 84.4277V46.2459Z" fill="#0539FF"/>
            <path d="M10 40C10 20.67 25.67 5 45 5C63.6176 5 78.8401 19.5364 79.9368 37.8785C80.0067 39.0479 79.0503 40 77.8788 40H61.3805C60.209 40 59.2758 39.0448 59.1036 37.886C58.0822 31.0133 52.1568 25.7407 45 25.7407C37.1248 25.7407 30.7407 32.1248 30.7407 40V65.9848C30.7407 67.1564 29.791 68.1061 28.6195 68.1061H12.1212C10.9497 68.1061 10 67.1564 10 65.9848V40Z" fill="#0539FF"/>
          </svg>
          <div className="logo-text">
            <span className="logo-line1">Portfolio</span>
            <span className="logo-line2">Tracker</span>
          </div>
        </a>
      </div>
      {user && (
        <div className="header-right" ref={menuRef}>
          <div className="header-account-wrap">
            <button
              type="button"
              className="header-user-trigger"
              onClick={() => setMenuOpen((o) => !o)}
              aria-expanded={menuOpen}
              aria-haspopup="true"
            >
              <span className="user-avatar" title={user.email}>{getInitials(user.email)}</span>
              <span className="user-email">{user.email}</span>
              <svg className="header-user-chevron" width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {menuOpen && (
              <div className="header-user-menu" role="menu">
              <div className="header-user-menu-title">Account settings</div>
              <div className="header-user-menu-row">
                <span className="header-user-menu-label">Name</span>
                <span className="header-user-menu-value">{getDisplayName(user)}</span>
              </div>
              <div className="header-user-menu-row">
                <span className="header-user-menu-label">Email</span>
                <span className="header-user-menu-value">{user.email}</span>
              </div>
              <div className="header-user-menu-actions">
                <button type="button" className="header-user-menu-btn header-user-menu-btn-danger" onClick={openDeleteModal}>
                  Delete account
                </button>
              </div>
            </div>
            )}
          </div>
          <button
            type="button"
            className="header-sign-out"
            onClick={() => logout()}
          >
            Sign out
          </button>
        </div>
      )}
      <ConfirmDialog
        open={deleteModalOpen}
        title="Delete account"
        message="Permanently delete your account and all portfolio data? This cannot be undone."
        confirmLabel="Delete account"
        cancelLabel="Cancel"
        onConfirm={handleDeleteAccount}
        onCancel={() => { setDeleteModalOpen(false); setDeleteError(''); }}
        loading={deleting}
        variant="danger"
        error={deleteError}
      />
    </header>
  );
}
