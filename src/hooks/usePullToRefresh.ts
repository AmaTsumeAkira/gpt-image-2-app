import { useRef, useState, useCallback } from 'react'

export function usePullToRefresh(onRefresh: () => Promise<void> | void, threshold = 80) {
  const [pulling, setPulling] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)
  const startY = useRef(0)

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    // 只在页面顶部时触发
    if (window.scrollY > 0) return
    startY.current = e.touches[0].clientY
    setPulling(true)
  }, [])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!pulling || refreshing) return
    const dy = e.touches[0].clientY - startY.current
    if (dy > 0 && window.scrollY === 0) {
      setPullDistance(Math.min(dy * 0.5, 120))
    }
  }, [pulling, refreshing])

  const onTouchEnd = useCallback(async () => {
    if (!pulling) return
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
