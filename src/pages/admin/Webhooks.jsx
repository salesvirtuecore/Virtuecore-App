import { useState } from 'react'
import { Copy, Check, CreditCard, AlertCircle } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'


const BASE_URL = 'https://your-app.vercel.app'

const STRIPE_EVENTS = [
  'invoice.paid',
  'invoice.payment_failed',
  'invoice.created',
]

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback
    }
  }

  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary border border-white/[0.06] px-2.5 py-1.5 transition-colors hover:bg-bg-tertiary flex-shrink-0"
    >
      {copied ? <Check size={12} className="text-status-success" /> : <Copy size={12} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  )
}

function StatusBadge() {
  if (isDemo) {
    return (
      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-status-warning/10 border border-status-warning/20 text-status-warning">
        <span className="w-1.5 h-1.5 rounded-full bg-status-warning/100" />
        Demo Mode
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-status-success/10 border border-status-success/20 text-status-success">
      <span className="w-1.5 h-1.5 rounded-full bg-status-success/100" />
      Active
    </span>
  )
}

export default function Webhooks() {
  const { isDemo } = useAuth()
  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-h2 font-heading text-text-primary">Integrations & Webhooks</h1>
        <p className="text-sm text-text-secondary mt-0.5">
          Configure external integrations and webhook endpoints across the platform.
        </p>
      </div>

      {/* Stripe section */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <CreditCard size={16} className="text-vc-accent" />
          <h2 className="text-base font-semibold text-text-primary">Stripe Webhook</h2>
          <StatusBadge />
        </div>

        <div className="border border-white/[0.06]">
          <div className="px-5 py-4 border-b border-white/[0.06] bg-bg-tertiary">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono bg-vc-primary text-white px-1.5 py-0.5">POST</span>
              <span className="text-sm font-medium text-text-primary">Stripe Webhook Handler</span>
            </div>
            <p className="text-xs text-text-secondary">
              Add this URL in your Stripe Dashboard under Webhooks. Stripe verifies the signature automatically.
            </p>
          </div>

          <div className="px-5 py-4 space-y-4">
            {/* URL */}
            <div>
              <p className="text-xs text-text-secondary mb-1.5 font-medium uppercase tracking-wide">Webhook URL</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-bg-tertiary border border-white/[0.06] px-3 py-2 text-text-primary font-mono truncate">
                  {BASE_URL}/api/webhooks/stripe
                </code>
                <CopyButton text={`${BASE_URL}/api/webhooks/stripe`} />
              </div>
            </div>

            {/* Events */}
            <div>
              <p className="text-xs text-text-secondary mb-2 font-medium uppercase tracking-wide">Events to Listen For</p>
              <div className="space-y-1">
                {STRIPE_EVENTS.map((ev) => (
                  <div key={ev} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-vc-primary flex-shrink-0" />
                    <code className="text-xs font-mono text-text-primary">{ev}</code>
                  </div>
                ))}
              </div>
            </div>

            {/* Note */}
            <div className="flex items-start gap-2 p-3 bg-status-warning/10 border border-status-warning/20">
              <AlertCircle size={14} className="text-status-warning mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-800">
                Set <code className="bg-status-warning/10 px-1">STRIPE_WEBHOOK_SECRET</code> in your Vercel environment variables.
                This is the signing secret shown in the Stripe dashboard after creating the webhook endpoint.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Meta Ads section */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-4 h-4 bg-blue-600 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-[9px] font-bold">f</span>
          </div>
          <h2 className="text-base font-semibold text-text-primary">Meta Ads Data Sync</h2>
          <StatusBadge />
        </div>

        <div className="border border-white/[0.06]">
          <div className="px-5 py-4 border-b border-white/[0.06] bg-bg-tertiary">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono bg-vc-primary text-white px-1.5 py-0.5">GET</span>
              <span className="text-sm font-medium text-text-primary">Fetch & sync ad performance</span>
            </div>
            <p className="text-xs text-text-secondary">
              Call this endpoint (e.g. via a Vercel cron or Zapier schedule) to pull Meta Ads insights and upsert into Supabase.
            </p>
          </div>
          <div className="px-5 py-4 space-y-3">
            <div>
              <p className="text-xs text-text-secondary mb-1.5 font-medium uppercase tracking-wide">Endpoint URL</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-bg-tertiary border border-white/[0.06] px-3 py-2 text-text-primary font-mono truncate">
                  {BASE_URL}/api/admin/meta-ads?client_id=CLIENT_UUID&account_id=ACT_XXXXXXX&date_preset=last_30d
                </code>
                <CopyButton text={`${BASE_URL}/api/admin/meta-ads?client_id=CLIENT_UUID&account_id=ACT_XXXXXXX&date_preset=last_30d`} />
              </div>
            </div>
            <div>
              <p className="text-xs text-text-secondary mb-2 font-medium uppercase tracking-wide">Query Params</p>
              <table className="w-full text-xs border border-white/[0.06]">
                <thead>
                  <tr className="bg-bg-tertiary border-b border-white/[0.06]">
                    <th className="text-left px-3 py-2 text-text-secondary font-medium">Param</th>
                    <th className="text-left px-3 py-2 text-text-secondary font-medium">Required</th>
                    <th className="text-left px-3 py-2 text-text-secondary font-medium">Description</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-white/[0.06]">
                    <td className="px-3 py-2 font-mono text-text-primary">client_id</td>
                    <td className="px-3 py-2 text-text-secondary">Optional</td>
                    <td className="px-3 py-2 text-text-secondary">Supabase client UUID to associate data with</td>
                  </tr>
                  <tr className="border-b border-white/[0.06]">
                    <td className="px-3 py-2 font-mono text-text-primary">account_id</td>
                    <td className="px-3 py-2 text-text-secondary">Required</td>
                    <td className="px-3 py-2 text-text-secondary">Meta Ads account ID (e.g. act_123456789)</td>
                  </tr>
                  <tr>
                    <td className="px-3 py-2 font-mono text-text-primary">date_preset</td>
                    <td className="px-3 py-2 text-text-secondary">Optional</td>
                    <td className="px-3 py-2 text-text-secondary">last_7d, last_30d, last_month, this_month (default: last_30d)</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
