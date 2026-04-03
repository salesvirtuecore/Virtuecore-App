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
