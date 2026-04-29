import { useStore } from '../store'
import { PROVIDER_CONFIG, type Provider } from '../types'

const providers: { key: Provider; label: string; desc: string }[] = [
  { key: 'apimart', label: 'APIMart', desc: '异步 · 任务轮询' },
  { key: 'dmfox', label: 'DM-Fox', desc: '同步 · 直接返回' },
]

export default function ProviderSwitcher() {
  const settings = useStore((s) => s.settings)
  const setSettings = useStore((s) => s.setSettings)

  return (
    <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
      {providers.map((p) => {
        const active = settings.provider === p.key
        return (
          <button
            key={p.key}
            onClick={() => setSettings({ provider: p.key })}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              active
                ? 'bg-white text-gray-800 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            title={p.desc}
          >
            {p.key === 'dmfox' && (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            )}
            {p.key === 'apimart' && (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            )}
            {p.label}
          </button>
        )
      })}
    </div>
  )
}
