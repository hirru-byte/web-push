import { NextResponse, NextRequest } from 'next/server'
import {
  getSubscriptionsFromDb,
  saveSubscriptionToDb,
} from '@/utils/db/in-memory-db'
import webpush, { PushSubscription } from 'web-push'
import { CONFIG } from '@/config'

webpush.setVapidDetails(
  'mailto:test@example.com',
  CONFIG.PUBLIC_KEY as string,
  CONFIG.PRIVATE_KEY as string
)

export async function POST(request: NextRequest) {
  try {
    const subscription = (await request.json()) as PushSubscription | null

    if (!subscription) {
      return NextResponse.json(
        { error: 'No subscription was provided!' },
        { status: 400 }
      )
    }

    const updatedDb = await saveSubscriptionToDb(subscription)

    return NextResponse.json({
      message: 'Subscription saved successfully',
      subscriptionCount: updatedDb.subscriptions.length,
    })
  } catch (error) {
    console.error('Error saving subscription:', error)
    return NextResponse.json(
      { error: 'Failed to save subscription', details: String(error) },
      { status: 500 }
    )
  }
}

export async function GET(_: NextRequest) {
  try {
    const subscriptions = await getSubscriptionsFromDb()

    if (subscriptions.length === 0) {
      return NextResponse.json({
        message: 'No subscriptions found',
        sent: 0,
      })
    }

    const payload = JSON.stringify({
      title: 'WebPush Notification!',
      body: 'Hello World',
      icon: '/icons/icon-192.png',
      url: '/',
    })

    const results = await Promise.allSettled(
      subscriptions.map((s) => webpush.sendNotification(s, payload))
    )

    const successful = results.filter((r) => r.status === 'fulfilled').length
    const failed = results.filter((r) => r.status === 'rejected').length

    // Log failed notifications for debugging
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.error(
          `Failed to send notification to subscription ${index}:`,
          result.reason
        )
      }
    })

    return NextResponse.json({
      message: `Notifications sent: ${successful} successful, ${failed} failed`,
      sent: successful,
      failed,
      total: subscriptions.length,
    })
  } catch (error) {
    console.error('Error sending push notifications:', error)
    return NextResponse.json(
      { error: 'Failed to send notifications', details: String(error) },
      { status: 500 }
    )
  }
}