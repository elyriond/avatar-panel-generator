/**
 * IndexedDB Storage für Comic Stories
 * Verwendet IndexedDB statt LocalStorage für größere Datenmengen
 */

import { logger } from './logger'

const DB_NAME = 'AvatarPanelGenerator'
const DB_VERSION = 1
const STORY_STORE_NAME = 'stories'

export interface IDBComicStory {
  id: string
  title: string
  description?: string
  createdAt: string
  lastModifiedAt: string
  panels: IDBStoryPanel[]
  characterProfileId?: string
  chatSessionId?: string
  tags: string[]
  originalStoryboard?: Array<{ text: string; scene: string }>  // Das ursprüngliche Storyboard-JSON
  status: 'draft' | 'completed' | 'published'
  instagramPosted?: boolean
  instagramPostDate?: string
  instagramCaption?: string
  instagramHashtags?: string
}

export interface IDBStoryPanel {
  id: string
  panelNumber: number
  panelText: string
  sceneDescription?: string           // Für Regenerierung: Die ursprüngliche Scene-Beschreibung
  avatarBase64: string
  imagePrompt: string
  backgroundColor: string
  generatedAt: string
}

/**
 * Öffnet die IndexedDB Datenbank
 */
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => {
      logger.error('Fehler beim Öffnen der IndexedDB', {
        component: 'IndexedDB',
        data: request.error
      })
      reject(request.error)
    }

    request.onsuccess = () => {
      resolve(request.result)
    }

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result

      // Story Store erstellen
      if (!db.objectStoreNames.contains(STORY_STORE_NAME)) {
        const storyStore = db.createObjectStore(STORY_STORE_NAME, { keyPath: 'id' })

        // Indizes für schnellere Suchen
        storyStore.createIndex('createdAt', 'createdAt', { unique: false })
        storyStore.createIndex('lastModifiedAt', 'lastModifiedAt', { unique: false })
        storyStore.createIndex('status', 'status', { unique: false })
        storyStore.createIndex('chatSessionId', 'chatSessionId', { unique: false })

        logger.info('IndexedDB Store erstellt', {
          component: 'IndexedDB',
          data: { storeName: STORY_STORE_NAME }
        })
      }
    }
  })
}

/**
 * Speichert eine Story in IndexedDB
 */
export async function saveStory(story: IDBComicStory): Promise<void> {
  try {
    const db = await openDatabase()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORY_STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORY_STORE_NAME)
      const request = store.put(story)

      request.onsuccess = () => {
        logger.info('Story in IndexedDB gespeichert', {
          component: 'IndexedDB',
          data: { storyId: story.id, title: story.title }
        })
        resolve()
      }

      request.onerror = () => {
        logger.error('Fehler beim Speichern der Story', {
          component: 'IndexedDB',
          data: request.error
        })
        reject(request.error)
      }

      transaction.oncomplete = () => {
        db.close()
      }
    })
  } catch (error) {
    logger.error('Fehler beim Speichern der Story', {
      component: 'IndexedDB',
      data: error
    })
    throw error
  }
}

/**
 * Lädt eine Story aus IndexedDB
 */
export async function getStory(storyId: string): Promise<IDBComicStory | null> {
  try {
    const db = await openDatabase()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORY_STORE_NAME], 'readonly')
      const store = transaction.objectStore(STORY_STORE_NAME)
      const request = store.get(storyId)

      request.onsuccess = () => {
        resolve(request.result || null)
      }

      request.onerror = () => {
        logger.error('Fehler beim Laden der Story', {
          component: 'IndexedDB',
          data: request.error
        })
        reject(request.error)
      }

      transaction.oncomplete = () => {
        db.close()
      }
    })
  } catch (error) {
    logger.error('Fehler beim Laden der Story', {
      component: 'IndexedDB',
      data: error
    })
    return null
  }
}

/**
 * Lädt alle Stories aus IndexedDB
 */
export async function getAllStories(): Promise<IDBComicStory[]> {
  try {
    const db = await openDatabase()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORY_STORE_NAME], 'readonly')
      const store = transaction.objectStore(STORY_STORE_NAME)
      const request = store.getAll()

      request.onsuccess = () => {
        const stories = request.result || []
        logger.info(`${stories.length} Story/Stories aus IndexedDB geladen`, {
          component: 'IndexedDB',
          data: { count: stories.length }
        })
        resolve(stories)
      }

      request.onerror = () => {
        logger.error('Fehler beim Laden aller Stories', {
          component: 'IndexedDB',
          data: request.error
        })
        reject(request.error)
      }

      transaction.oncomplete = () => {
        db.close()
      }
    })
  } catch (error) {
    logger.error('Fehler beim Laden aller Stories', {
      component: 'IndexedDB',
      data: error
    })
    return []
  }
}

