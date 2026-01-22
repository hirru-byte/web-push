'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CONFIG } from '@/config'
import { resetServiceWorker } from '@/utils/sw/service-worker'
import styles from '../page.module.css'
import { Notice } from './notice'

const notificationsSupported = () =>
  'Notification' in window &&
  'serviceWorker' in navigator &&
  'PushManager' in window

export default function Notifications() {
  const [permission, setPermission] = useState(
    window?.Notification?.permission || 'default'
  )

  if (!notificationsSupported()) {
    return (
      <Notice message="Please install this app on your home screen first!" />
    )
  }

  const requestPermission = async () => {
    if (!notificationsSupported()) {
      return
    }

    const receivedPermission = await window?.Notification.requestPermission()
    setPermission(receivedPermission)

    if (receivedPermission === 'granted') {
      subscribe()
    }
  }

  return (
    <>
      <Notice message={`Notifications permission status: ${permission}`} />
      <button onClick={requestPermission} className={styles.button}>
        Request permission and subscribe
      </button>
      {permission === 'granted' && (
        <button onClick={() => sendWebPush('Hello World')} className={styles.button}>
          Send notification
        </button>
      )}
      <Link href="/debug">Debug options</Link>
    </>
  )
}

const saveSubscription = async (subscription: PushSubscription) => {
  const ORIGIN = window.location.origin
  const BACKEND_URL = `${ORIGIN}/api/push`

  // Convert PushSubscription to the format expected by web-push
  const p256dhKey = subscription.getKey('p256dh')
  const authKey = subscription.getKey('auth')

  if (!p256dhKey || !authKey) {
    throw new Error('Failed to get subscription keys')
  }

  const subscriptionJson = {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: arrayBufferToBase64(p256dhKey),
      auth: arrayBufferToBase64(authKey),
    },
  }

  const response = await fetch(BACKEND_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(subscriptionJson),
  })

  const result = await response.json()

  if (!response.ok) {
    throw new Error(result.error || 'Failed to save subscription')
  }

  console.log('Subscription saved successfully:', result)
  alert(`Subscription saved! Total subscriptions: ${result.subscriptionCount}`)
  return result
}

// Helper function to convert ArrayBuffer to base64
const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

const subscribe = async () => {
  try {
    if (!CONFIG.PUBLIC_KEY) {
      alert('Error: VAPID public key is not configured. Please check your .env file.')
      console.error('VAPID PUBLIC_KEY is missing')
      return
    }

    const swRegistration = await resetServiceWorker()

    // Convert VAPID key from base64 URL to Uint8Array
    const applicationServerKey = urlBase64ToUint8Array(CONFIG.PUBLIC_KEY)

    const options: PushSubscriptionOptionsInit = {
      applicationServerKey: applicationServerKey as BufferSource,
      userVisibleOnly: true,
    }

    const subscription = await swRegistration.pushManager.subscribe(options)
    console.log('Push subscription created:', subscription)

    await saveSubscription(subscription)
  } catch (err) {
    console.error('Error subscribing:', err)
    alert(`Failed to subscribe: ${err instanceof Error ? err.message : String(err)}`)
  }
}

// Helper function to convert VAPID key from base64 URL to Uint8Array
const urlBase64ToUint8Array = (base64String: string): Uint8Array => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export async function sendWebPush(message: string | null): Promise<void> {
  try {
    const endPointUrl = '/api/push/send'
    const pushBody = {
      title: 'WebPush Notification',
      body: message ?? 'This is a test push message',
      icon: '/icons/icon-192.png',
      url: window.location.origin,
    }
    const res = await fetch(endPointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(pushBody),
    })

    if (!res.ok) {
      const error = await res.json()
      throw new Error(error.error || 'Failed to send notification')
    }

    const result = await res.json()
    console.log('Notification sent:', result)
    alert(
      `Notification sent! ${result.sent} successful, ${result.failed} failed`
    )
  } catch (error) {
    console.error('Error sending push notification:', error)
    alert(`Failed to send notification: ${error instanceof Error ? error.message : String(error)}`)
  }
}

