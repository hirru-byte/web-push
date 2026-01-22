export const registerServiceWorker = async () => {
  if (!('serviceWorker' in navigator)) {
    throw new Error('Service workers are not supported in this browser')
  }

  try {
    const registration = await navigator.serviceWorker.register('/service.js', {
      scope: '/',
    })
    
    // Wait for the service worker to be ready
    if (registration.installing) {
      await new Promise((resolve) => {
        registration.installing!.addEventListener('statechange', function() {
          if (this.state === 'installed') {
            resolve(undefined)
          }
        })
      })
    } else if (registration.waiting) {
      // Service worker is waiting, skip waiting
      registration.waiting.postMessage({ type: 'SKIP_WAITING' })
    }

    // Wait a bit for the service worker to activate
    await navigator.serviceWorker.ready
    
    return registration
  } catch (error) {
    console.error('Service worker registration failed:', error)
    throw new Error(`Failed to register service worker: ${error instanceof Error ? error.message : String(error)}`)
  }
}

export const unregisterServiceWorkers = async () => {
  if (!('serviceWorker' in navigator)) {
    return
  }

  try {
    const registrations = await navigator.serviceWorker.getRegistrations()
    await Promise.all(registrations.map((r) => r.unregister()))
  } catch (error) {
    console.error('Failed to unregister service workers:', error)
    // Don't throw, just log the error
  }
}

export const resetServiceWorker = async () => {
  try {
    await unregisterServiceWorkers()
    // Wait a bit before re-registering
    await new Promise(resolve => setTimeout(resolve, 100))
    return await registerServiceWorker()
  } catch (error) {
    console.error('Failed to reset service worker:', error)
    throw error
  }
}
