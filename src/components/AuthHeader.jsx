import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { AuthConfirmDialog } from './AuthConfirmDialog';
import { ChangePasswordModal } from './ChangePasswordModal';
import { ACCENT_PRESETS, ACCENT_HEX_BY_PRESET } from '../lib/accentTheme';
import { useContext } from 'react';
import { AppStateContext } from '../context/app-state-context';

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

export default function AuthHeader() {
  const {
    user,
    isAdmin,
    logout,
    deleteAccount,
    accent,
    updateAccentPreset,
    changePassword,
    resendVerificationEmail,
  } = useAuth();
  const appState = useContext(AppStateContext);
  const [menuOpen, setMenuOpen] = useState(false);
  const [teamDropdownOpen, setTeamDropdownOpen] = useState(false);
  const teamDropdownRef = useRef(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [changePwOpen, setChangePwOpen] = useState(false);
  const [verifyMsg, setVerifyMsg] = useState('');
  const [verifyErr, setVerifyErr] = useState('');
  const [verifySending, setVerifySending] = useState(false);
  const menuRef = useRef(null);

  const hasPasswordProvider = Boolean(
    user?.providerData?.some((p) => p.providerId === 'password'),
  );

  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    if (menuOpen) {
      document.addEventListener('mousedown', handler);
      return () => document.removeEventListener('mousedown', handler);
    }
  }, [menuOpen]);

  useEffect(() => {
    const handler = (e) => {
      if (teamDropdownRef.current && !teamDropdownRef.current.contains(e.target)) setTeamDropdownOpen(false);
    };
    if (teamDropdownOpen) {
      document.addEventListener('mousedown', handler);
      return () => document.removeEventListener('mousedown', handler);
    }
  }, [teamDropdownOpen]);

  function openDeleteModal() {
    setDeleteError('');
    setMenuOpen(false);
    setDeleteModalOpen(true);
  }

  async function handleResendVerification() {
    setVerifyMsg('');
    setVerifyErr('');
    setVerifySending(true);
    try {
      await resendVerificationEmail();
      setVerifyMsg('Verification email sent.');
    } catch (err) {
      setVerifyErr(err?.message?.replace(/^Firebase:\s*/i, '') || 'Could not send email.');
    } finally {
      setVerifySending(false);
    }
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
            <rect x="65.6367" y="30.0342" width="12.3568" height="52.4532" fill="#6D2F20"/>
            <rect x="38.832" y="30.3232" width="12.2887" height="52.1643" fill="#6D2F20"/>
            <rect x="12" y="30.3232" width="12.2887" height="52.1643" fill="#6D2F20"/>
            <path d="M78.001 30.3232H65.623C65.5666 22.9727 59.5914 17.0313 52.2275 17.0312C44.8636 17.0312 38.8884 22.9726 38.832 30.3232H24.332V7H78.001V30.3232Z" fill="#6D2F20"/>
          </svg>
        </a>
      </div>
      {user && (
        <div className="header-right" ref={menuRef}>
          {isAdmin && (
            <Link to="/admin" className="admin-header-link" title="Admin console">
              Admin
            </Link>
          )}
          {appState && (
            <div className="header-team-dropdown" ref={teamDropdownRef}>
              <button
                type="button"
                className={`header-nav-link header-team-trigger${appState.selectedId === 'contacts' ? ' active' : ''}`}
                onClick={() => setTeamDropdownOpen((o) => !o)}
                aria-expanded={teamDropdownOpen}
                aria-haspopup="true"
              >
                Team
                <svg className="header-team-chevron" width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              {teamDropdownOpen && (
                <div className="header-user-menu header-team-menu" role="menu">
                  <div className="header-user-menu-title">Team</div>
                  <div className="header-user-menu-actions">
                    <button
                      type="button"
                      className={`header-user-menu-btn${appState.selectedId === 'contacts' ? ' header-user-menu-btn-active' : ''}`}
                      onClick={() => { appState.setSelectedId('contacts'); setTeamDropdownOpen(false); }}
                      role="menuitem"
                    >
                      Contacts
                    </button>
                    <Link
                      to="/settings/sharing"
                      className="header-user-menu-btn"
                      style={{ textDecoration: 'none', display: 'block', textAlign: 'left' }}
                      onClick={() => setTeamDropdownOpen(false)}
                      role="menuitem"
                    >
                      Sharing &amp; Access
                    </Link>
                    <Link
                      to="/shared-with-me"
                      className="header-user-menu-btn"
                      style={{ textDecoration: 'none', display: 'block', textAlign: 'left' }}
                      onClick={() => setTeamDropdownOpen(false)}
                      role="menuitem"
                    >
                      Shared with me
                    </Link>
                  </div>
                </div>
              )}
            </div>
          )}
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
              {user.email && !user.emailVerified && (
                <div className="header-email-verify-banner">
                  <span>Verify your email to secure your account.</span>
                  <button
                    type="button"
                    className="header-email-verify-btn"
                    onClick={handleResendVerification}
                    disabled={verifySending}
                  >
                    {verifySending ? 'Sending\u2026' : 'Resend link'}
                  </button>
                  {verifyMsg && <div className="header-email-verify-note header-email-verify-ok">{verifyMsg}</div>}
                  {verifyErr && <div className="header-email-verify-note header-email-verify-bad">{verifyErr}</div>}
                </div>
              )}
              <div className="header-user-menu-row">
                <span className="header-user-menu-label">Name</span>
                <span className="header-user-menu-value">{getDisplayName(user)}</span>
              </div>
              <div className="header-user-menu-row">
                <span className="header-user-menu-label">Email</span>
                <span className="header-user-menu-value">{user.email}</span>
              </div>
              <div className="header-user-menu-row">
                <span className="header-user-menu-label">Accent color</span>
                <div className="accent-picker">
                  {ACCENT_PRESETS.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      className={`accent-swatch${accent === p.id ? ' accent-swatch-active' : ''}`}
                      style={{ background: ACCENT_HEX_BY_PRESET[p.id]['--accent-bg'] }}
                      title={p.label}
                      onClick={() => updateAccentPreset(p.id)}
                    />
                  ))}
                </div>
              </div>
              <div className="header-user-menu-actions">
                {hasPasswordProvider && (
                  <button type="button" className="header-user-menu-btn" onClick={() => { setMenuOpen(false); setChangePwOpen(true); }}>
                    Change password
                  </button>
                )}
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
      <ChangePasswordModal
        open={changePwOpen}
        onClose={() => setChangePwOpen(false)}
        changePassword={changePassword}
      />
      <AuthConfirmDialog
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
