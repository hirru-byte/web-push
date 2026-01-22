'use client'

import { useState } from 'react'
import Link from 'next/link'
import styles from '../page.module.css'
import {
  resetServiceWorker,
  unregisterServiceWorkers,
} from '@/utils/sw/service-worker'

export default function DebugActions() {
  const [subscriptionCount, setSubscriptionCount] = useState<number | null>(null)

  const checkSubscriptions = async () => {
    try {
      const response = await fetch('/api/db')
      const data = await response.json()
      setSubscriptionCount(data.subscriptions?.length || 0)
      console.log('Current subscriptions:', data)
      alert(`Total subscriptions: ${data.subscriptions?.length || 0}`)
    } catch (error) {
      console.error('Error checking subscriptions:', error)
      alert('Failed to check subscriptions')
    }
  }

  return (
    <>
      <h3 className={styles.heading}>Debug actions</h3>
      <button onClick={resetServiceWorker} className={styles.button}>
        Reset SW
      </button>
      <button onClick={unregisterServiceWorkers} className={styles.button}>
        Remove SW
      </button>
      <button onClick={checkSubscriptions} className={styles.button}>
        Check Subscriptions
      </button>
      {subscriptionCount !== null && (
        <p>Subscriptions found: {subscriptionCount}</p>
      )}
      <Link href="/">Back to home</Link>
    </>
  )
}
