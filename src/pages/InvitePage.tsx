import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { getShareByToken, acceptShare } from '../services/sharesService'

type State = 'loading' | 'accepting' | 'success' | 'already-active' | 'revoked' | 'not-found' | 'wrong-email' | 'error'

export function InvitePage() {
  const { token } = useParams<{ token: string }>()
  const { user, loading: authLoading } = useAuth() as unknown as { user: any; loading: boolean }
  const navigate = useNavigate()
  const [state, setState] = useState<State>('loading')
  const [shareId, setShareId] = useState<string | null>(null)
  const [errorDetail, setErrorDetail] = useState<string>('')

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      navigate(`/login?redirect=/invite/${token}`)
      return
    }

    async function process() {
      let share
      try {
        share = await getShareByToken(token!)
      } catch (err: any) {
        console.error('[InvitePage] getShareByToken failed:', err)
        setErrorDetail(`getShareByToken: ${err?.message ?? String(err)}`)
        setState('error')
        return
      }
      if (!share) { setState('not-found'); return }
      if (share.status === 'revoked') { setState('revoked'); return }
      if (share.status === 'active' && share.granteeUid === user.uid) {
        setShareId(share.id)
        setState('already-active')
        return
      }
      if (share.granteeEmail.toLowerCase() !== user.email?.toLowerCase()) {
        setState('wrong-email')
        return
      }
      setState('accepting')
      try {
        await acceptShare(share.id, user.uid)
      } catch (err: any) {
        console.error('[InvitePage] acceptShare failed:', err)
        setErrorDetail(err?.message ?? String(err))
        setState('error')
        return
      }
      setShareId(share.id)
      setState('success')
    }

    process()
  }, [token, user, authLoading, navigate])

  useEffect(() => {
    if ((state === 'success' || state === 'already-active') && shareId) {
      const timer = setTimeout(() => navigate(`/shared/${shareId}`), 1500)
      return () => clearTimeout(timer)
    }
  }, [state, shareId, navigate])

  const messages: Record<State, string> = {
    loading: 'Checking invite…',
    accepting: 'Accepting invite…',
    success: '✓ Access granted! Redirecting…',
    'already-active': 'You already have access. Redirecting…',
    revoked: 'This invite is no longer valid. Ask the owner to send a new one.',
    'not-found': 'This invite link is invalid.',
    'wrong-email': `This invite was sent to a different email address. Please sign in with the correct account.`,
    error: `Something went wrong accepting the invite. ${errorDetail}`,
  }

  const isError = state === 'revoked' || state === 'not-found' || state === 'wrong-email' || state === 'error'
  const isSuccess = state === 'success' || state === 'already-active'

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div style={{ textAlign: 'center', maxWidth: 380, padding: '0 24px' }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>
          {isSuccess ? '✓' : isError ? '✗' : '⏳'}
        </div>
        <p style={{ fontSize: 15, color: isError ? '#ef4444' : '#374151', lineHeight: 1.5 }}>
          {messages[state]}
        </p>
        {isError && (
          <button className="add-btn" style={{ marginTop: 20 }} onClick={() => navigate('/')}>
            Back to my portfolio
          </button>
        )}
      </div>
    </div>
  )
}
