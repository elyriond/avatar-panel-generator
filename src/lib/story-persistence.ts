/**
 * Comic Story Persistence
 * Speichert komplette Comic-Stories mit allen Panels
 * Verwendet IndexedDB für größere Datenmengen (statt LocalStorage)
 */

import { logger } from './logger'
import * as IDB from './indexed-db'

export interface StoryPanel {
  id: string
  panelNumber: number                 // 1, 2, 3, etc.
  panelText: string                   // Der Text im Panel
  sceneDescription?: string           // Für Regenerierung: Die ursprüngliche Scene-Beschreibung
  avatarBase64: string                // Generierter Avatar
  imagePrompt: string                 // Der verwendete Imagen-Prompt
  backgroundColor: string             // Hintergrundfarbe
  generatedAt: Date
}

export interface ComicStory {
  id: string
  title: string                       // Auto-generiert oder User-definiert
  description?: string                // Optional: Kurzbeschreibung
  createdAt: Date
  lastModifiedAt: Date

  // Die Panels (sortiert nach panelNumber)
  panels: StoryPanel[]

  // Metadaten
  characterProfileId?: string         // Welches Character Profile wurde verwendet
  chatSessionId?: string              // Aus welcher Chat-Session entstand die Story
  tags: string[]                      // z.B. ["Hochsensibilität", "Grenzen"]

  // Storyboard (für Regenerierung und Referenz)
  originalStoryboard?: Array<{ text: string; scene: string }>  // Das ursprüngliche Storyboard-JSON

  // Status
  status: 'draft' | 'completed' | 'published'

  // Instagram-specific
  instagramPosted?: boolean
  instagramPostDate?: Date
  instagramCaption?: string           // Auto-generierte Caption für Instagram
  instagramHashtags?: string          // Auto-generierte Hashtags für Instagram
}

/**
 * Konvertiert ComicStory (mit Date-Objekten) zu IDBComicStory (mit Strings)
 */
function toIDBStory(story: ComicStory): IDB.IDBComicStory {
  return {
    ...story,
    createdAt: story.createdAt.toISOString(),
    lastModifiedAt: story.lastModifiedAt.toISOString(),
    instagramPostDate: story.instagramPostDate?.toISOString(),
    panels: story.panels.map(p => ({
      ...p,
      generatedAt: p.generatedAt.toISOString()
    }))
  }
}

/**
 * Konvertiert IDBComicStory (mit Strings) zu ComicStory (mit Date-Objekten)
 */
function fromIDBStory(idbStory: IDB.IDBComicStory): ComicStory {
  return {
    ...idbStory,
    createdAt: new Date(idbStory.createdAt),
    lastModifiedAt: new Date(idbStory.lastModifiedAt),
    instagramPostDate: idbStory.instagramPostDate ? new Date(idbStory.instagramPostDate) : undefined,
    panels: idbStory.panels.map(p => ({
      ...p,
      generatedAt: new Date(p.generatedAt)
    }))
  }
}

/**
 * Lädt alle gespeicherten Stories
 */
export async function getAllStories(): Promise<ComicStory[]> {
  try {
    const idbStories = await IDB.getAllStories()

    // Nach lastModifiedAt sortieren (neueste zuerst)
    const stories = idbStories
      .map(fromIDBStory)
      .sort((a, b) => b.lastModifiedAt.getTime() - a.lastModifiedAt.getTime())

    return stories
  } catch (error) {
    logger.error('Fehler beim Laden der Stories', {
      component: 'StoryPersistence',
      data: error
    })
    return []
  }
}

/**
 * Erstellt eine neue Story
 */
export async function createStory(
  panels: Omit<StoryPanel, 'id' | 'generatedAt'>[],
  options?: {
    title?: string
    description?: string
    characterProfileId?: string
    chatSessionId?: string
    tags?: string[]
    originalStoryboard?: Array<{ text: string; scene: string }>
    instagramCaption?: string
    instagramHashtags?: string
  }
): Promise<ComicStory> {
  const now = new Date()

  const story: ComicStory = {
    id: crypto.randomUUID(),
    title: options?.title || generateStoryTitle(panels),
    description: options?.description,
    createdAt: now,
    lastModifiedAt: now,
    panels: panels.map((p, index) => ({
      ...p,
      id: crypto.randomUUID(),
      panelNumber: p.panelNumber || index + 1,
      generatedAt: now
    })),
    characterProfileId: options?.characterProfileId,
    chatSessionId: options?.chatSessionId,
    tags: options?.tags || [],
    originalStoryboard: options?.originalStoryboard,  // Speichere das ursprüngliche Storyboard
    instagramCaption: options?.instagramCaption,      // Speichere Instagram Caption
    instagramHashtags: options?.instagramHashtags,    // Speichere Instagram Hashtags
    status: 'completed',
    instagramPosted: false
  }

  logger.info('Neue Story erstellt', {
    component: 'StoryPersistence',
    data: {
      storyId: story.id,
      title: story.title,
      panelCount: story.panels.length
    }
  })

  // In IndexedDB speichern
  await IDB.saveStory(toIDBStory(story))

  return story
}

/**
 * Aktualisiert eine bestehende Story
 */
export async function updateStory(story: ComicStory): Promise<void> {
  story.lastModifiedAt = new Date()

  await IDB.saveStory(toIDBStory(story))

  logger.info('Story aktualisiert', {
    component: 'StoryPersistence',
    data: { storyId: story.id, title: story.title }
  })
}

