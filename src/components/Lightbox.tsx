import { useEffect, useState, useRef, useCallback } from 'react'
import { useStore } from '../store'
import { useCloseOnEscape } from '../hooks/useCloseOnEscape'
import { isNative } from '../lib/platform'
import { downloadImage } from '../lib/native'

const MIN_ZOOM = 0.5
const MAX_ZOOM = 10
const ZOOM_STEP = 0.25

export default function Lightbox() {
  const lightboxImageUrl = useStore((s) => s.lightboxImageUrl)
  const lightboxImageList = useStore((s) => s.lightboxImageList)
  const setLightboxImageUrl = useStore((s) => s.setLightboxImageUrl)

  const [loaded, setLoaded] = useState(false)
  const [scale, setScale] = useState(1)
  const showToast = useStore((s) => s.showToast)
  const panRef = useRef({ x: 0, y: 0 })
  const [renderPan, setRenderPan] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const panStartRef = useRef({ x: 0, y: 0 })
  const containerRef = useRef<HTMLDivElement>(null)
  const lastWheelTimeRef = useRef(0)

  // 触摸手势 refs
  const touchStartRef = useRef<{ x: number; y: number; time: number; dist: number }[]>([])
  const pinchStartDistRef = useRef(0)
  const pinchStartScaleRef = useRef(1)
  const swipeStartXRef = useRef(0)
  const swipeDeltaRef = useRef(0)
  const [swipeDelta, setSwipeDelta] = useState(0)
  const lastTapTimeRef = useRef(0)
  const isTouchPanningRef = useRef(false)
  const touchPanStartRef = useRef({ x: 0, y: 0 })

  useCloseOnEscape(Boolean(lightboxImageUrl), () => {
    setLightboxImageUrl(null)
    setScale(1)
    panRef.current = { x: 0, y: 0 }
    setRenderPan({ x: 0, y: 0 })
  })

  useEffect(() => {
    setLoaded(false)
    setScale(1)
    panRef.current = { x: 0, y: 0 }
    setRenderPan({ x: 0, y: 0 })
  }, [lightboxImageUrl])

  // 使用 window 级 wheel 监听确保 passive: false 生效
  useEffect(() => {
    if (!lightboxImageUrl) return
    const handler = (e: WheelEvent) => {
      e.preventDefault()
      const now = Date.now()
      if (now - lastWheelTimeRef.current < 30) return
      lastWheelTimeRef.current = now

      setScale((prev) => {
        const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP
        return Math.round(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev + delta)) * 100) / 100
      })
    }
    window.addEventListener('wheel', handler, { passive: false })
    return () => window.removeEventListener('wheel', handler)
  }, [lightboxImageUrl])

  // 键盘导航
  useEffect(() => {
    if (!lightboxImageUrl) return
    const handler = (e: KeyboardEvent) => {
      const zoomed = scale > 1.05
      if (e.key === 'ArrowLeft' && lightboxImageList.length > 1 && !zoomed) {
        e.preventDefault()
        const idx = lightboxImageList.indexOf(lightboxImageUrl)
        const prev = (idx - 1 + lightboxImageList.length) % lightboxImageList.length
        setLightboxImageUrl(lightboxImageList[prev], lightboxImageList)
      } else if (e.key === 'ArrowRight' && lightboxImageList.length > 1 && !zoomed) {
        e.preventDefault()
        const idx = lightboxImageList.indexOf(lightboxImageUrl)
        const next = (idx + 1) % lightboxImageList.length
        setLightboxImageUrl(lightboxImageList[next], lightboxImageList)
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault()
        setScale((prev) => Math.round(Math.min(MAX_ZOOM, prev + ZOOM_STEP) * 100) / 100)
      } else if (e.key === '-') {
        e.preventDefault()
        setScale((prev) => Math.round(Math.max(MIN_ZOOM, prev - ZOOM_STEP) * 100) / 100)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [lightboxImageUrl, lightboxImageList, scale])

  // 鼠标拖拽平移（任意缩放比下均可拖拽）
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // 只有左键
    if (e.button !== 0) return
    e.preventDefault()
    setIsPanning(true)
    panStartRef.current = {
      x: e.clientX - panRef.current.x,
      y: e.clientY - panRef.current.y,
    }
  }, [])

  // 全局 mouse move / up
  useEffect(() => {
    if (!isPanning) return

    const onMove = (e: MouseEvent) => {
      const next = {
        x: e.clientX - panStartRef.current.x,
        y: e.clientY - panStartRef.current.y,
      }
      panRef.current = next
      setRenderPan(next)
    }
    const onUp = () => setIsPanning(false)

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [isPanning])

  // 触摸手势：滑动切换、双指缩放、双击缩放、缩放后拖动
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touches = Array.from(e.touches).map((t) => ({ x: t.clientX, y: t.clientY, time: Date.now(), dist: 0 }))
    touchStartRef.current = touches

    if (touches.length === 1) {
      swipeStartXRef.current = touches[0].x
      swipeDeltaRef.current = 0
      // 缩放状态下的单指拖动
      if (scale > 1.05) {
        isTouchPanningRef.current = true
        touchPanStartRef.current = {
          x: touches[0].x - panRef.current.x,
          y: touches[0].y - panRef.current.y,
        }
      }
    }

    if (touches.length === 2) {
      const dx = touches[1].x - touches[0].x
      const dy = touches[1].y - touches[0].y
      pinchStartDistRef.current = Math.hypot(dx, dy)
      pinchStartScaleRef.current = scale
      isTouchPanningRef.current = false
    }
  }, [scale])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const touches = Array.from(e.touches)
    if (touches.length === 2) {
      // 双指缩放
      e.preventDefault()
      const dx = touches[1].clientX - touches[0].clientX
      const dy = touches[1].clientY - touches[0].clientY
      const dist = Math.hypot(dx, dy)
      if (pinchStartDistRef.current > 0) {
        const ratio = dist / pinchStartDistRef.current
        const newScale = Math.round(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, pinchStartScaleRef.current * ratio)) * 100) / 100
        setScale(newScale)
      }
    } else if (touches.length === 1) {
      if (isTouchPanningRef.current && scale > 1.05) {
        // 缩放状态下的单指拖动
        e.preventDefault()
        const next = {
          x: touches[0].clientX - touchPanStartRef.current.x,
          y: touches[0].clientY - touchPanStartRef.current.y,
        }
        panRef.current = next
        setRenderPan(next)
      } else if (lightboxImageList.length > 1 && scale <= 1.05) {
        // 滑动切换预览
        const dx = touches[0].clientX - swipeStartXRef.current
        swipeDeltaRef.current = dx
        setSwipeDelta(dx)
      }
    }
  }, [scale, lightboxImageList.length])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const startTouches = touchStartRef.current
    const elapsed = Date.now() - (startTouches[0]?.time || 0)

    // 双指缩放结束
    if (startTouches.length >= 2) {
      pinchStartDistRef.current = 0
      isTouchPanningRef.current = false
      setSwipeDelta(0)
      return
    }

    isTouchPanningRef.current = false

    // 双击检测
    if (startTouches.length === 1 && elapsed < 300) {
      const now = Date.now()
      if (now - lastTapTimeRef.current < 300) {
        // 双击 → 切换缩放
        lastTapTimeRef.current = 0
        if (scale > 1.1) {
          setScale(1)
          panRef.current = { x: 0, y: 0 }
          setRenderPan({ x: 0, y: 0 })
        } else {
          setScale(2.5)
        }
        setSwipeDelta(0)
        return
      }
      lastTapTimeRef.current = now
    }

    // 滑动切换
    if (lightboxImageUrl && lightboxImageList.length > 1 && scale <= 1.05 && Math.abs(swipeDeltaRef.current) > 50) {
      const idx = lightboxImageList.indexOf(lightboxImageUrl)
      if (swipeDeltaRef.current < 0 && idx < lightboxImageList.length - 1) {
        goTo(idx + 1)
      } else if (swipeDeltaRef.current > 0 && idx > 0) {
        goTo(idx - 1)
      }
    }
    setSwipeDelta(0)
    swipeDeltaRef.current = 0
  }, [scale, lightboxImageList, lightboxImageUrl])

  // 双击：缩放 1x → 2.5x，再双击回到 1x
  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      if (scale > 1.1) {
        setScale(1)
        panRef.current = { x: 0, y: 0 }
        setRenderPan({ x: 0, y: 0 })
      } else {
        setScale(2.5)
      }
    },
    [scale],
  )

  if (!lightboxImageUrl) return null

  const currentIndex = lightboxImageList.indexOf(lightboxImageUrl)
  const hasPrev = currentIndex > 0
  const hasNext = currentIndex < lightboxImageList.length - 1

  const goTo = (idx: number) => {
    panRef.current = { x: 0, y: 0 }
    setRenderPan({ x: 0, y: 0 })
    setScale(1)
    const url = lightboxImageList[idx]
    if (url) setLightboxImageUrl(url, lightboxImageList)
  }

  const isZoomed = scale > 1.05
  const cursorClass = isPanning ? 'cursor-grabbing' : isZoomed ? 'cursor-grab' : 'cursor-default'

  const resetView = () => {
    setScale(1)
    panRef.current = { x: 0, y: 0 }
    setRenderPan({ x: 0, y: 0 })
  }

  const handleBgClick = () => {
    resetView()
    setLightboxImageUrl(null)
  }

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[90] bg-black/80 backdrop-blur-sm flex items-center justify-center overflow-hidden select-none animate-fade-in"
      onClick={handleBgClick}
    >
      {/* 关闭按钮 */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          handleBgClick()
        }}
        className="absolute top-4 right-4 p-2 text-white/70 hover:text-white transition-colors z-10"
        aria-label="关闭"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* 工具栏 */}
      <div className="absolute top-4 left-4 flex items-center gap-2 z-10">
        {isZoomed && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              resetView()
            }}
            className="p-1.5 rounded-lg bg-black/40 text-white/70 hover:text-white hover:bg-black/60 transition-colors text-xs"
            title="重置缩放"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        )}
        <button
          onClick={async (e) => {
            e.stopPropagation()
            if (isNative()) {
              const ok = await downloadImage(lightboxImageUrl, 'gpt-image')
              if (ok) showToast('已分享图片', 'success')
              else showToast('下载失败', 'error')
              return
            }
            try {
              const resp = await fetch(lightboxImageUrl)
              const blob = await resp.blob()
              const a = document.createElement('a')
              a.href = URL.createObjectURL(blob)
              a.download = `image.${blob.type.split('/')[1] || 'png'}`
              a.click()
              URL.revokeObjectURL(a.href)
              showToast('已开始下载', 'success')
            } catch {
              showToast('下载失败', 'error')
            }
          }}
          className="p-1.5 rounded-lg bg-black/40 text-white/70 hover:text-white hover:bg-black/60 transition-colors"
          title="下载图片"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        </button>
        <span className="bg-black/40 text-white/70 text-xs px-2 py-1 rounded-lg font-mono min-w-[48px] text-center">
          {Math.round(scale * 100)}%
        </span>
      </div>

      {/* 上一张 */}
      {hasPrev && !isZoomed && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            goTo(currentIndex - 1)
          }}
          className="absolute left-4 p-2 text-white/70 hover:text-white transition-colors z-10"
        >
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}

      {/* 图片 */}
      <div
        className={`relative flex items-center justify-center ${cursorClass}`}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ width: '100%', height: '100%' }}
      >
        <img
          src={lightboxImageUrl}
          className={`select-none pointer-events-none ${
            loaded ? 'opacity-100' : 'opacity-0'
          }`}
          style={{
            transform: `translate(${renderPan.x + (scale <= 1.05 ? swipeDelta : 0)}px, ${renderPan.y}px) scale(${scale})`,
            maxWidth: isZoomed ? 'none' : '90vw',
            maxHeight: isZoomed ? 'none' : '90vh',
            transition: (isPanning || swipeDelta !== 0) ? 'none' : 'transform 0.15s ease-out',
            transformOrigin: 'center center',
          }}
          onLoad={() => setLoaded(true)}
          draggable={false}
          alt="预览"
        />
      </div>

      {/* 下一张 */}
      {hasNext && !isZoomed && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            goTo(currentIndex + 1)
          }}
          className="absolute right-4 p-2 text-white/70 hover:text-white transition-colors z-10"
        >
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}

      {/* 底部提示 */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3">
        {lightboxImageList.length > 1 && !isZoomed && (
          <span className="bg-black/50 text-white text-xs px-3 py-1.5 rounded-full backdrop-blur-sm">
            {currentIndex + 1} / {lightboxImageList.length}
          </span>
        )}
        {isZoomed && (
          <span className="bg-black/50 text-white/60 text-[10px] px-3 py-1.5 rounded-full backdrop-blur-sm">
            {isNative() ? '拖拽平移 · 双指缩放 · 双击重置' : '拖拽平移 · 滚轮缩放 · 双击重置'}
          </span>
        )}
      </div>
    </div>
  )
}
