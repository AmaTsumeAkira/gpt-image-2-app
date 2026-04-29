import { useRef, useState, useEffect, useCallback } from 'react'
import { useStore } from '../store'

const BRUSH_SIZES = [10, 20, 40, 60, 100, 150, 200]

export default function MaskEditor() {
  const showMaskEditor = useStore((s) => s.showMaskEditor)
  const setShowMaskEditor = useStore((s) => s.setShowMaskEditor)
  const inputImages = useStore((s) => s.inputImages)
  const setMaskImage = useStore((s) => s.setMaskImage)
  const showToast = useStore((s) => s.showToast)

  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [brushSize, setBrushSize] = useState(40)
  const [erasing, setErasing] = useState(false)
  const [drawing, setDrawing] = useState(false)
  const [imgLoaded, setImgLoaded] = useState(false)
  const [imgNatural, setImgNatural] = useState({ w: 0, h: 0 })
  const undoStackRef = useRef<ImageData[]>([])
  const imgRef = useRef<HTMLImageElement | null>(null)

  const refImage = inputImages[0] // 只取首张

  // 初始化 canvas（全透明，参考图在底层可见）
  useEffect(() => {
    if (!showMaskEditor || !refImage) return

    const img = new Image()
    imgRef.current = img
    img.onload = () => {
      setImgNatural({ w: img.naturalWidth, h: img.naturalHeight })
      setImgLoaded(true)

      const canvas = canvasRef.current
      if (!canvas) return
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')!
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      undoStackRef.current = [ctx.getImageData(0, 0, canvas.width, canvas.height)]
    }
    img.src = refImage.dataUrl

    return () => {
      imgRef.current = null
      setImgLoaded(false)
    }
  }, [showMaskEditor, refImage])

  // 坐标映射（canvas 原始尺寸 → 视口缩放）
  const scaleCoord = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current
    const rect = canvas?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return {
      x: (clientX - rect.left) * (canvas!.width / rect.width),
      y: (clientY - rect.top) * (canvas!.height / rect.height),
    }
  }, [])

  const paint = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const { x, y } = scaleCoord(clientX, clientY)

    ctx.lineWidth = brushSize
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    if (erasing) {
      // 橡皮擦：清除标记（恢复保留区域）
      ctx.globalCompositeOperation = 'destination-out'
      ctx.strokeStyle = 'rgba(0,0,0,1)'
    } else {
      // 画笔：半透明红色标记重绘区域
      ctx.globalCompositeOperation = 'source-over'
      ctx.strokeStyle = 'rgba(255,60,60,0.55)'
    }

    ctx.lineTo(x, y)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(x, y)
  }, [brushSize, erasing, scaleCoord])

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    setDrawing(true)
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    ctx.beginPath()
    paint(e.clientX, e.clientY)
  }, [paint])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!drawing) return
    paint(e.clientX, e.clientY)
  }, [drawing, paint])

  const handlePointerUp = useCallback(() => {
    if (!drawing) return
    setDrawing(false)
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const stack = undoStackRef.current
    stack.push(ctx.getImageData(0, 0, canvas.width, canvas.height))
    if (stack.length > 50) stack.shift()
  }, [drawing])

  const handleUndo = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const stack = undoStackRef.current
    if (stack.length <= 1) return
    stack.pop()
    const prev = stack[stack.length - 1]
    const ctx = canvas.getContext('2d')!
    ctx.putImageData(prev, 0, 0)
  }, [])

  const handleClear = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    undoStackRef.current = [ctx.getImageData(0, 0, canvas.width, canvas.height)]
  }, [])

  const handleSave = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const src = ctx.getImageData(0, 0, canvas.width, canvas.height)

    // 检查是否有绘制内容（非全透明）
    let hasContent = false
    for (let i = 3; i < src.data.length; i += 4) {
      if (src.data[i] > 0) { hasContent = true; break }
    }
    if (!hasContent) {
      showToast('请先涂抹要重绘的区域', 'error')
      return
    }

    // 转换视觉标记为 API 遮罩格式：
    // 有红色标记 → 透明（API 重绘），无标记 → 白色不透明（API 保留）
    const out = ctx.createImageData(canvas.width, canvas.height)
    for (let i = 0; i < src.data.length; i += 4) {
      if (src.data[i + 3] > 0) {
        // 有绘制内容 → 透明 = 重绘
        out.data[i] = 0
        out.data[i + 1] = 0
        out.data[i + 2] = 0
        out.data[i + 3] = 0
      } else {
        // 无绘制内容 → 白色不透明 = 保留
        out.data[i] = 255
        out.data[i + 1] = 255
        out.data[i + 2] = 255
        out.data[i + 3] = 255
      }
    }
    ctx.putImageData(out, 0, 0)
    const dataUrl = canvas.toDataURL('image/png')
    setMaskImage({ id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36), dataUrl })
    setShowMaskEditor(false)
    showToast('遮罩已就绪', 'success')
  }, [setMaskImage, setShowMaskEditor, showToast])

  if (!showMaskEditor || !refImage) return null

  const containerW = Math.min(window.innerWidth - 32, imgNatural.w, 1200)
  const scale = containerW / imgNatural.w
  const displayH = imgNatural.h * scale

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-overlay-in" onClick={() => setShowMaskEditor(false)} />
      <div
        className="relative z-10 w-full max-w-5xl bg-gray-900 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-modal-in"
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: 'calc(100vh - 32px)' }}
      >
        {/* 顶部工具栏 */}
        <div className="flex items-center gap-3 px-4 py-3 bg-gray-800 flex-wrap">
          <span className="text-xs text-gray-400 font-medium mr-1">遮罩绘制</span>

          {/* 笔刷大小 */}
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-gray-500">笔刷</span>
            <div className="flex gap-0.5">
              {BRUSH_SIZES.map((s) => (
                <button
                  key={s}
                  onClick={() => setBrushSize(s)}
                  className={`w-6 h-6 rounded text-[10px] font-medium transition-colors ${
                    brushSize === s ? 'bg-white text-gray-800' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                  }`}
                >{s}</button>
              ))}
            </div>
          </div>

          {/* 模式切换 */}
          <button
            onClick={() => setErasing(false)}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
              !erasing ? 'bg-red-500/80 text-white' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
            }`}
          >画笔（重绘）</button>
          <button
            onClick={() => setErasing(true)}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
              erasing ? 'bg-white text-gray-800' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
            }`}
          >橡皮（保留）</button>

          <div className="flex-1" />

          {/* 操作 */}
          <button onClick={handleUndo} className="px-2 py-1 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 text-xs transition-colors" title="撤销">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a5 5 0 015 5v2M3 10l4-4m-4 4l4 4" />
            </svg>
          </button>
          <button onClick={handleClear} className="px-2 py-1 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 text-xs transition-colors" title="重置">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>

        {/* Canvas 区域 */}
        <div
          ref={containerRef}
          className="flex-1 overflow-auto bg-gray-700 flex items-start justify-center p-2 relative"
          style={{
            backgroundImage: 'repeating-conic-gradient(#555 0% 25%, #666 0% 50%)',
            backgroundSize: '20px 20px',
            cursor: erasing
              ? `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${Math.min(brushSize, 40)}' height='${Math.min(brushSize, 40)}'%3E%3Ccircle cx='50%25' cy='50%25' r='45%25' fill='none' stroke='white' stroke-width='2'/%3E%3C/svg%3E") ${Math.min(brushSize, 40) / 2} ${Math.min(brushSize, 40) / 2}, auto`
              : `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${Math.min(brushSize, 40)}' height='${Math.min(brushSize, 40)}'%3E%3Ccircle cx='50%25' cy='50%25' r='45%25' fill='rgba(255,60,60,0.4)' stroke='red' stroke-width='2'/%3E%3C/svg%3E") ${Math.min(brushSize, 40) / 2} ${Math.min(brushSize, 40) / 2}, auto`,
          }}
        >
          {!imgLoaded && (
            <div className="flex items-center justify-center py-20 text-gray-400 text-sm">加载参考图中...</div>
          )}
          <div
            className="relative"
            style={{ width: containerW, height: displayH, display: imgLoaded ? 'block' : 'none' }}
          >
            {/* 背景图 */}
            <img
              src={refImage.dataUrl}
              className="absolute inset-0 w-full h-full object-contain rounded-lg"
              draggable={false}
              alt="参考图"
            />
            {/* 绘制 canvas（透明背景，红色半透明标记） */}
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full rounded-lg"
              style={{ touchAction: 'none' }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
            />
            {/* 预览提示 */}
            <div className="absolute bottom-3 left-3 text-[10px] text-white/70 bg-black/50 px-2 py-1 rounded backdrop-blur-sm pointer-events-none select-none">
              红色 = 重绘区域 · 透明 = 保留
            </div>
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="flex justify-end gap-2 px-4 py-3 bg-gray-800">
          <button
            onClick={() => setShowMaskEditor(false)}
            className="px-4 py-2 rounded-xl text-sm font-medium bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
          >取消</button>
          <button
            onClick={handleSave}
            className="px-5 py-2 rounded-xl text-sm font-medium bg-blue-500 text-white hover:bg-blue-600 transition-colors"
          >保存遮罩</button>
        </div>
      </div>
    </div>
  )
}
