// Returns the Facebook OAuth URL for the client to connect their Ads Manager.
// Required env vars: META_APP_ID, VITE_APP_URL
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const { META_APP_ID, VITE_APP_URL } = process.env
  if (!META_APP_ID || !VITE_APP_URL) {
    return res.status(500).json({ error: 'Meta app not configured' })
  }

  const { client_id } = req.query
  if (!client_id) return res.status(400).json({ error: 'Missing client_id' })

  const redirectUri = `${VITE_APP_URL}/meta/callback`
  const scope = 'ads_read,read_insights'

  const url = new URL('https://www.facebook.com/v19.0/dialog/oauth')
  url.searchParams.set('client_id', META_APP_ID)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('scope', scope)
  url.searchParams.set('state', client_id)
  url.searchParams.set('response_type', 'code')

  res.status(200).json({ url: url.toString() })
}
