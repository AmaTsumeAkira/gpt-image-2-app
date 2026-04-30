/** 检测是否在 Capacitor 原生环境中 */
export function isNative(): boolean {
  return !!(window as any).Capacitor?.isNativePlatform?.()
}

/** 检测是否为移动端（窄屏 或 Capacitor） */
export function isMobile(): boolean {
  return isNative() || window.innerWidth < 768
}
