export const APP_VERSION = '0.1.0'

const REPO = 'AmaTsumeAkira/gpt-image-2-app'

export interface UpdateInfo {
  hasUpdate: boolean
  latestVersion: string
  downloadUrl: string
  body: string
}

function compareVersions(current: string, latest: string): boolean {
  const c = current.split('.').map(Number)
  const l = latest.split('.').map(Number)
  for (let i = 0; i < Math.max(c.length, l.length); i++) {
    const ci = c[i] || 0
    const li = l[i] || 0
    if (li > ci) return true
    if (li < ci) return false
  }
  return false
}

export async function checkForUpdate(): Promise<UpdateInfo | null> {
  try {
    const resp = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { Accept: 'application/vnd.github.v3+json' },
    })
    if (!resp.ok) return null

    const data = await resp.json()
    const tag: string = data.tag_name || ''
    const latestVersion = tag.replace(/^v/, '')
    const hasUpdate = compareVersions(APP_VERSION, latestVersion)

    // 找到 APK 下载链接
    const apkAsset = (data.assets || []).find((a: any) =>
      a.name?.endsWith('.apk'),
    )
    const downloadUrl = apkAsset?.browser_download_url || data.html_url || ''

    return {
      hasUpdate,
      latestVersion,
      downloadUrl,
      body: data.body || '',
    }
  } catch {
    return null
  }
}
