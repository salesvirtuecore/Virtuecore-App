// Strip anything that isn't safe in a storage path segment.
export function sanitizeFilename(name) {
  return (name || 'file').replace(/[^a-zA-Z0-9._-]/g, '_')
}

// Uploads a file to the private client-documents bucket, namespaced by
// client id and category (e.g. 'contracts', 'credentials'). Returns the
// storage path (not a public URL — the bucket is private, read via signed URLs).
export async function uploadClientDocument(supabase, clientId, category, file) {
  const path = `${clientId}/${category}/${Date.now()}-${sanitizeFilename(file.name)}`
  const { error } = await supabase.storage.from('client-documents').upload(path, file, { cacheControl: '3600', upsert: false })
  if (error) throw error
  return path
}

// Bucket is private, so viewing a document needs a short-lived signed URL
// rather than a public getPublicUrl() link.
export async function getSignedDocumentUrl(supabase, path, expiresInSeconds = 300) {
  const { data, error } = await supabase.storage.from('client-documents').createSignedUrl(path, expiresInSeconds)
  if (error) throw error
  return data.signedUrl
}

/**
 * Merge client rows with profile rows to determine portal join status.
 * Used by Dashboard and Clients pages.
 */
export function withPortalStatus(clientRows, profileRows = []) {
  const joinedByClientId = new Map()
  for (const profile of profileRows) {
    if (!profile?.client_id) continue
    const existing = joinedByClientId.get(profile.client_id)
    if (!existing || new Date(profile.created_at) < new Date(existing.created_at)) {
      joinedByClientId.set(profile.client_id, profile)
    }
  }
  return clientRows.map((client) => {
    const linkedProfile = joinedByClientId.get(client.id)
    return {
      ...client,
      portal_joined: Boolean(linkedProfile),
      portal_joined_at: linkedProfile?.created_at || null,
    }
  })
}
