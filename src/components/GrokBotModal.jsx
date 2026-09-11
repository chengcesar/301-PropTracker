import { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { firestore, auth } from '../lib/firebase'
import { doc, getDoc, updateDoc, deleteField } from 'firebase/firestore'

async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

function generateApiKey() {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array, b => b.toString(16).padStart(2, '0')).join('')
}

export default function GrokBotModal({ open, onClose }) {
  const { user } = useAuth()
  const [hasKey, setHasKey] = useState(false)
  const [newKey, setNewKey] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [confirmRevoke, setConfirmRevoke] = useState(false)

  useEffect(() => {
    if (!open || !user || !firestore) return
    checkKeyStatus()
  }, [open, user])

  async function checkKeyStatus() {
    if (!firestore || !auth?.currentUser) return
    try {
      const userDoc = await getDoc(doc(firestore, 'users', auth.currentUser.uid))
      const data = userDoc.data()
      setHasKey(Boolean(data?.agentApiKeyHash))
    } catch (err) {
      console.error('Error checking key status:', err)
    }
  }

  async function handleGenerate() {
    if (!firestore || !auth?.currentUser) return
    setLoading(true)
    setError('')
    setNewKey(null)
    setCopied(false)

    try {
      const key = generateApiKey()
      const hash = await sha256(key)
      await updateDoc(doc(firestore, 'users', auth.currentUser.uid), {
        agentApiKeyHash: hash,
        agentApiKeyCreatedAt: new Date().toISOString(),
      })
      setNewKey(key)
      setHasKey(true)
    } catch (err) {
      console.error('Error generating key:', err)
      setError(err?.message || 'Failed to generate API key')
    } finally {
      setLoading(false)
    }
  }

  async function handleRotate() {
    await handleGenerate()
  }

  async function handleRevoke() {
    if (!firestore || !auth?.currentUser) return
    setLoading(true)
    setError('')

    try {
      await updateDoc(doc(firestore, 'users', auth.currentUser.uid), {
        agentApiKeyHash: deleteField(),
        agentApiKeyCreatedAt: deleteField(),
      })
      setHasKey(false)
      setNewKey(null)
      setConfirmRevoke(false)
    } catch (err) {
      console.error('Error revoking key:', err)
      setError(err?.message || 'Failed to revoke API key')
    } finally {
      setLoading(false)
    }
  }

  async function handleCopy() {
    if (!newKey) return
    try {
      await navigator.clipboard.writeText(newKey)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Failed to copy to clipboard')
    }
  }

  function handleClose() {
    setNewKey(null)
    setError('')
    setCopied(false)
    setConfirmRevoke(false)
    onClose()
  }

  if (!open) return null

  return (
    <div className="auth-modal-overlay" onClick={handleClose}>
      <div className="auth-modal grok-bot-modal" onClick={e => e.stopPropagation()}>
        <div className="grok-bot-header">
          <div className="grok-bot-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/>
              <path d="M2 17l10 5 10-5"/>
              <path d="M2 12l10 5 10-5"/>
            </svg>
          </div>
          <h2 className="auth-modal-title">Connect Grok Bot</h2>
        </div>

        <p className="grok-bot-desc">
          Generate an API key to let Grok Bot access your portfolio data. The key is shown only once — copy it securely.
        </p>

        {error && <div className="auth-modal-error">{error}</div>}

        {newKey && (
          <div className="grok-bot-key-display">
            <label>Your API Key (shown once)</label>
            <div className="grok-bot-key-row">
              <code className="grok-bot-key-value">{newKey}</code>
              <button
                type="button"
                className="grok-bot-copy-btn"
                onClick={handleCopy}
                title="Copy to clipboard"
              >
                {copied ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 6L9 17l-5-5"/>
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                  </svg>
                )}
              </button>
            </div>
            <p className="grok-bot-key-warning">
              Copy this key now. You won't be able to see it again.
            </p>
          </div>
        )}

        {!newKey && hasKey && (
          <div className="grok-bot-status">
            <div className="grok-bot-status-badge grok-bot-status-active">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 6L9 17l-5-5"/>
              </svg>
              API key active
            </div>
            <p className="grok-bot-status-note">
              A key is connected. Rotate to generate a new one (invalidates the old key).
            </p>
          </div>
        )}

        {!newKey && !hasKey && (
          <div className="grok-bot-status">
            <div className="grok-bot-status-badge grok-bot-status-inactive">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/>
                <path d="M15 9l-6 6M9 9l6 6"/>
              </svg>
              No API key
            </div>
            <p className="grok-bot-status-note">
              Generate a key to connect Grok Bot.
            </p>
          </div>
        )}

        {confirmRevoke && (
          <div className="grok-bot-confirm-revoke">
            <p>Revoke this API key? Grok Bot will lose access.</p>
            <div className="grok-bot-confirm-actions">
              <button
                type="button"
                className="auth-btn-cancel"
                onClick={() => setConfirmRevoke(false)}
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="auth-btn-danger"
                onClick={handleRevoke}
                disabled={loading}
              >
                {loading ? 'Revoking…' : 'Revoke'}
              </button>
            </div>
          </div>
        )}

        <div className="auth-modal-actions">
          <button type="button" className="auth-btn-cancel" onClick={handleClose}>
            Close
          </button>
          {!confirmRevoke && (
            <>
              {hasKey ? (
                <>
                  <button
                    type="button"
                    className="header-user-menu-btn grok-bot-revoke-btn"
                    onClick={() => setConfirmRevoke(true)}
                    disabled={loading}
                  >
                    Revoke
                  </button>
                  <button
                    type="button"
                    className="auth-btn-save"
                    onClick={handleRotate}
                    disabled={loading}
                  >
                    {loading ? 'Rotating…' : 'Rotate Key'}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="auth-btn-save"
                  onClick={handleGenerate}
                  disabled={loading}
                >
                  {loading ? 'Generating…' : 'Generate Key'}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
