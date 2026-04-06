import { apiFetch } from './api'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export async function subscribeToPush(userId) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null
  if (!VAPID_PUBLIC_KEY) return null

  try {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return null

    const reg = await navigator.serviceWorker.ready
    const existing = await reg.pushManager.getSubscription()

    const sub = existing ?? await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    })

    await apiFetch('/api/push/subscribe', {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, subscription: sub.toJSON() }),
    })

    return sub
  } catch {
    return null
  }
}

export async function sendPushNotification(userId, { title, body, url }) {
  try {
    await apiFetch('/api/push/notify', {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, title, body, url }),
    })
  } catch {
    // non-critical — don't throw
  }
}
