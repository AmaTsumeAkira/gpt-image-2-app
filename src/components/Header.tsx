import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { queryBalance } from '../lib/api'

export default function Header() {
  const setShowSettings = useStore((s) => s.setShowSettings)
  const settings = useStore((s) => s.settings)

  const [balance, setBalance] = useState<{ remain: string; unlimited: boolean } | null>(null)
  const [balanceLoading, setBalanceLoading] = useState(false)

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

  return (
    <header className="sticky top-0 z-40 bg-white/80 backdrop-blur border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-800 tracking-tight flex items-center gap-2">
          <svg className="w-6 h-6 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <rect x="3" y="3" width="18" height="18" rx="4" />
            <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" stroke="none" />
            <path d="M21 15l-5-5L5 21" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          GPT Image 2
          <span className="ml-2 text-[10px] font-normal text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-md">
            {settings.provider === 'dmfox' ? 'DM-Fox' : 'APIMart'}
          </span>
        </h1>
        <div className="flex items-center gap-1">
          {/* 余额显示（仅 APIMart） */}
          {settings.apiKey && settings.provider === 'apimart' && (
            <button
              onClick={loadBalance}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono text-gray-500 hover:bg-gray-100 transition-colors"
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
          <button
            onClick={() => setShowSettings(true)}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
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
