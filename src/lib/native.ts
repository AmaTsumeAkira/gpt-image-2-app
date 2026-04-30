import { isNative } from './platform'
import { registerPlugin } from '@capacitor/core'

interface GallerySaverPlugin {
  saveToGallery(options: { filePath: string; fileName: string; mimeType: string }): Promise<{ uri: string; displayName: string }>
}

const GallerySaver = registerPlugin<GallerySaverPlugin>('GallerySaver')

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

/** 原生下载图片到手机（保存到相册） */
export async function downloadImage(url: string, filename: string): Promise<boolean> {
  if (!isNative()) return false
  try {
    const { Filesystem, Directory } = await import('@capacitor/filesystem')

    const resp = await fetch(url)
    const blob = await resp.blob()
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        const result = reader.result as string
        resolve(result.split(',')[1])
      }
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })

    const ext = blob.type.split('/')[1] || 'png'
    const mimeType = blob.type || 'image/png'
    const path = `download_${Date.now()}.${ext}`

    // 写入缓存
    const written = await Filesystem.writeFile({
      path,
      data: base64,
      directory: Directory.Cache,
    })

    // 通过原生插件保存到相册
    try {
      await GallerySaver.saveToGallery({
        filePath: written.uri,
        fileName: `${filename}.${ext}`,
        mimeType,
      })
      return true
    } catch (e) {
      console.warn('GallerySaver failed, falling back to Share:', e)
    }

    // 降级：使用系统分享
    const { Share } = await import('@capacitor/share')
    await Share.share({ title: filename, files: [written.uri] })
    return true
  } catch (e) {
    console.error('downloadImage failed:', e)
    return false
  }
}
