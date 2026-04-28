import { useStore } from '../store'
import { useCloseOnEscape } from '../hooks/useCloseOnEscape'

export default function ConfirmDialog() {
  const confirmDialog = useStore((s) => s.confirmDialog)
  const setConfirmDialog = useStore((s) => s.setConfirmDialog)

  useCloseOnEscape(Boolean(confirmDialog), () => setConfirmDialog(null))

  if (!confirmDialog) return null

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm animate-overlay-in"
        onClick={() => setConfirmDialog(null)}
      />
      <div
        className="relative z-10 w-full max-w-sm rounded-2xl bg-white border border-gray-200 p-6 shadow-2xl ring-1 ring-black/5 animate-confirm-in"
      >
        <h3 className="text-base font-semibold text-gray-800 mb-2">{confirmDialog.title}</h3>
        <p className="text-sm text-gray-500 mb-6">{confirmDialog.message}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={() => setConfirmDialog(null)}
            className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
          >
            取消
          </button>
          <button
            onClick={() => {
              confirmDialog.action()
              setConfirmDialog(null)
            }}
            className="px-4 py-2 rounded-xl text-sm font-medium bg-red-500 text-white hover:bg-red-600 transition-colors"
          >
            确定
          </button>
        </div>
      </div>
    </div>
  )
}
