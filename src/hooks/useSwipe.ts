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
  const locked = useRef(false) // true once direction is determined
  const [swipeOffset, setSwipeOffset] = useState(0)

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX
    startY.current = e.touches[0].clientY
    swiping.current = true
    locked.current = false
    setSwipeOffset(0)
  }, [])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!swiping.current) return
    const dx = e.touches[0].clientX - startX.current
    const dy = e.touches[0].clientY - startY.current

    if (!locked.current) {
      // 需要超过 10px 移动才锁定方向
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return
      if (Math.abs(dy) > Math.abs(dx)) {
        // 垂直滚动为主 → 取消滑动
        swiping.current = false
        setSwipeOffset(0)
        return
      }
      locked.current = true
    }

    if (locked.current) {
      setSwipeOffset(dx)
    }
  }, [])

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!swiping.current) return
    const dx = e.changedTouches[0].clientX - startX.current
    const dy = e.changedTouches[0].clientY - startY.current
    swiping.current = false
    locked.current = false
    setSwipeOffset(0)

    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > threshold) {
      if (dx < 0) onSwipeLeft?.()
      else onSwipeRight?.()
    }
  }, [onSwipeLeft, onSwipeRight, threshold])

  return { onTouchStart, onTouchMove, onTouchEnd, swipeOffset }
}