/**
 * Löscht eine Story aus IndexedDB
 */
export async function deleteStory(storyId: string): Promise<void> {
  try {
    const db = await openDatabase()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORY_STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORY_STORE_NAME)
      const request = store.delete(storyId)

      request.onsuccess = () => {
        logger.info('Story aus IndexedDB gelöscht', {
          component: 'IndexedDB',
          data: { storyId }
        })
        resolve()
      }

      request.onerror = () => {
        logger.error('Fehler beim Löschen der Story', {
          component: 'IndexedDB',
          data: request.error
        })
        reject(request.error)
      }

      transaction.oncomplete = () => {
        db.close()
      }
    })
  } catch (error) {
    logger.error('Fehler beim Löschen der Story', {
      component: 'IndexedDB',
      data: error
    })
    throw error
  }
}

/**
 * Löscht mehrere Stories auf einmal
 */
export async function deleteMultipleStories(storyIds: string[]): Promise<void> {
  try {
    const db = await openDatabase()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORY_STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORY_STORE_NAME)

      let deletedCount = 0
      let errorOccurred = false

      for (const storyId of storyIds) {
        const request = store.delete(storyId)

        request.onsuccess = () => {
          deletedCount++
        }

        request.onerror = () => {
          errorOccurred = true
          logger.error('Fehler beim Löschen einer Story', {
            component: 'IndexedDB',
            data: { storyId, error: request.error }
          })
        }
      }

      transaction.oncomplete = () => {
        logger.info('Mehrere Stories gelöscht', {
          component: 'IndexedDB',
          data: { requested: storyIds.length, deleted: deletedCount }
        })
        db.close()

        if (errorOccurred) {
          reject(new Error('Einige Stories konnten nicht gelöscht werden'))
        } else {
          resolve()
        }
      }

      transaction.onerror = () => {
        logger.error('Transaction-Fehler beim Löschen mehrerer Stories', {
          component: 'IndexedDB',
          data: transaction.error
        })
        reject(transaction.error)
      }
    })
  } catch (error) {
    logger.error('Fehler beim Löschen mehrerer Stories', {
      component: 'IndexedDB',
      data: error
    })
    throw error
  }
}

/**
 * Löscht alle Stories aus IndexedDB
 */
export async function clearAllStories(): Promise<void> {
  try {
    const db = await openDatabase()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORY_STORE_NAME], 'readwrite')
      const store = transaction.objectStore(STORY_STORE_NAME)
      const request = store.clear()

      request.onsuccess = () => {
        logger.info('Alle Stories aus IndexedDB gelöscht', {
          component: 'IndexedDB'
        })
        resolve()
      }

      request.onerror = () => {
        logger.error('Fehler beim Löschen aller Stories', {
          component: 'IndexedDB',
          data: request.error
        })
        reject(request.error)
      }

      transaction.oncomplete = () => {
        db.close()
      }
    })
  } catch (error) {
    logger.error('Fehler beim Löschen aller Stories', {
      component: 'IndexedDB',
      data: error
    })
    throw error
  }
}

/**
 * Berechnet die Gesamtgröße aller gespeicherten Stories (ungefähr)
 */
export async function getStorageSize(): Promise<number> {
  try {
    const stories = await getAllStories()

    // Ungefähre Berechnung basierend auf JSON-String-Länge
    const totalSize = stories.reduce((sum, story) => {
      return sum + JSON.stringify(story).length
    }, 0)

    logger.info('Storage-Größe berechnet', {
      component: 'IndexedDB',
      data: {
        sizeBytes: totalSize,
        sizeMB: (totalSize / 1024 / 1024).toFixed(2),
        storyCount: stories.length
      }
    })

    return totalSize
  } catch (error) {
    logger.error('Fehler beim Berechnen der Storage-Größe', {
      component: 'IndexedDB',
      data: error
    })
    return 0
  }
}

/**
 * Sucht Stories nach Status
 */
export async function getStoriesByStatus(status: 'draft' | 'completed' | 'published'): Promise<IDBComicStory[]> {
  try {
    const db = await openDatabase()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORY_STORE_NAME], 'readonly')
      const store = transaction.objectStore(STORY_STORE_NAME)
      const index = store.index('status')
      const request = index.getAll(status)

      request.onsuccess = () => {
        resolve(request.result || [])
      }

      request.onerror = () => {
        logger.error('Fehler beim Laden der Stories nach Status', {
          component: 'IndexedDB',
          data: request.error
        })
        reject(request.error)
      }

      transaction.oncomplete = () => {
        db.close()
      }
    })
  } catch (error) {
    logger.error('Fehler beim Laden der Stories nach Status', {
      component: 'IndexedDB',
      data: error
    })
    return []
  }
}
