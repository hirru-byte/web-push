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

  const response = await fetch(BACKEND_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(subscription),
  })
  return response.json()
}

const subscribe = async () => {
  const swRegistration = await resetServiceWorker()

  try {
    const options = {
      applicationServerKey: CONFIG.PUBLIC_KEY,
      userVisibleOnly: true,
    }
    const subscription = await swRegistration.pushManager.subscribe(options)

    await saveSubscription(subscription)

    console.log({ subscription })
  } catch (err) {
    console.error('Error', err)
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

