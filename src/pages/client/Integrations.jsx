import { useEffect, useState } from 'react'
import { CheckCircle, XCircle } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'

function formatDate(iso) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function Integrations() {
  const { profile } = useAuth()
  const [metaConnected, setMetaConnected] = useState(null)
  const [metaAccountId, setMetaAccountId] = useState(null)
  const [lastSyncedAt, setLastSyncedAt] = useState(null)

  const clientId = profile?.client_id

  useEffect(() => {
    if (!clientId || !supabase) return
    supabase
      .from('clients')
      .select('meta_ad_account_id')
      .eq('id', clientId)
      .maybeSingle()
      .then(({ data }) => {
        setMetaConnected(Boolean(data?.meta_ad_account_id))
        setMetaAccountId(data?.meta_ad_account_id ?? null)
      })
    supabase
      .from('ad_performance')
      .select('date')
      .eq('client_id', clientId)
      .eq('platform', 'meta')
      .order('date', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setLastSyncedAt(data?.date ?? null))
  }, [clientId])

  return (
    <div className="p-4 md:p-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-h2 font-heading text-text-primary">Ad Account</h1>
        <p className="text-sm text-text-secondary mt-0.5">Your Meta Ads account, matched and synced by our team — no setup needed on your end.</p>
      </div>

      <div className="vc-card">
        <div className="flex items-start gap-4">
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
                  Matched
                </span>
              )}
              {metaConnected === false && (
                <span className="flex items-center gap-1 text-xs text-text-secondary">
                  <XCircle size={12} />
                  Not matched yet
                </span>
              )}
            </div>
            <p className="text-xs text-text-secondary mt-1 leading-relaxed">
              {metaConnected
                ? 'Your account is matched — we sync your campaign data (spend, leads, CPL, ROAS) automatically. See it on your Ads Performance page.'
                : "We haven't matched your ad account yet — this happens automatically once your Meta Business Manager account is set up during onboarding."}
            </p>
            {metaConnected === true && metaAccountId && (
              <p className="text-xs text-text-secondary mt-2">
                Account ID: <span className="font-mono text-text-primary">{metaAccountId}</span>
              </p>
            )}
            {lastSyncedAt && (
              <p className="text-xs text-text-secondary mt-1">Last synced: {formatDate(lastSyncedAt)}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
