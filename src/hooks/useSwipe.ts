import { useRef, useCallback } from 'react'

interface SwipeOptions {
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  threshold?: number
}

export function useSwipe({ onSwipeLeft, onSwipeRight, threshold = 80 }: SwipeOptions) {
  const startX = useRef(0)
  const startY = useRef(0)
  const swiping = useRef(false)

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX
    startY.current = e.touches[0].clientY
    swiping.current = true
  }, [])

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!swiping.current) return
    const dx = e.changedTouches[0].clientX - startX.current
    const dy = e.changedTouches[0].clientY - startY.current
    swiping.current = false

    // 水平滑动距离大于垂直滑动距离，且超过阈值
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > threshold) {
      if (dx < 0) onSwipeLeft?.()
      else onSwipeRight?.()
    }
  }, [onSwipeLeft, onSwipeRight, threshold])

  return { onTouchStart, onTouchEnd }
}
