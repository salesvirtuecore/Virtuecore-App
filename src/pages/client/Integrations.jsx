import { useEffect, useState } from 'react'
import { RefreshCw, ExternalLink, CheckCircle, XCircle } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'

export default function Integrations() {
  const { profile, isDemo } = useAuth()
  const [metaConnected, setMetaConnected] = useState(null)
  const [metaAccountId, setMetaAccountId] = useState(null)
  const [connecting, setConnecting] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState(null)
  const [connectError, setConnectError] = useState(null)

  const clientId = profile?.client_id

  useEffect(() => {
    if (!clientId) return
    supabase
      .from('clients')
      .select('meta_ad_account_id')
      .eq('id', clientId)
      .maybeSingle()
      .then(({ data }) => {
        setMetaConnected(Boolean(data?.meta_ad_account_id))
        setMetaAccountId(data?.meta_ad_account_id ?? null)
      })
  }, [clientId])

  async function handleConnect() {
    if (!clientId) {
      setConnectError('Account not linked — please refresh the page and try again.')
      return
    }
    setConnecting(true)
    setConnectError(null)
    try {
      const res = await fetch(`/api/meta/connect?client_id=${clientId}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to start Facebook connection')
      window.location.href = data.url
    } catch (err) {
      setConnectError(err.message || 'Failed to connect. Please try again.')
      setConnecting(false)
    }
  }

  async function handleDisconnect() {
    if (!clientId) return
    setDisconnecting(true)
    try {
      const { error } = await supabase
        .from('clients')
        .update({ meta_ad_account_id: null, meta_access_token: null, meta_token_expires_at: null })
        .eq('id', clientId)
      if (error) throw error
      setMetaConnected(false)
      setMetaAccountId(null)
      setSyncMessage(null)
    } catch {
      // silent
    } finally {
      setDisconnecting(false)
    }
  }

  async function handleSync() {
    if (!clientId) return
    setSyncing(true)
    setSyncMessage(null)
    try {
      const res = await fetch('/api/meta/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSyncMessage(`Synced ${data.rows_synced} entries`)
    } catch (err) {
      setSyncMessage(err.message || 'Sync failed')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-h2 font-heading text-text-primary">Integrations</h1>
        <p className="text-sm text-text-secondary mt-0.5">Connect third-party accounts to pull live data into your dashboard.</p>
      </div>

      {/* Meta / Facebook Ads */}
      <div className="vc-card">
        <div className="flex items-start gap-4">
          {/* Facebook icon */}
          <div className="w-10 h-10 flex-shrink-0 bg-[#1877F2] flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="white" className="w-5 h-5">
              <path d="M24 12.073C24 5.40501 18.627 0 12 0S0 5.40501 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.413c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.234 2.686.234v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/>
            </svg>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm font-semibold text-text-primary">Facebook Ads Manager</h2>
              {metaConnected === true && (
                <span className="flex items-center gap-1 text-xs text-status-success font-medium">
                  <CheckCircle size={12} />
                  Connected
                </span>
              )}
              {metaConnected === false && (
                <span className="flex items-center gap-1 text-xs text-text-secondary">
                  <XCircle size={12} />
                  Not connected
                </span>
              )}
            </div>
            <p className="text-xs text-text-secondary mt-1 leading-relaxed">
              Link your Facebook Ads Manager account to display live campaign data — spend, leads, clicks, ROAS, and more — directly on your dashboard.
            </p>

            {metaConnected === true && metaAccountId && (
              <p className="text-xs text-text-secondary mt-2">
                Account ID: <span className="font-mono text-text-primary">{metaAccountId}</span>
              </p>
            )}

            {syncMessage && (
              <p className="text-xs mt-2 text-text-secondary">{syncMessage}</p>
            )}
            {connectError && (
              <p className="text-xs mt-2 text-status-danger">{connectError}</p>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 border-t border-white/[0.06] pt-4">
          {metaConnected === false && (
            <button
              onClick={handleConnect}
              disabled={connecting || isDemo}
              className="bg-vc-primary text-white text-xs font-medium px-4 py-2 hover:bg-vc-accent disabled:opacity-60 flex items-center gap-1.5"
            >
              <ExternalLink size={12} />
              {connecting ? 'Redirecting to Facebook…' : 'Connect Facebook Ads'}
            </button>
          )}

          {metaConnected === true && (
            <>
              <button
                onClick={handleSync}
                disabled={syncing}
                className="flex items-center gap-1.5 text-xs px-4 py-2 border border-white/[0.06] text-text-primary hover:border-white/[0.16] disabled:opacity-50"
              >
                <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
                {syncing ? 'Syncing…' : 'Sync now'}
              </button>
              <button
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="text-xs px-4 py-2 border border-white/[0.06] text-status-danger hover:border-status-danger/40 disabled:opacity-50"
              >
                {disconnecting ? 'Disconnecting…' : 'Disconnect'}
              </button>
            </>
          )}

          {isDemo && (
            <p className="text-xs text-text-secondary self-center">Integration unavailable in demo mode.</p>
          )}
        </div>
      </div>
    </div>
  )
}