/**
 * Lädt eine spezifische Story
 */
export async function getStory(storyId: string): Promise<ComicStory | null> {
  const idbStory = await IDB.getStory(storyId)
  return idbStory ? fromIDBStory(idbStory) : null
}

/**
 * Löscht eine Story
 */
export async function deleteStory(storyId: string): Promise<void> {
  await IDB.deleteStory(storyId)

  logger.info('Story gelöscht', {
    component: 'StoryPersistence',
    data: { storyId }
  })
}

/**
 * Löscht mehrere Stories auf einmal
 */
export async function deleteMultipleStories(storyIds: string[]): Promise<void> {
  await IDB.deleteMultipleStories(storyIds)

  logger.info('Mehrere Stories gelöscht', {
    component: 'StoryPersistence',
    data: { count: storyIds.length }
  })
}

/**
 * Löscht alle Stories
 */
export async function clearAllStories(): Promise<void> {
  await IDB.clearAllStories()

  logger.info('Alle Stories gelöscht', {
    component: 'StoryPersistence'
  })
}

/**
 * Markiert Story als published/auf Instagram gepostet
 */
export async function markStoryAsPublished(storyId: string): Promise<void> {
  const story = await getStory(storyId)
  if (!story) return

  story.status = 'published'
  story.instagramPosted = true
  story.instagramPostDate = new Date()

  await updateStory(story)
}

/**
 * Sucht Stories nach Titel, Tags oder Beschreibung
 */
export async function searchStories(query: string): Promise<ComicStory[]> {
  const lowerQuery = query.toLowerCase()
  const allStories = await getAllStories()

  return allStories
    .filter(story => {
      // Suche in Titel
      if (story.title.toLowerCase().includes(lowerQuery)) return true

      // Suche in Beschreibung
      if (story.description?.toLowerCase().includes(lowerQuery)) return true

      // Suche in Tags
      if (story.tags.some(tag => tag.toLowerCase().includes(lowerQuery))) return true

      // Suche in Panel-Texten
      return story.panels.some(p => p.panelText.toLowerCase().includes(lowerQuery))
    })
    .sort((a, b) => b.lastModifiedAt.getTime() - a.lastModifiedAt.getTime())
}

/**
 * Holt Stories nach Status
 */
export async function getStoriesByStatus(status: ComicStory['status']): Promise<ComicStory[]> {
  const idbStories = await IDB.getStoriesByStatus(status)
  return idbStories
    .map(fromIDBStory)
    .sort((a, b) => b.lastModifiedAt.getTime() - a.lastModifiedAt.getTime())
}

/**
 * Holt Stories einer bestimmten Chat-Session
 */
export async function getStoriesByChatSession(chatSessionId: string): Promise<ComicStory[]> {
  const allStories = await getAllStories()
  return allStories
    .filter(s => s.chatSessionId === chatSessionId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
}

/**
 * Generiert automatisch einen Story-Titel basierend auf Panel-Inhalten
 */
function generateStoryTitle(panels: Omit<StoryPanel, 'id' | 'generatedAt'>[]): string {
  if (panels.length === 0) return 'Neue Story'

  // Nimm die ersten 50 Zeichen des ersten Panels
  const firstPanelText = panels[0].panelText.slice(0, 50)

  // Extrahiere Schlüsselwörter (Großbuchstaben-Wörter)
  const keywords = firstPanelText.match(/[A-ZÄÖÜ][a-zäöüß]+/g)

  if (keywords && keywords.length > 0) {
    return keywords.slice(0, 3).join(' • ')
  }

  // Fallback: Erste 50 Zeichen
  return firstPanelText.trim() + (firstPanelText.length > 50 ? '...' : '')
}

/**
 * Exportiert Story-Statistiken
 */
export async function getStoryStats() {
  const stories = await getAllStories()

  return {
    total: stories.length,
    completed: stories.filter(s => s.status === 'completed').length,
    published: stories.filter(s => s.status === 'published').length,
    draft: stories.filter(s => s.status === 'draft').length,
    totalPanels: stories.reduce((sum, s) => sum + s.panels.length, 0),
    averagePanelsPerStory: stories.length > 0
      ? Math.round(stories.reduce((sum, s) => sum + s.panels.length, 0) / stories.length)
      : 0
  }
}

/**
 * Berechnet die ungefähre Speichergröße
 */
export async function getStorageSize(): Promise<{ bytes: number; mb: string }> {
  const bytes = await IDB.getStorageSize()
  return {
    bytes,
    mb: (bytes / 1024 / 1024).toFixed(2)
  }
}

/**
 * Löscht alte Stories (älteste zuerst) bis nur noch maxStories übrig sind
 */
export async function cleanupOldStories(maxStories: number = 50): Promise<number> {
  const stories = await getAllStories()

  if (stories.length <= maxStories) {
    return 0
  }

  // Sortiere nach Änderungsdatum (älteste zuerst)
  const sortedByAge = stories.sort((a, b) => a.lastModifiedAt.getTime() - b.lastModifiedAt.getTime())

  // Lösche die ältesten Stories
  const toDelete = sortedByAge.slice(0, stories.length - maxStories)
  const idsToDelete = toDelete.map(s => s.id)

  await deleteMultipleStories(idsToDelete)

  logger.info('Alte Stories aufgeräumt', {
    component: 'StoryPersistence',
    data: {
      before: stories.length,
      after: maxStories,
      removed: toDelete.length
    }
  })

  return toDelete.length
}
