import { useRef, useCallback, useState } from 'react'

interface SwipeOptions {
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  threshold?: number
}

export function useSwipe({ onSwipeLeft, onSwipeRight, threshold = 80 }: SwipeOptions) {
  const startX = useRef(0)
  const startY = useRef(0)
  const swiping = useRef(false)
  const [swipeOffset, setSwipeOffset] = useState(0)

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX
    startY.current = e.touches[0].clientY
    swiping.current = true
    setSwipeOffset(0)
  }, [])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!swiping.current) return
    const dx = e.touches[0].clientX - startX.current
    const dy = e.touches[0].clientY - startY.current
    // 只在水平滑动主导时更新偏移
    if (Math.abs(dx) > Math.abs(dy)) {
      setSwipeOffset(dx)
    }
  }, [])

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!swiping.current) return
    const dx = e.changedTouches[0].clientX - startX.current
    const dy = e.changedTouches[0].clientY - startY.current
    swiping.current = false
    setSwipeOffset(0)

    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > threshold) {
      if (dx < 0) onSwipeLeft?.()
      else onSwipeRight?.()
    }
  }, [onSwipeLeft, onSwipeRight, threshold])

  return { onTouchStart, onTouchMove, onTouchEnd, swipeOffset }
}
