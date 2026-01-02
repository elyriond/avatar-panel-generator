import type { Avatar } from '@/types'

const STORAGE_KEY = 'avatar-panel-generator-avatars'

export function getAvatars(): Avatar[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch (error) {
    console.error('Fehler beim Laden der Avatare:', error)
    return []
  }
}

export function saveAvatars(avatars: Avatar[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(avatars))
  } catch (error) {
    console.error('Fehler beim Speichern der Avatare:', error)
    throw new Error('Konnte Avatare nicht speichern')
  }
}

export function addAvatar(avatar: Avatar): void {
  const avatars = getAvatars()
  avatars.push(avatar)
  saveAvatars(avatars)
}

export function deleteAvatar(id: string): void {
  const avatars = getAvatars()
  const filtered = avatars.filter(a => a.id !== id)
  saveAvatars(filtered)
}

export function updateAvatar(id: string, updates: Partial<Avatar>): void {
  const avatars = getAvatars()
  const index = avatars.findIndex(a => a.id === id)
  if (index !== -1) {
    avatars[index] = { ...avatars[index], ...updates }
    saveAvatars(avatars)
  }
}

export function getAvatarByEmotion(emotion: string): Avatar | null {
  const avatars = getAvatars()
  return avatars.find(a => a.emotion.toLowerCase() === emotion.toLowerCase()) || null
}

export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      resolve(result)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function validateImageFile(file: File): { valid: boolean; error?: string } {
  // Prüfe Dateityp
  const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']
  if (!validTypes.includes(file.type)) {
    return {
      valid: false,
      error: 'Bitte lade nur Bilddateien hoch (PNG, JPG, WEBP, GIF)'
    }
  }

  // Prüfe Dateigröße (max 5MB)
  const maxSize = 5 * 1024 * 1024 // 5MB in bytes
  if (file.size > maxSize) {
    return {
      valid: false,
      error: 'Die Datei ist zu groß. Maximum: 5MB'
    }
  }

  return { valid: true }
}
