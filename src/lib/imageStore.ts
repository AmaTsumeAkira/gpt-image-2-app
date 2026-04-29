/** IndexedDB 持久化存储（替代 localStorage，无 5MB 配额限制） */

const DB_NAME = 'gpt-image-2-store'
const STORE_NAME = 'cache'
const DB_VERSION = 1

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function saveTasks<T>(tasks: T[]): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(tasks, 'tasks')
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => { db.close(); reject(tx.error) }
  })
}

export async function loadTasks<T = unknown>(): Promise<T[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).get('tasks')
    req.onsuccess = () => { db.close(); resolve(req.result ?? []) }
    req.onerror = () => { db.close(); reject(req.error) }
  })
}

export async function clearTasks(): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete('tasks')
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => { db.close(); reject(tx.error) }
  })
}

/** 保存远程图片缓存映射表（remoteUrl → dataUrl） */
export async function saveCacheMap(entries: [string, string][]): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(entries, 'remoteImageCache')
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => { db.close(); reject(tx.error) }
  })
}

/** 加载远程图片缓存映射表 */
export async function loadCacheMap(): Promise<[string, string][]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const req = tx.objectStore(STORE_NAME).get('remoteImageCache')
    req.onsuccess = () => { db.close(); resolve(req.result ?? []) }
    req.onerror = () => { db.close(); reject(req.error) }
  })
}

/** 首次加载时从 localStorage 迁移已有数据到 IndexedDB */
export async function migrateFromLocalStorage<T = unknown>(): Promise<T[]> {
  try {
    const raw = localStorage.getItem('gpt-image-2-app-tasks')
    if (raw) {
      const tasks: T[] = JSON.parse(raw)
      if (Array.isArray(tasks) && tasks.length > 0) {
        await saveTasks(tasks)
      }
      return tasks
    }
  } catch {
    /* ignore */
  }
  return []
}
