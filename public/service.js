self.addEventListener('push', async (event) => {
  if (event.data) {
    const eventData = await event.data.json()
    showLocalNotification(
      eventData.title,
      eventData.body,
      eventData.icon,
      eventData.image,
      eventData.url,
      self.registration
    )
  } else {
    // Fallback for notifications without data
    showLocalNotification(
      'WebPush Notification!',
      'You have a new notification',
      '/icons/icon-192.png',
      null,
      '/',
      self.registration
    )
  }
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const urlToOpen = event.notification.data?.url || '/'

  event.waitUntil(
    clients
      .matchAll({
        type: 'window',
        includeUncontrolled: true,
      })
      .then((clientList) => {
        // Check if there's already a window/tab open with the target URL
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i]
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus()
          }
        }
        // If not, open a new window/tab
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen)
        }
      })
  )
})

const showLocalNotification = (
  title,
  body,
  icon,
  image,
  url,
  swRegistration
) => {
  const options = {
    body,
    icon: icon || '/icons/icon-192.png',
    badge: '/icons/icon-96.png',
    data: {
      url: url || '/',
    },
    requireInteraction: false,
    vibrate: [200, 100, 200],
    tag: 'webpush-notification',
    renotify: true,
  }

  // Add image if provided (supported on some platforms)
  if (image) {
    options.image = image
  }

  swRegistration.showNotification(title, options)
}
