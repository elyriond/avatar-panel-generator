/**
 * Chat Session Management & Persistence
 * Speichert Chat-Verläufe und ermöglicht Fortsetzen/Archivieren
 */

import type { ChatMessage } from './chat-helper'
import type { ComicStory } from './character-profile'
import { logger } from './logger'

export type ChatStatus = 'active' | 'archived' | 'published'

export interface ChatSession {
  id: string
  title: string                    // Auto-generiert aus ersten Nachrichten
  startedAt: Date
  lastActiveAt: Date
  messages: ChatMessage[]
  status: ChatStatus
  generatedStory?: string          // ID der generierten Comic-Story
  tags: string[]                   // z.B. ["Hochsensibilität", "Beziehungen"]
}

const STORAGE_KEY_SESSIONS = 'chat-sessions'
const STORAGE_KEY_ACTIVE = 'active-chat-session-id'
const MAX_SESSIONS = 20  // Maximal 20 Sessions behalten

/**
 * Lädt alle Chat-Sessions
 */
export function getAllChatSessions(): ChatSession[] {
  try {
    logger.storageOperation('load', STORAGE_KEY_SESSIONS)
    const stored = localStorage.getItem(STORAGE_KEY_SESSIONS)
    if (!stored) {
      logger.debug('Keine gespeicherten Sessions gefunden', { component: 'ChatPersistence' })
      return []
    }

    const sessions = JSON.parse(stored)
    logger.info(`${sessions.length} Session(s) geladen`, {
      component: 'ChatPersistence',
      data: { count: sessions.length }
    })

    // Dates wiederherstellen (auch in Messages!)
    return sessions.map((s: any) => ({
      ...s,
      startedAt: s.startedAt ? new Date(s.startedAt) : new Date(),
      lastActiveAt: s.lastActiveAt ? new Date(s.lastActiveAt) : new Date(),
      messages: Array.isArray(s.messages) ? s.messages.map((m: any) => ({
        ...m,
        timestamp: m.timestamp ? new Date(m.timestamp) : new Date()
      })) : []
    }))
  } catch (error) {
    logger.error('Fehler beim Laden der Chat-Sessions', {
      component: 'ChatPersistence',
      data: error
    })
    return []
  }
}

/**
 * Speichert alle Chat-Sessions
 */
function saveChatSessions(sessions: ChatSession[]): void {
  try {
    // Nur die neuesten MAX_SESSIONS behalten
    const sorted = sessions
      .sort((a, b) => b.lastActiveAt.getTime() - a.lastActiveAt.getTime())
      .slice(0, MAX_SESSIONS)

    logger.storageOperation('save', STORAGE_KEY_SESSIONS, {
      count: sorted.length,
      limitReached: sessions.length > MAX_SESSIONS
    })

    localStorage.setItem(STORAGE_KEY_SESSIONS, JSON.stringify(sorted))
  } catch (error) {
    logger.error('Fehler beim Speichern der Chat-Sessions', {
      component: 'ChatPersistence',
      data: error
    })
    throw new Error('Chat-Sessions konnten nicht gespeichert werden')
  }
}

/**
 * Erstellt eine neue Chat-Session
 */
export function createChatSession(): ChatSession {
  const session: ChatSession = {
    id: crypto.randomUUID(),
    title: 'Neuer Chat',  // Wird später auto-generiert
    startedAt: new Date(),
    lastActiveAt: new Date(),
    messages: [],
    status: 'active',
    tags: []
  }

  logger.info('Neue Chat-Session erstellt', {
    component: 'ChatPersistence',
    data: { sessionId: session.id, title: session.title }
  })

  const sessions = getAllChatSessions()
  sessions.push(session)
  saveChatSessions(sessions)
  setActiveChatSessionId(session.id)

  return session
}

/**
 * Aktualisiert eine Chat-Session
 */
export function updateChatSession(session: ChatSession): void {
  session.lastActiveAt = new Date()

  const sessions = getAllChatSessions()
  const index = sessions.findIndex(s => s.id === session.id)

  if (index !== -1) {
    sessions[index] = session
  } else {
    sessions.push(session)
  }

  saveChatSessions(sessions)
}

/**
 * Fügt eine Nachricht zu einer Session hinzu
 */
export function addMessageToSession(
  sessionId: string,
  message: ChatMessage
): ChatSession | null {
  const sessions = getAllChatSessions()
  const session = sessions.find(s => s.id === sessionId)

  if (!session) {
    logger.warn('Session nicht gefunden', {
      component: 'ChatPersistence',
      data: { sessionId }
    })
    return null
  }

  session.messages.push(message)
  session.lastActiveAt = new Date()

  logger.debug(`Nachricht hinzugefügt (${message.role})`, {
    component: 'ChatPersistence',
    data: {
      sessionId,
      messageCount: session.messages.length,
      contentLength: message.content.length
    }
  })

  // Auto-generiere Titel nach 2-3 Nachrichten
  if (session.title === 'Neuer Chat' && session.messages.length >= 3) {
    const oldTitle = session.title
    session.title = generateChatTitle(session)
    logger.info('Auto-Titel generiert', {
      component: 'ChatPersistence',
      data: { oldTitle, newTitle: session.title }
    })
  }

  // Auto-generiere Tags
  const oldTags = session.tags
  session.tags = extractTags(session)
  if (session.tags.length !== oldTags.length) {
    logger.debug('Tags aktualisiert', {
      component: 'ChatPersistence',
      data: { tags: session.tags }
    })
  }

  updateChatSession(session)
  return session
}

