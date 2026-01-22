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
  const [isSubscribing, setIsSubscribing] = useState(false)
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null)

  if (!notificationsSupported()) {
    return (
      <Notice message="Please install this app on your home screen first!" />
    )
  }

  const subscribe = async () => {
    try {
      // Check HTTPS requirement (except localhost)
      const isLocalhost = window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname === '[::1]'
      const isSecure = window.location.protocol === 'https:' || isLocalhost

      if (!isSecure) {
        throw new Error('Push notifications require HTTPS. Please access the app via HTTPS or localhost.')
      }

      if (!CONFIG.PUBLIC_KEY) {
        alert('Error: VAPID public key is not configured. Please check your .env file.')
        console.error('VAPID PUBLIC_KEY is missing')
        return
      }

      console.log('Starting subscription process...')
      console.log('VAPID Public Key:', CONFIG.PUBLIC_KEY)
      console.log('Protocol:', window.location.protocol)
      console.log('Hostname:', window.location.hostname)

      // Check if service worker is supported
      if (!('serviceWorker' in navigator)) {
        throw new Error('Service workers are not supported in this browser')
      }

      // Check if PushManager is supported
      if (!('PushManager' in window)) {
        throw new Error('Push messaging is not supported in this browser')
      }

      // Register service worker
      console.log('Registering service worker...')
      const swRegistration = await resetServiceWorker()

      if (!swRegistration) {
        throw new Error('Failed to register service worker')
      }

      console.log('Service worker registered:', swRegistration)

      // Check if push manager is available
      if (!swRegistration.pushManager) {
        throw new Error('PushManager is not available in the service worker')
      }

      // Convert VAPID key from base64 URL to Uint8Array
      console.log('Converting VAPID key...')
      let applicationServerKey: Uint8Array

      try {
        applicationServerKey = urlBase64ToUint8Array(CONFIG.PUBLIC_KEY)
        console.log('VAPID key converted successfully, length:', applicationServerKey.length)
      } catch (keyError) {
        console.error('Error converting VAPID key:', keyError)
        throw new Error(`Failed to convert VAPID key: ${keyError instanceof Error ? keyError.message : String(keyError)}`)
      }

      // Check for existing subscription first
      let subscription = await swRegistration.pushManager.getSubscription()

      if (subscription) {
        console.log('Existing subscription found, unsubscribing first...')
        await subscription.unsubscribe()
      }

      const options: PushSubscriptionOptionsInit = {
        applicationServerKey: applicationServerKey as BufferSource,
        userVisibleOnly: true,
      }

      console.log('Subscribing to push notifications...')
      subscription = await swRegistration.pushManager.subscribe(options)

      if (!subscription) {
        throw new Error('Failed to create push subscription')
      }

      console.log('Push subscription created:', subscription)
      console.log('Subscription endpoint:', subscription.endpoint)

      setSubscriptionStatus('Saving subscription...')
      await saveSubscription(subscription)
      setSubscriptionStatus('Successfully subscribed!')
    } catch (err) {
      console.error('Error subscribing:', err)
      const errorMessage = err instanceof Error ? err.message : String(err)
      const detailedError = err instanceof DOMException ? `${errorMessage} (${err.name})` : errorMessage
      setSubscriptionStatus(`Error: ${detailedError}`)
      alert(`Failed to subscribe: ${detailedError}\n\nCheck the browser console for more details.`)
      throw err
    }
  }

  const requestPermission = async () => {
    if (!notificationsSupported()) {
      return
    }

    setIsSubscribing(true)
    setSubscriptionStatus('Requesting permission...')

    try {
      const receivedPermission = await window?.Notification.requestPermission()
      setPermission(receivedPermission)

      if (receivedPermission === 'granted') {
        setSubscriptionStatus('Permission granted, subscribing...')
        await subscribe()
      } else if (receivedPermission === 'denied') {
        setSubscriptionStatus('Permission denied. Please enable notifications in your browser settings.')
        alert('Notification permission was denied. Please enable it in your browser settings to receive push notifications.')
      } else {
        setSubscriptionStatus('Permission not granted')
      }
    } catch (error) {
      console.error('Error requesting permission:', error)
      setSubscriptionStatus(`Error: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setIsSubscribing(false)
    }
  }

  return (
    <>
      <Notice message={`Notifications permission status: ${permission}`} />
      {subscriptionStatus && (
        <Notice message={subscriptionStatus} />
      )}
      <button
        onClick={requestPermission}
        className={styles.button}
        disabled={isSubscribing}
      >
        {isSubscribing ? 'Subscribing...' : 'Request permission and subscribe'}
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


// Helper function to convert VAPID key from base64 URL to Uint8Array
const urlBase64ToUint8Array = (base64String: string): Uint8Array => {
  if (!base64String) {
    throw new Error('VAPID key is empty')
  }

  // Remove any whitespace
  const cleanKey = base64String.trim()

  // Add padding if needed
  const padding = '='.repeat((4 - (cleanKey.length % 4)) % 4)

  // Convert URL-safe base64 to standard base64
  const base64 = (cleanKey + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/')

  try {
    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i)
    }
    return outputArray
  } catch (error) {
    throw new Error(`Failed to decode VAPID key: ${error instanceof Error ? error.message : String(error)}`)
  }
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

