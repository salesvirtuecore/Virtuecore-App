import { useEffect, useState } from 'react'
import { X, Smartphone, Share, PlusSquare } from 'lucide-react'

export default function InstallBanner() {
  const [prompt, setPrompt] = useState(null)
  const [show, setShow] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    // Don't show if already installed or dismissed this session
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone
    if (isStandalone) return
    if (sessionStorage.getItem('install-banner-dismissed')) return

    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream
    setIsIOS(ios)

    // Android / Chrome: capture the beforeinstallprompt event
    const handler = (e) => {
      e.preventDefault()
      setPrompt(e)
      setShow(true)
    }
    window.addEventListener('beforeinstallprompt', handler)

    // iOS: show manual instructions after a short delay
    if (ios) {
      const t = setTimeout(() => setShow(true), 2000)
      return () => { clearTimeout(t); window.removeEventListener('beforeinstallprompt', handler) }
    }

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  function dismiss() {
    sessionStorage.setItem('install-banner-dismissed', '1')
    setShow(false)
    setDismissed(true)
  }

  async function install() {
    if (!prompt) return
    prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted') setShow(false)
  }

  if (!show || dismissed) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-6 md:max-w-sm animate-[slideUp_0.3s_ease-out]">
      <div className="bg-bg-elevated border border-white/[0.12] rounded-card shadow-elevated p-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-vc-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
            <Smartphone size={18} className="text-vc-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-text-primary font-heading">Add VirtueCore to your phone</p>
            {isIOS ? (
              <p className="text-xs text-text-secondary mt-1 leading-5">
                Tap <Share size={11} className="inline mx-0.5 mb-0.5" /> <strong>Share</strong> then{' '}
                <PlusSquare size={11} className="inline mx-0.5 mb-0.5" /> <strong>"Add to Home Screen"</strong> for instant access.
              </p>
            ) : (
              <p className="text-xs text-text-secondary mt-1">
                Install the app for a faster, full-screen experience — no App Store needed.
              </p>
            )}
          </div>
          <button onClick={dismiss} className="text-text-tertiary hover:text-text-primary transition-colors flex-shrink-0 -mt-0.5">
            <X size={16} />
          </button>
        </div>

        {!isIOS && (
          <div className="flex gap-2 mt-3">
            <button
              onClick={dismiss}
              className="flex-1 text-xs text-text-secondary border border-white/[0.08] rounded-btn py-2 hover:bg-bg-tertiary transition-colors"
            >
              Not now
            </button>
            <button
              onClick={install}
              className="flex-1 text-xs bg-vc-primary hover:bg-vc-accent text-white rounded-btn py-2 font-medium transition-colors"
            >
              Install app
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
