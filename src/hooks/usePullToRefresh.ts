import { useRef, useState, useCallback } from 'react'

export function usePullToRefresh(onRefresh: () => Promise<void> | void, threshold = 80) {
  const [pulling, setPulling] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)
  const startY = useRef(0)
  const startX = useRef(0)
  const cancelled = useRef(false)

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (window.scrollY > 0) return
    startY.current = e.touches[0].clientY
    startX.current = e.touches[0].clientX
    setPulling(true)
    cancelled.current = false
  }, [])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!pulling || refreshing || cancelled.current) return
    const dy = e.touches[0].clientY - startY.current
    const dx = e.touches[0].clientX - startX.current
    // 水平滑动为主时取消下拉
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 10) {
      cancelled.current = true
      setPulling(false)
      setPullDistance(0)
      return
    }
    if (dy > 0 && window.scrollY === 0) {
      setPullDistance(Math.min(dy * 0.5, 120))
    }
  }, [pulling, refreshing])

  const onTouchEnd = useCallback(async () => {
    if (!pulling || cancelled.current) return
    setPulling(false)
    if (pullDistance > threshold && !refreshing) {
      setRefreshing(true)
      setPullDistance(40)
      try {
        await onRefresh()
      } finally {
        setRefreshing(false)
        setPullDistance(0)
      }
    } else {
      setPullDistance(0)
    }
  }, [pulling, pullDistance, threshold, refreshing, onRefresh])

  return { pullDistance, refreshing, onTouchStart, onTouchMove, onTouchEnd }
}
