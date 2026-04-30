import { useEffect, useRef, useState, useCallback } from 'react'
import { normalizeBaseUrl, queryBalance } from '../lib/api'
import { useStore, clearAllData } from '../store'
import { DEFAULT_SETTINGS, type AppSettings } from '../types'
import { useCloseOnEscape } from '../hooks/useCloseOnEscape'
import { isNative } from '../lib/platform'

export default function SettingsModal() {
  const showSettings = useStore((s) => s.showSettings)
  const setShowSettings = useStore((s) => s.setShowSettings)
  const settings = useStore((s) => s.settings)
  const setSettings = useStore((s) => s.setSettings)
  const setConfirmDialog = useStore((s) => s.setConfirmDialog)
  const showToast = useStore((s) => s.showToast)
  const [draft, setDraft] = useState<AppSettings>(settings)
  const [timeoutInput, setTimeoutInput] = useState(String(settings.timeout))
  const [showApiKey, setShowApiKey] = useState(false)

  // 余额查询
  const [balance, setBalance] = useState<{ remain: string; used: string; unlimited: boolean } | null>(null)
  const [balanceLoading, setBalanceLoading] = useState(false)
  const [balanceError, setBalanceError] = useState<string | null>(null)

  useEffect(() => {
    if (showSettings) {
      setDraft(settings)
      setTimeoutInput(String(settings.timeout))
      // 有 API Key 时自动查询余额（仅 APIMart）
      if (settings.apiKey && settings.provider === 'apimart') {
        loadBalance()
      } else {
        setBalance(null)
        setBalanceError(null)
      }
    }
  }, [showSettings, settings])

  const loadBalance = async () => {
    setBalanceLoading(true)
    setBalanceError(null)
    try {
      const data = await queryBalance(useStore.getState().settings)
      if (data.success) {
        setBalance({
          remain: data.unlimited_quota ? '无限' : String(data.remain_balance ?? '?'),
          used: String(data.used_balance ?? '?'),
          unlimited: !!data.unlimited_quota,
        })
      } else {
        setBalanceError(data.message || '查询失败')
      }
    } catch (err) {
      setBalanceError(err instanceof Error ? err.message : '查询失败')
    } finally {
      setBalanceLoading(false)
    }
  }

  const commitSettings = (nextDraft: AppSettings) => {
    const normalizedDraft = {
      ...nextDraft,
      baseUrl: normalizeBaseUrl(nextDraft.baseUrl.trim() || DEFAULT_SETTINGS.baseUrl),
      apiKey: nextDraft.apiKey,
      apimartApiKey: nextDraft.apimartApiKey,
      dmfoxApiKey: nextDraft.dmfoxApiKey,
      model: nextDraft.model.trim() || DEFAULT_SETTINGS.model,
      timeout: Number(nextDraft.timeout) || DEFAULT_SETTINGS.timeout,
    }
    setDraft(normalizedDraft)
    setSettings(normalizedDraft)
  }

  const handleClose = () => {
    const nextTimeout = Number(timeoutInput)
    commitSettings({
      ...draft,
      timeout:
        timeoutInput.trim() === '' || Number.isNaN(nextTimeout)
          ? DEFAULT_SETTINGS.timeout
          : nextTimeout,
    })
    setShowSettings(false)
  }

  const commitTimeout = useCallback(() => {
    const nextTimeout = Number(timeoutInput)
    const normalizedTimeout =
      timeoutInput.trim() === ''
        ? DEFAULT_SETTINGS.timeout
        : Number.isNaN(nextTimeout)
          ? draft.timeout
          : nextTimeout
    setTimeoutInput(String(normalizedTimeout))
    commitSettings({ ...draft, timeout: normalizedTimeout })
  }, [draft, timeoutInput])

  useCloseOnEscape(showSettings, handleClose)

  if (!showSettings) return null

  const handleClearAll = () => {
    setConfirmDialog({
      title: '清空所有数据',
      message: '确定要清空所有数据吗？包括任务记录和设置。此操作不可撤销。',
      action: () => {
        clearAllData()
        setShowSettings(false)
      },
    })
  }

  const mobile = typeof window !== 'undefined' && (isNative() || window.innerWidth < 768)

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm animate-overlay-in" onClick={handleClose} />
      <div className={`relative z-10 w-full max-w-md sm:rounded-3xl rounded-t-3xl border border-white/50 bg-white/95 p-5 shadow-2xl ring-1 ring-black/5 ${mobile ? 'animate-bottom-sheet-in' : 'animate-modal-in'} overflow-y-auto sm:max-h-[85vh] max-h-[92vh]`} style={{ paddingBottom: 'calc(1.25rem + var(--safe-bottom))' }}>
        {/* 拖拽条（移动端） */}
        <div className="flex justify-center mb-3 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>

        <div className="mb-5 flex items-center justify-between gap-4">
          <h3 className="text-base font-semibold text-gray-800 flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            设置
          </h3>
          <button
            onClick={handleClose}
            className="rounded-full p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
            aria-label="关闭"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-6">
          {/* API 配置 */}
          <section>
            <h4 className="mb-4 text-sm font-medium text-gray-800 flex items-center gap-1.5">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
              API 配置
            </h4>
            <div className="space-y-4">
              {/* 供应商切换 */}
              <div className="block">
                <span className="block text-xs text-gray-500 mb-1.5">供应商</span>
                <div className="flex gap-2">
                  {([['apimart', 'APIMart（异步）'], ['dmfox', 'DM-Fox（同步）']] as const).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => {
                        commitSettings({ ...draft, provider: key, baseUrl: key === 'dmfox' ? 'https://dm-fox.rjj.cc/codex' : 'https://api.apimart.ai', model: key === 'dmfox' ? 'gpt-image-2' : 'gpt-image-2-official' })
                      }}
                      className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${
                        draft.provider === key
                          ? 'bg-blue-500 text-white shadow-sm'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <label className="block">
                <span className="block text-xs text-gray-500 mb-1">API URL</span>
                <input
                  value={draft.baseUrl}
                  onChange={(e) => setDraft((prev) => ({ ...prev, baseUrl: e.target.value }))}
                  onBlur={(e) => commitSettings({ ...draft, baseUrl: e.target.value })}
                  type="text"
                  placeholder={DEFAULT_SETTINGS.baseUrl}
                  className="w-full rounded-xl border border-gray-200/70 bg-white/60 px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-blue-300"
                />
                <div className="mt-1 text-[10px] text-gray-400">
                  支持通过查询参数覆盖：<code className="bg-gray-100 px-1 py-0.5 rounded">?apiUrl=</code>
                </div>
              </label>

              <div className="block">
                <span className="block text-xs text-gray-500 mb-1">API Key</span>
                <div className="relative">
                  <input
                    value={draft.apiKey}
                    onChange={(e) => setDraft((prev) => ({ ...prev, apiKey: e.target.value }))}
                    onBlur={(e) => commitSettings({ ...draft, apiKey: e.target.value })}
                    type={showApiKey ? 'text' : 'password'}
                    placeholder="sk-..."
                    className="w-full rounded-xl border border-gray-200/70 bg-white/60 px-3 py-2 pr-10 text-sm text-gray-700 outline-none transition focus:border-blue-300"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 transition-colors"
                    tabIndex={-1}
                  >
                    {showApiKey ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                        <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* APIMart 专用 Key（DM-Fox 模式下上传图片需用到） */}
              <div className="block">
                <span className="block text-xs text-gray-500 mb-1">
                  APIMart API Key
                  {draft.provider === 'dmfox' && <span className="text-gray-400 ml-1">（仅图片库需要）</span>}
                </span>
                <div className="relative">
                  <input
                    value={draft.apimartApiKey}
                    onChange={(e) => setDraft((prev) => ({ ...prev, apimartApiKey: e.target.value }))}
                    onBlur={(e) => commitSettings({ ...draft, apimartApiKey: e.target.value })}
                    type={showApiKey ? 'text' : 'password'}
                    placeholder={draft.provider === 'apimart' ? '与上方 API Key 相同可留空' : 'sk-...'}
                    className="w-full rounded-xl border border-gray-200/70 bg-white/60 px-3 py-2 pr-10 text-sm text-gray-700 outline-none transition focus:border-blue-300"
                  />
                </div>
                <div className="mt-1 text-[10px] text-gray-400">
                  用于图片库上传，与当前供应商的 Key 不同时可单独配置
                </div>
              </div>

              <label className="block">
                <span className="block text-xs text-gray-500 mb-1">模型</span>
                <input
                  value={draft.model}
                  onChange={(e) => setDraft((prev) => ({ ...prev, model: e.target.value }))}
                  onBlur={(e) => commitSettings({ ...draft, model: e.target.value })}
                  type="text"
                  placeholder={DEFAULT_SETTINGS.model}
                  className="w-full rounded-xl border border-gray-200/70 bg-white/60 px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-blue-300"
                />
              </label>

              <label className="block">
                <span className="block text-xs text-gray-500 mb-1">超时（秒）</span>
                <input
                  value={timeoutInput}
                  onChange={(e) => setTimeoutInput(e.target.value)}
                  onBlur={commitTimeout}
                  type="number"
                  min={30}
                  max={600}
                  className="w-full rounded-xl border border-gray-200/70 bg-white/60 px-3 py-2 text-sm text-gray-700 outline-none transition focus:border-blue-300"
                />
                <div className="mt-1 text-[10px] text-gray-400">建议 ≥ 180 秒（high + 4K 可能耗时 130s+）</div>
              </label>
            </div>
          </section>

          {/* 余额信息（仅 APIMart） */}
          {settings.apiKey && settings.provider === 'apimart' && (
            <section>
              <h4 className="mb-3 text-sm font-medium text-gray-800 flex items-center gap-1.5">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                账户余额
              </h4>
              <div className="rounded-xl bg-gray-50 border border-gray-100 p-3">
                {balanceLoading ? (
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    查询中...
                  </div>
                ) : balanceError ? (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-red-500">{balanceError}</span>
                    <button
                      onClick={loadBalance}
                      className="text-xs text-blue-500 hover:text-blue-600 transition-colors"
                    >
                      重试
                    </button>
                  </div>
                ) : balance ? (
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500">剩余</span>
                      <span className={`font-semibold font-mono ${balance.unlimited ? 'text-green-500' : 'text-gray-800'}`}>
                        {balance.unlimited ? '∞ 无限额度' : balance.remain}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-500">已使用</span>
                      <span className="font-mono text-gray-600">{balance.used}</span>
                    </div>
                    <button
                      onClick={loadBalance}
                      className="mt-1 text-[11px] text-gray-400 hover:text-blue-500 transition-colors flex items-center gap-1"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      刷新
                    </button>
                  </div>
                ) : (
                  <div className="text-sm text-gray-400">无法获取余额信息</div>
                )}
              </div>
            </section>
          )}

          {/* 数据管理 */}
          <section>
            <h4 className="mb-4 text-sm font-medium text-gray-800 flex items-center gap-1.5">
              <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              数据管理
            </h4>
            <div className="flex gap-2">
              <button
                onClick={handleClearAll}
                className="flex-1 py-2 rounded-xl text-sm font-medium bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
              >
                清空所有数据
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
