import { useEffect, useState } from 'react'
import { useStore, getCacheStats, pruneExpiredCache, dedupCache, cleanupDeletedTaskCache } from '../store'
import { useCloseOnEscape } from '../hooks/useCloseOnEscape'

export default function DbManageModal() {
  const showDbManage = useStore((s) => s.showDbManage)
  const setShowDbManage = useStore((s) => s.setShowDbManage)
  const showToast = useStore((s) => s.showToast)

  const [stats, setStats] = useState(getCacheStats())
  const [storageEstimate, setStorageEstimate] = useState<{ usage: number; quota: number } | null>(null)
  const [busy, setBusy] = useState(false)

  useCloseOnEscape(showDbManage, () => setShowDbManage(false))

  useEffect(() => {
    if (!showDbManage) return
    setStats(getCacheStats())
    navigator.storage?.estimate().then((e) => {
      if (e.usage != null && e.quota != null) {
        setStorageEstimate({ usage: e.usage, quota: e.quota })
      }
    }).catch(() => {})
  }, [showDbManage])

  const fmtBytes = (b: number) => {
    if (b < 1024) return `${b} B`
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
    return `${(b / (1024 * 1024)).toFixed(1)} MB`
  }

  const handlePrune = async () => {
    setBusy(true)
    const n = await pruneExpiredCache()
    setStats(getCacheStats())
    setBusy(false)
    showToast(n > 0 ? `已清理 ${n} 条失效缓存` : '没有失效缓存', n > 0 ? 'success' : 'info')
  }

  const handleDedup = async () => {
    setBusy(true)
    const n = await dedupCache()
    setStats(getCacheStats())
    setBusy(false)
    showToast(n > 0 ? `已去重 ${n} 条重复缓存` : '没有重复缓存', n > 0 ? 'success' : 'info')
  }

  const handleCleanupDeleted = async () => {
    setBusy(true)
    const n = await cleanupDeletedTaskCache()
    setStats(getCacheStats())
    setBusy(false)
    showToast(n > 0 ? `已清理 ${n} 条已删除任务的缓存` : '没有需要清理的缓存', n > 0 ? 'success' : 'info')
  }

  if (!showDbManage) return null

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" onClick={() => setShowDbManage(false)}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm animate-overlay-in" />
      <div
        className="relative z-10 w-full max-w-sm rounded-3xl border border-white/50 bg-white/95 p-5 shadow-2xl ring-1 ring-black/5 animate-modal-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 标题 */}
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold text-gray-800 flex items-center gap-2">
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
            </svg>
            本地数据库
          </h3>
          <button
            onClick={() => setShowDbManage(false)}
            className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 缓存统计 */}
        <section className="mb-5">
          <h4 className="text-xs font-medium text-gray-500 mb-3">缓存统计</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">缓存图片数</span>
              <span className="font-mono text-gray-700">{stats.count}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">估算大小</span>
              <span className="font-mono text-gray-700">{fmtBytes(stats.bytes)}</span>
            </div>
            {storageEstimate && (
              <div className="flex justify-between">
                <span className="text-gray-500">浏览器存储占用</span>
                <span className="font-mono text-gray-700">
                  {fmtBytes(storageEstimate.usage)} / {fmtBytes(storageEstimate.quota)}
                </span>
              </div>
            )}
            {/* 用量条 */}
            {storageEstimate && storageEstimate.quota > 0 && (
              <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-400 rounded-full transition-all"
                  style={{ width: `${(storageEstimate.usage / storageEstimate.quota) * 100}%` }}
                />
              </div>
            )}
          </div>
        </section>

        {/* 操作 */}
        <section>
          <h4 className="text-xs font-medium text-gray-500 mb-3">维护操作</h4>
          <div className="flex flex-col gap-2">
            <button
              onClick={handlePrune}
              disabled={busy}
              className="w-full py-2 rounded-xl text-sm font-medium bg-orange-50 text-orange-600 hover:bg-orange-100 transition-colors disabled:opacity-50"
            >
              {busy ? '处理中...' : '清理失效缓存（检查远程 URL 是否可访问）'}
            </button>
            <button
              onClick={handleDedup}
              disabled={busy}
              className="w-full py-2 rounded-xl text-sm font-medium bg-purple-50 text-purple-600 hover:bg-purple-100 transition-colors disabled:opacity-50"
            >
              {busy ? '处理中...' : '去重（删除内容相同的重复缓存）'}
            </button>
            <button
              onClick={handleCleanupDeleted}
              disabled={busy}
              className="w-full py-2 rounded-xl text-sm font-medium bg-red-50 text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50"
            >
              {busy ? '处理中...' : '清理已删除任务的图片缓存'}
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}
