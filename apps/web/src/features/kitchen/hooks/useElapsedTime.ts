import { useState, useEffect } from 'react'

export function useElapsedTime(startTime: Date): number {
  const [elapsed, setElapsed] = useState(() => Date.now() - startTime.getTime())

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Date.now() - startTime.getTime())
    }, 1000)
    return () => clearInterval(interval)
  }, [startTime])

  return elapsed
}

export function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}