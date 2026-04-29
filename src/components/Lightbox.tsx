import { useEffect, useState, useRef, useCallback } from 'react'
import { useStore } from '../store'
import { useCloseOnEscape } from '../hooks/useCloseOnEscape'

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
        style={{ width: '100%', height: '100%' }}
      >
        <img
          src={lightboxImageUrl}
          className={`select-none pointer-events-none ${
            loaded ? 'opacity-100' : 'opacity-0'
          }`}
          style={{
            transform: `translate(${renderPan.x}px, ${renderPan.y}px) scale(${scale})`,
            maxWidth: isZoomed ? 'none' : '90vw',
            maxHeight: isZoomed ? 'none' : '90vh',
            transition: isPanning ? 'none' : 'transform 0.15s ease-out',
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
            拖拽平移 · 滚轮缩放 · 双击重置
          </span>
        )}
      </div>
    </div>
  )
}
