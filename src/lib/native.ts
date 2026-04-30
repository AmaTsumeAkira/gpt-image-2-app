import { isNative } from './platform'

/** 触觉反馈 */
export async function hapticImpact(style: 'light' | 'medium' | 'heavy' = 'light') {
  if (!isNative()) return
  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics')
    await Haptics.impact({ style: ImpactStyle[style.charAt(0).toUpperCase() + style.slice(1) as keyof typeof ImpactStyle] })
  } catch { /* ignore */ }
}

export async function hapticNotification(type: 'success' | 'warning' | 'error' = 'success') {
  if (!isNative()) return
  try {
    const { Haptics, NotificationType } = await import('@capacitor/haptics')
    await Haptics.notification({ type: NotificationType[type.charAt(0).toUpperCase() + type.slice(1) as keyof typeof NotificationType] })
  } catch { /* ignore */ }
}

/** 状态栏 */
export async function setStatusBarStyle(dark: boolean) {
  if (!isNative()) return
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar')
    await StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light })
  } catch { /* ignore */ }
}

export async function setStatusBarColor(color: string) {
  if (!isNative()) return
  try {
    const { StatusBar } = await import('@capacitor/status-bar')
    await StatusBar.setBackgroundColor({ color })
  } catch { /* ignore */ }
}

/** 网络状态 */
export async function getNetworkStatus(): Promise<{ connected: boolean; type: string }> {
  try {
    const { Network } = await import('@capacitor/network')
    const status = await Network.getStatus()
    return { connected: status.connected, type: status.connectionType }
  } catch {
    return { connected: navigator.onLine, type: 'unknown' }
  }
}

export function onNetworkChange(callback: (connected: boolean) => void): () => void {
  let cleanup: (() => void) | undefined

  ;(async () => {
    try {
      const { Network } = await import('@capacitor/network')
      const handler = Network.addListener('networkStatusChange', (status) => {
        callback(status.connected)
      })
      cleanup = () => { handler.then(h => h.remove()) }
    } catch {
      // 浏览器 fallback
      const onOnline = () => callback(true)
      const onOffline = () => callback(false)
      window.addEventListener('online', onOnline)
      window.addEventListener('offline', onOffline)
      cleanup = () => {
        window.removeEventListener('online', onOnline)
        window.removeEventListener('offline', onOffline)
      }
    }
  })()

  return () => cleanup?.()
}
