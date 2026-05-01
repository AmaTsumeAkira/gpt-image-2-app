import { isNative } from './platform'
import { registerPlugin } from '@capacitor/core'

interface GallerySaverPlugin {
  saveToGallery(options: { filePath: string; fileName: string; mimeType: string }): Promise<{ uri: string; displayName: string }>
}

interface InstallerPlugin {
  installApk(options: { filePath: string }): Promise<void>
}

const GallerySaver = registerPlugin<GallerySaverPlugin>('GallerySaver')
export const Installer = registerPlugin<InstallerPlugin>('Installer')

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

/** 监听 APP 前后台切换 */
export function onAppStateChange(callback: (state: { isActive: boolean }) => void): () => void {
  let cleanup: (() => void) | undefined

  ;(async () => {
    try {
      const { App } = await import('@capacitor/app')
      const handle = await App.addListener('appStateChange', callback)
      cleanup = () => { handle.remove() }
    } catch {
      // 浏览器 fallback：用 visibilitychange
      const onVisibility = () => callback({ isActive: !document.hidden })
      document.addEventListener('visibilitychange', onVisibility)
      cleanup = () => document.removeEventListener('visibilitychange', onVisibility)
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

/** 分享图片到其他应用 */
export async function shareImage(url: string, title?: string): Promise<boolean> {
  try {
    // 先用 dataUrl 或远程 URL 获取 blob
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
    const path = `share_${Date.now()}.${ext}`

    // 写入缓存后分享
    const { Filesystem, Directory } = await import('@capacitor/filesystem')
    const written = await Filesystem.writeFile({
      path,
      data: base64,
      directory: Directory.Cache,
    })

    const { Share } = await import('@capacitor/share')
    await Share.share({ title: title || 'GPT Image', files: [written.uri] })
    return true
  } catch (e) {
    console.error('shareImage failed:', e)
    // 浏览器降级：Web Share API
    try {
      if (navigator.share) {
        const resp = await fetch(url)
        const blob = await resp.blob()
        const file = new File([blob], `image.${blob.type.split('/')[1] || 'png'}`, { type: blob.type })
        await navigator.share({ title: title || 'GPT Image', files: [file] })
        return true
      }
    } catch { /* ignore */ }
    return false
  }
}

/** 批量保存图片到相册，返回成功/失败数量 */
export async function batchDownloadImages(
  images: Array<{ url: string; filename: string }>,
  onProgress?: (done: number, total: number) => void,
): Promise<{ success: number; failed: number }> {
  let success = 0
  let failed = 0
  for (let i = 0; i < images.length; i++) {
    const ok = await downloadImage(images[i].url, images[i].filename)
    if (ok) success++
    else failed++
    onProgress?.(i + 1, images.length)
  }
  return { success, failed }
}

// ===== 本地通知 =====

let notificationPermitted = false

/** 请求通知权限（APP 启动时调用一次） */
export async function requestNotificationPermission() {
  if (!isNative()) return
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    const result = await LocalNotifications.requestPermissions()
    notificationPermitted = result.display === 'granted'
  } catch {
    /* ignore */
  }
}

/** 发送任务完成通知 */
export async function notifyTaskComplete(title: string, body: string, id: number) {
  if (!isNative() || !notificationPermitted) return
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications')
    await LocalNotifications.schedule({
      notifications: [{
        id,
        title,
        body,
        smallIcon: 'ic_launcher',
        largeIcon: 'ic_launcher',
      }],
    })
  } catch {
    /* ignore */
  }
}
