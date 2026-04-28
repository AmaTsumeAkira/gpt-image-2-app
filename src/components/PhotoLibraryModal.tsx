import { useRef, useState } from 'react'
import { useStore, uploadToLibrary, addLibraryImageToInput } from '../store'
import type { PhotoLibraryImage } from '../types'
import { useCloseOnEscape } from '../hooks/useCloseOnEscape'

export default function PhotoLibraryModal() {
  const showPhotoLibrary = useStore((s) => s.showPhotoLibrary)
  const setShowPhotoLibrary = useStore((s) => s.setShowPhotoLibrary)
  const photoLibrary = useStore((s) => s.photoLibrary)
  const removePhotoLibraryImage = useStore((s) => s.removePhotoLibraryImage)
  const showToast = useStore((s) => s.showToast)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useCloseOnEscape(showPhotoLibrary, () => setShowPhotoLibrary(false))

  if (!showPhotoLibrary) return null

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) return
    setUploading(true)
    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) continue
        await uploadToLibrary(file)
      }
      showToast(`已上传 ${files.length} 张图片到图片库`, 'success')
    } catch (err) {
      showToast(`上传失败：${err instanceof Error ? err.message : String(err)}`, 'error')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const handleCopyUrl = async (img: PhotoLibraryImage) => {
    try {
      await navigator.clipboard.writeText(img.remoteUrl)
      setCopiedId(img.id)
      setTimeout(() => setCopiedId(null), 2000)
      showToast('图片 URL 已复制', 'success')
    } catch {
      showToast('复制失败', 'error')
    }
  }

  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleString('zh-CN')
  }

  const formatExpiry = (expiresAt: number) => {
    const remaining = expiresAt - Date.now()
    if (remaining <= 0) return '已过期'
    const hours = Math.floor(remaining / (60 * 60 * 1000))
    const mins = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000))
    return `${hours}小时${mins}分钟后过期`
  }

  const handleSelect = (img: PhotoLibraryImage) => {
    addLibraryImageToInput(img)
    setShowPhotoLibrary(false)
  }

  const now = Date.now()
  const activePhotos = photoLibrary.filter((p) => p.expiresAt > now)

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm animate-overlay-in"
        onClick={() => setShowPhotoLibrary(false)}
      />
      <div
        className="relative z-10 w-full max-w-3xl rounded-3xl border border-white/50 bg-white/95 p-5 shadow-2xl ring-1 ring-black/5 animate-modal-in max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 顶栏 */}
        <div className="flex items-center justify-between gap-4 mb-4 flex-shrink-0">
          <h3 className="text-base font-semibold text-gray-800 flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            图片库
            <span className="text-xs font-normal text-gray-400 ml-1">
              ({activePhotos.length} 张)
            </span>
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 transition-colors disabled:opacity-50"
            >
              {uploading ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              )}
              上传图片
            </button>
            <button
              onClick={() => setShowPhotoLibrary(false)}
              className="rounded-full p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* 提示 */}
        <p className="text-xs text-gray-400 mb-4 flex-shrink-0">
          上传一次，URL 可多次使用。图片 URL 自上传起 72 小时内有效。点击图片可将其添加为参考图。
        </p>

        {/* 图片网格 */}
        {activePhotos.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-16 text-gray-400">
            <svg className="w-16 h-16 mb-4 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-sm">暂无图片，点击上方按钮上传</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto hide-scrollbar">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {activePhotos.map((img) => (
                <LibraryCard
                  key={img.id}
                  img={img}
                  copiedId={copiedId}
                  onSelect={() => handleSelect(img)}
                  onCopyUrl={() => handleCopyUrl(img)}
                  onDelete={() => {
                    removePhotoLibraryImage(img.id)
                    showToast('已从图片库移除', 'info')
                  }}
                />
              ))}
            </div>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleUpload}
        />
      </div>
    </div>
  )
}

function LibraryCard({
  img,
  copiedId,
  onSelect,
  onCopyUrl,
  onDelete,
}: {
  img: PhotoLibraryImage
  copiedId: string | null
  onSelect: () => void
  onCopyUrl: () => void
  onDelete: () => void
}) {
  const remaining = img.expiresAt - Date.now()
  const expired = remaining <= 0
  const hoursLeft = Math.floor(remaining / (60 * 60 * 1000))

  return (
    <div className="group relative bg-gray-50 rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-all">
      {/* 图片 */}
      <div
        className="aspect-square bg-gray-100 cursor-pointer overflow-hidden"
        onClick={onSelect}
        title="点击添加为参考图"
      >
        <img
          src={img.dataUrl}
          alt={img.filename}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
      </div>

      {/* 悬浮操作按钮 */}
      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => {
            e.stopPropagation()
            onCopyUrl()
          }}
          className="w-7 h-7 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-sm hover:bg-white transition-colors"
          title="复制 URL"
        >
          {copiedId === img.id ? (
            <svg className="w-3.5 h-3.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
            </svg>
          )}
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          className="w-7 h-7 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-sm hover:bg-white transition-colors"
          title="移除"
        >
          <svg className="w-3.5 h-3.5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      {/* 底部信息 */}
      <div className="px-2 py-1.5">
        <p className="text-[11px] text-gray-500 truncate">{img.filename}</p>
        <div className="flex items-center justify-between mt-0.5">
          <span className={`text-[10px] ${expired ? 'text-red-400' : hoursLeft < 12 ? 'text-amber-500' : 'text-gray-400'}`}>
            {expired ? '已过期' : `${hoursLeft}h`}
          </span>
          <span className="text-[10px] text-gray-300">
            {img.fileSize > 1024 * 1024
              ? `${(img.fileSize / (1024 * 1024)).toFixed(1)}MB`
              : `${(img.fileSize / 1024).toFixed(0)}KB`}
          </span>
        </div>
      </div>
    </div>
  )
}
