import { NextResponse, NextRequest } from 'next/server'
import { getSubscriptionsFromDb } from '@/utils/db/in-memory-db'
import webpush from 'web-push'
import { CONFIG } from '@/config'

webpush.setVapidDetails(
  'mailto:test@example.com',
  CONFIG.PUBLIC_KEY as string,
  CONFIG.PRIVATE_KEY as string
)

interface PushPayload {
  title: string
  body: string
  image?: string
  icon?: string
  url?: string
}

export async function POST(request: NextRequest) {
  try {
    const payload: PushPayload = await request.json()

    if (!payload.title || !payload.body) {
      return NextResponse.json(
        { error: 'Title and body are required' },
        { status: 400 }
      )
    }

    const subscriptions = await getSubscriptionsFromDb()

    if (subscriptions.length === 0) {
      return NextResponse.json({
        message: 'No subscriptions found',
        sent: 0,
      })
    }

    const notificationPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      image: payload.image,
      icon: payload.icon || '/icons/icon-192.png',
      url: payload.url || '/',
    })

    const results = await Promise.allSettled(
      subscriptions.map((subscription) =>
        webpush.sendNotification(subscription, notificationPayload)
      )
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

