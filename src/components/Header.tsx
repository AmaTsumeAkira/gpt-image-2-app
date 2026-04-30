import { useEffect, useState, useRef } from 'react'
import { useStore, cacheAllRemoteImages, clearFailedTasks } from '../store'
import { queryBalance } from '../lib/api'
import ProviderSwitcher from './ProviderSwitcher'

export default function Header() {
  const setShowSettings = useStore((s) => s.setShowSettings)
  const setShowDbManage = useStore((s) => s.setShowDbManage)
  const setShowStats = useStore((s) => s.setShowStats)
  const settings = useStore((s) => s.settings)

  const [balance, setBalance] = useState<{ remain: string; unlimited: boolean } | null>(null)
  const [balanceLoading, setBalanceLoading] = useState(false)
  const [caching, setCaching] = useState<{ done: number; total: number } | null>(null)
  const [showMore, setShowMore] = useState(false)
  const moreRef = useRef<HTMLDivElement>(null)

  const loadBalance = async () => {
    if (!settings.apiKey || settings.provider !== 'apimart') {
      setBalance(null)
      return
    }
    setBalanceLoading(true)
    try {
      const data = await queryBalance(settings)
      if (data.success) {
        setBalance({
          remain: data.unlimited_quota ? '∞' : String(data.remain_balance ?? '?'),
          unlimited: !!data.unlimited_quota,
        })
      } else {
        setBalance(null)
      }
    } catch {
      setBalance(null)
    } finally {
      setBalanceLoading(false)
    }
  }

  useEffect(() => {
    loadBalance()
  }, [settings.apiKey])

  // 点击外部关闭"更多"菜单
  useEffect(() => {
    if (!showMore) return
    const handleClick = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setShowMore(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showMore])

  return (
    <header className="sticky top-0 z-40 bg-white/80 backdrop-blur border-b border-gray-200" style={{ paddingTop: 'var(--safe-top)' }}>
      <div className="px-4 sm:px-6 h-14 flex items-center justify-between">
      {/* 缓存进度条 */}
      {caching && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-100">
          <div
            className="h-full bg-blue-500 transition-all duration-300 ease-out"
            style={{ width: `${(caching.done / caching.total) * 100}%` }}
          />
        </div>
      )}
        <h1 className="text-lg font-bold text-gray-800 tracking-tight flex items-center gap-2">
          <svg className="w-6 h-6 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <rect x="3" y="3" width="18" height="18" rx="4" />
            <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" stroke="none" />
            <path d="M21 15l-5-5L5 21" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="hidden sm:inline">GPT Image 2</span>
        </h1>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <ProviderSwitcher />
          <div className="w-px h-5 bg-gray-200 mx-1" />
          {/* 余额显示（仅 APIMart） */}
          {settings.apiKey && settings.provider === 'apimart' && (
            <button
              onClick={loadBalance}
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono text-gray-500 hover:bg-gray-100 transition-colors"
              title="点击刷新余额"
            >
              {balanceLoading ? (
                <svg className="w-3.5 h-3.5 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : balance ? (
                <>
                  <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className={balance.unlimited ? 'text-green-500 font-semibold' : ''}>
                    {balance.remain}
                  </span>
                </>
              ) : null}
            </button>
          )}

          {/* 更多菜单 */}
          <div className="relative" ref={moreRef}>
            <button
              onClick={() => setShowMore((v) => !v)}
              className="p-2.5 sm:p-2 rounded-lg hover:bg-gray-100 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              title="更多操作"
            >
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01" />
              </svg>
            </button>
            {showMore && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl border border-gray-200 shadow-lg py-1 animate-dropdown-down z-50">
                {/* 手机端显示余额 */}
                {settings.apiKey && settings.provider === 'apimart' && balance && (
                  <div className="sm:hidden px-3 py-2 text-xs text-gray-500 border-b border-gray-100 flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    余额: <span className={balance.unlimited ? 'text-green-500 font-semibold font-mono' : 'font-mono'}>{balance.remain}</span>
                  </div>
                )}
                <button
                  onClick={async () => {
                    setShowMore(false)
                    setCaching({ done: 0, total: 1 })
                    const { cached, total } = await cacheAllRemoteImages((done, total) => {
                      setCaching({ done, total })
                    })
                    setCaching(null)
                    if (cached > 0) {
                      useStore.getState().showToast(`已缓存 ${cached} 张图片到本地`, 'success')
                    } else if (total > 0) {
                      useStore.getState().showToast(`共 ${total} 张远程图片，下载失败。可能是图床不支持跨域请求。`, 'error')
                    } else {
                      useStore.getState().showToast('没有需要缓存的远程图片', 'info')
                    }
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                  style={{ pointerEvents: caching ? 'none' : undefined, opacity: caching ? 0.5 : undefined }}
                >
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  缓存远程图片
                </button>
                <button
                  onClick={() => { setShowMore(false); clearFailedTasks() }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 2 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  清理失败记录
                </button>
                <button
                  onClick={() => { setShowMore(false); setShowStats(true) }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  使用统计
                </button>
                <button
                  onClick={() => { setShowMore(false); setShowDbManage(true) }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                  </svg>
                  数据库管理
                </button>
              </div>
            )}
          </div>

          {/* 设置 */}
          <button
            onClick={() => setShowSettings(true)}
            className="p-2.5 sm:p-2 rounded-lg hover:bg-gray-100 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
            title="设置"
          >
            <svg
              className="w-5 h-5 text-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </button>
        </div>
      </div>
    </header>
  )
}
