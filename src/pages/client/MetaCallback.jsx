import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CheckCircle, AlertCircle } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

export default function MetaCallback() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { profile } = useAuth()

  const [step, setStep] = useState('exchanging') // exchanging | pick | done | error
  const [accounts, setAccounts] = useState([])
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  const clientId = profile?.client_id
  const code = searchParams.get('code')

  useEffect(() => {
    if (!code || !clientId) {
      setError('Missing authorisation code or client ID. Please try again.')
      setStep('error')
      return
    }

    async function exchange() {
      try {
        const res = await fetch('/api/meta/callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, client_id: clientId }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to connect')

        if (data.accounts.length === 1) {
          // Only one account — auto-select it
          await selectAccount(data.accounts[0].id)
        } else if (data.accounts.length > 1) {
          setAccounts(data.accounts)
          setStep('pick')
        } else {
          setError('No ad accounts found on this Facebook account.')
          setStep('error')
        }
      } catch (err) {
        setError(err.message)
        setStep('error')
      }
    }

    exchange()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, clientId])

  async function selectAccount(adAccountId) {
    setSaving(true)
    try {
      const res = await fetch('/api/meta/select-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId, ad_account_id: adAccountId }),
      })
      if (!res.ok) throw new Error('Failed to save account')
      setStep('done')
      setTimeout(() => navigate('/client'), 2000)
    } catch (err) {
      setError(err.message)
      setStep('error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white p-6">
      <div className="w-full max-w-sm text-center space-y-4">

        {step === 'exchanging' && (
          <>
            <div className="w-8 h-8 border-2 border-vc-border border-t-gold rounded-full animate-spin mx-auto" />
            <p className="text-sm text-vc-muted">Connecting your Meta Ads account…</p>
          </>
        )}

        {step === 'pick' && (
          <>
            <div className="w-10 h-10 bg-gold flex items-center justify-center mx-auto">
              <span className="text-white font-bold text-lg">V</span>
            </div>
            <h2 className="text-lg font-semibold text-vc-text">Choose your Ad Account</h2>
            <p className="text-sm text-vc-muted">We found {accounts.length} ad accounts. Select the one you'd like to connect.</p>
            <div className="space-y-2 text-left mt-4">
              {accounts.map((acc) => (
                <button
                  key={acc.id}
                  onClick={() => selectAccount(acc.id)}
                  disabled={saving}
                  className="w-full border border-vc-border px-4 py-3 text-left hover:border-gold hover:bg-amber-50 transition-colors disabled:opacity-50"
                >
                  <p className="text-sm font-medium text-vc-text">{acc.name}</p>
                  <p className="text-xs text-vc-muted mt-0.5">{acc.id} · {acc.currency}</p>
                </button>
              ))}
            </div>
          </>
        )}

        {step === 'done' && (
          <>
            <CheckCircle size={40} className="text-green-500 mx-auto" />
            <h2 className="text-lg font-semibold text-vc-text">Meta Ads Connected!</h2>
            <p className="text-sm text-vc-muted">Your ad data will now sync automatically. Redirecting to your dashboard…</p>
          </>
        )}

        {step === 'error' && (
          <>
            <AlertCircle size={40} className="text-red-500 mx-auto" />
            <h2 className="text-lg font-semibold text-vc-text">Connection failed</h2>
            <p className="text-sm text-vc-muted">{error}</p>
            <button
              onClick={() => navigate('/client')}
              className="text-sm text-gold underline mt-2"
            >
              Back to dashboard
            </button>
          </>
        )}

      </div>
    </div>
  )
}