/**
 * Lädt eine spezifische Chat-Session
 */
export function getChatSession(sessionId: string): ChatSession | null {
  const sessions = getAllChatSessions()
  return sessions.find(s => s.id === sessionId) || null
}

/**
 * Löscht eine Chat-Session
 */
export function deleteChatSession(sessionId: string): void {
  const sessions = getAllChatSessions()
  const filtered = sessions.filter(s => s.id !== sessionId)
  saveChatSessions(filtered)

  // Wenn das die aktive Session war, zurücksetzen
  if (getActiveChatSessionId() === sessionId) {
    localStorage.removeItem(STORAGE_KEY_ACTIVE)
  }
}

/**
 * Archiviert eine Chat-Session
 */
export function archiveChatSession(sessionId: string): void {
  const session = getChatSession(sessionId)
  if (!session) {
    logger.warn('Session zum Archivieren nicht gefunden', {
      component: 'ChatPersistence',
      data: { sessionId }
    })
    return
  }

  session.status = 'archived'
  logger.info('Session archiviert', {
    component: 'ChatPersistence',
    data: { sessionId, title: session.title }
  })
  updateChatSession(session)
}

/**
 * Markiert eine Session als "published"
 */
export function markSessionAsPublished(
  sessionId: string,
  storyId: string
): void {
  const session = getChatSession(sessionId)
  if (!session) return

  session.status = 'published'
  session.generatedStory = storyId
  updateChatSession(session)
}

/**
 * Speichert die ID der aktiven Chat-Session
 */
export function setActiveChatSessionId(sessionId: string): void {
  localStorage.setItem(STORAGE_KEY_ACTIVE, sessionId)
}

/**
 * Lädt die ID der aktiven Chat-Session
 */
export function getActiveChatSessionId(): string | null {
  return localStorage.getItem(STORAGE_KEY_ACTIVE)
}

/**
 * Lädt die aktive Chat-Session oder erstellt eine neue
 */
export function getOrCreateActiveChatSession(): ChatSession {
  const activeId = getActiveChatSessionId()

  if (activeId) {
    const session = getChatSession(activeId)
    if (session && session.status === 'active') {
      return session
    }
  }

  // Keine aktive Session → Neue erstellen
  return createChatSession()
}

/**
 * Lädt alle aktiven (nicht archivierten) Sessions
 */
export function getActiveSessions(): ChatSession[] {
  return getAllChatSessions()
    .filter(s => s.status === 'active')
    .sort((a, b) => b.lastActiveAt.getTime() - a.lastActiveAt.getTime())
}

/**
 * Lädt alle archivierten Sessions
 */
export function getArchivedSessions(): ChatSession[] {
  return getAllChatSessions()
    .filter(s => s.status === 'archived')
    .sort((a, b) => b.lastActiveAt.getTime() - a.lastActiveAt.getTime())
}

/**
 * Generiert einen Titel basierend auf Chat-Inhalt
 */
function generateChatTitle(session: ChatSession): string {
  // Nimm die ersten 2-3 User-Nachrichten
  const userMessages = session.messages
    .filter(m => m.role === 'user')
    .slice(0, 3)

  if (userMessages.length === 0) return 'Neuer Chat'

  // Kombiniere zu einem Kurz-Titel (max 50 Zeichen)
  const combined = userMessages
    .map(m => m.content)
    .join(' ')
    .slice(0, 50)

  // Erste Großbuchstaben-Wörter extrahieren (oft Themen)
  const keywords = combined.match(/[A-ZÄÖÜ][a-zäöüß]+/g)

  if (keywords && keywords.length > 0) {
    return keywords.slice(0, 3).join(' • ')
  }

  // Fallback: Erste 50 Zeichen
  return combined.trim() + (combined.length > 50 ? '...' : '')
}

/**
 * Extrahiert thematische Tags aus dem Chat
 */
function extractTags(session: ChatSession): string[] {
  const allText = session.messages
    .map(m => m.content)
    .join(' ')
    .toLowerCase()

  const commonThemes = [
    'hochsensibilität',
    'beziehungen',
    'nervensystem',
    'selbstfürsorge',
    'grenzen',
    'emotionen',
    'achtsamkeit',
    'trauma',
    'therapie',
    'stress',
    'angst'
  ]

  return commonThemes.filter(theme => allText.includes(theme))
}

/**
 * Bereinigt alte Sessions (über MAX_SESSIONS hinaus)
 */
export function cleanupOldSessions(): void {
  const sessions = getAllChatSessions()

  // Behalte nur die neuesten MAX_SESSIONS
  const sorted = sessions
    .sort((a, b) => b.lastActiveAt.getTime() - a.lastActiveAt.getTime())
    .slice(0, MAX_SESSIONS)

  saveChatSessions(sorted)
}

/**
 * Sucht in allen Sessions nach Text
 */
export function searchChatSessions(query: string): ChatSession[] {
  const lowerQuery = query.toLowerCase()

  return getAllChatSessions()
    .filter(session => {
      // Suche in Titel
      if (session.title.toLowerCase().includes(lowerQuery)) return true

      // Suche in Tags
      if (session.tags.some(tag => tag.includes(lowerQuery))) return true

      // Suche in Nachrichten
      return session.messages.some(m =>
        m.content.toLowerCase().includes(lowerQuery)
      )
    })
    .sort((a, b) => b.lastActiveAt.getTime() - a.lastActiveAt.getTime())
}
