import { useEffect, useRef } from 'react'

export function useWakeLock() {
  const sentinelRef = useRef<WakeLockSentinel | null>(null)

  useEffect(() => {
    if (!('wakeLock' in navigator)) return

    const request = async () => {
      try {
        sentinelRef.current = await navigator.wakeLock.request('screen')
      } catch {
        // Permission denied or feature not available in this context
      }
    }

    request()

    // Re-acquire on tab visibility restore (released automatically on hide)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') request()
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      sentinelRef.current?.release()
    }
  }, [])
}