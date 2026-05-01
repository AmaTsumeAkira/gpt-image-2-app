import { useState, useEffect } from 'react'
import { checkForUpdate, type UpdateInfo } from '../lib/version'
import { isNative } from '../lib/platform'
import { Installer } from '../lib/native'
import { useStore } from '../store'

export default function UpdateBanner() {
  const [info, setInfo] = useState<UpdateInfo | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const showToast = useStore((s) => s.showToast)

  useEffect(() => {
    if (!isNative()) return
    checkForUpdate().then((result) => {
      if (result?.hasUpdate) setInfo(result)
    }).catch((err) => {
      console.warn('[UpdateBanner] check failed:', err)
    })
  }, [])

  const handleDownload = async () => {
    if (!info) return

    if (!isNative()) {
      window.open(info.downloadUrl, '_blank')
      return
    }

    if (!info.downloadUrl) {
      showToast('无下载链接', 'error')
      return
    }

    setDownloading(true)
    try {
      showToast('正在下载...', 'info')
      const { Filesystem, Directory } = await import('@capacitor/filesystem')

      const resp = await fetch(info.downloadUrl)
      if (!resp.ok) throw new Error(`下载失败: HTTP ${resp.status}`)

      const blob = await resp.blob()
      console.log('[UpdateBanner] downloaded', blob.size, 'bytes')

      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve((reader.result as string).split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })

      const path = `gpt-image-${info.latestVersion}.apk`
      const written = await Filesystem.writeFile({
        path,
        data: base64,
        directory: Directory.Cache,
      })

      console.log('[UpdateBanner] written to:', written.uri)
      showToast('正在安装...', 'info')
      await Installer.installApk({ filePath: written.uri })
    } catch (e) {
      console.error('[UpdateBanner] update failed:', e)
      showToast(`更新失败: ${e instanceof Error ? e.message : '未知错误'}`, 'error')
    } finally {
      setDownloading(false)
    }
  }

  if (!info || dismissed) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-[80] animate-slide-down-in">
      <div
        className="mx-auto max-w-lg px-4 pt-3 pb-3"
        style={{ paddingTop: 'calc(0.75rem + var(--safe-top))' }}
      >
        <div className="flex items-center gap-3 bg-blue-500 text-white px-4 py-3 rounded-2xl shadow-lg shadow-blue-500/30">
          <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">发现新版本 v{info.latestVersion}</p>
            <p className="text-xs text-blue-100 truncate">点击下载更新</p>
          </div>
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex-shrink-0 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {downloading ? '下载中...' : '更新'}
          </button>
          <button
            onClick={() => setDismissed(true)}
            className="flex-shrink-0 p-1 hover:bg-white/20 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
