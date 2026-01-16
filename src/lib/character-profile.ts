/**
 * Character Profile Management
 * Speichert Character-Referenzen, Stil-Präferenzen und Brand Voice
 */

import { logger } from './logger'
import type { KieAiModel } from './kie-ai-image'

export interface ReferenceImages {
  frontal?: string          // Base64 oder URL
  profileLeft?: string
  profileRight?: string
  threeQuarter?: string
  fullBody?: string
}

export interface StylePreferences {
  visualStyle: string       // z.B. "minimalistisch, comic-realistisch, warm"
  colorPalette: string[]    // Bevorzugte Farben
  atmosphere: string        // z.B. "therapeutisch, beruhigend"
}

export interface BrandVoice {
  writingStyle: string      // z.B. "warm, professionell, nahbar"
  coreThemes: string[]      // z.B. ["Hochsensibilität", "Beziehungen", "Nervensystem"]
  targetAudience: string    // z.B. "Hochsensible Menschen, Therapie-Interessierte"
  examplePosts?: string[]   // Beispiele erfolgreicher Posts
}

export interface CharacterProfile {
  id: string
  name: string
  createdAt: Date
  lastUpdatedAt: Date

  // Visuelle Referenzen
  referenceImages: ReferenceImages
  autoDescription?: string  // Von KI generierte Beschreibung basierend auf Bildern

  // Optional: Alle Referenzbilder (für Auto-Profile mit mehr als 5 Bildern)
  allReferenceImages?: string[]

  // Optional: Pfade zu Referenzbildern (werden bei Bedarf geladen, um LocalStorage zu schonen)
  referenceImagePaths?: string[]

  // Physische Beschreibung für Image-Prompts
  physicalDescription?: string  // Detaillierte Beschreibung: Alter, Haare, Brille, Kleidung, etc.

  // AI-Modell für Bildgenerierung (TEST-Feature)
  aiModel?: KieAiModel  // Default: 'nano-banana-pro' (Imagen 4)

  // Stil & Brand
  stylePreferences: StylePreferences
  brandVoice: BrandVoice

  // Beispiel-Panels als Stil-Referenz
  styleReferencePanels: string[]  // Base64 von erfolgreichen Panels
}

const STORAGE_KEY = 'character-profile'

/**
 * Lädt das Character Profile aus LocalStorage
 */
export function getCharacterProfile(): CharacterProfile | null {
  try {
    logger.storageOperation('load', STORAGE_KEY)
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) {
      logger.debug('Kein Character Profile gefunden', { component: 'CharacterProfile' })
      return null
    }

    const profile = JSON.parse(stored)
    // Dates wiederherstellen
    profile.createdAt = new Date(profile.createdAt)
    profile.lastUpdatedAt = new Date(profile.lastUpdatedAt)

    logger.info('Character Profile geladen', {
      component: 'CharacterProfile',
      data: {
        name: profile.name,
        imageCount: getReferenceImageCount(profile),
        isComplete: isProfileComplete(profile)
      }
    })

    return profile
  } catch (error) {
    logger.error('Fehler beim Laden des Character Profiles', {
      component: 'CharacterProfile',
      data: error
    })
    return null
  }
}

/**
 * Speichert das Character Profile
 */
export function saveCharacterProfile(profile: CharacterProfile): void {
  try {
    profile.lastUpdatedAt = new Date()

    logger.storageOperation('save', STORAGE_KEY, {
      name: profile.name,
      imageCount: getReferenceImageCount(profile),
      isComplete: isProfileComplete(profile)
    })

    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile))
  } catch (error) {
    logger.error('Fehler beim Speichern des Character Profiles', {
      component: 'CharacterProfile',
      data: error
    })
    throw new Error('Character Profile konnte nicht gespeichert werden')
  }
}

/**
 * Erstellt ein neues Character Profile
 */
export function createCharacterProfile(name: string): CharacterProfile {
  return {
    id: crypto.randomUUID(),
    name,
    createdAt: new Date(),
    lastUpdatedAt: new Date(),
    referenceImages: {},
    stylePreferences: {
      visualStyle: '',
      colorPalette: [],
      atmosphere: ''
    },
    brandVoice: {
      writingStyle: '',
      coreThemes: [],
      targetAudience: ''
    },
    styleReferencePanels: []
  }
}

/**
 * Aktualisiert Referenzbilder
 */
export function updateReferenceImages(
  profile: CharacterProfile,
  images: Partial<ReferenceImages>
): CharacterProfile {
  return {
    ...profile,
    referenceImages: {
      ...profile.referenceImages,
      ...images
    }
  }
}

/**
 * Aktualisiert Stil-Präferenzen
 */
export function updateStylePreferences(
  profile: CharacterProfile,
  preferences: Partial<StylePreferences>
): CharacterProfile {
  return {
    ...profile,
    stylePreferences: {
      ...profile.stylePreferences,
      ...preferences
    }
  }
}

/**
 * Aktualisiert Brand Voice
 */
export function updateBrandVoice(
  profile: CharacterProfile,
  voice: Partial<BrandVoice>
): CharacterProfile {
  return {
    ...profile,
    brandVoice: {
      ...profile.brandVoice,
      ...voice,
      coreThemes: voice.coreThemes || profile.brandVoice.coreThemes,
      examplePosts: voice.examplePosts || profile.brandVoice.examplePosts
    }
  }
}

/**
 * Fügt ein Stil-Referenz-Panel hinzu
 */
export function addStyleReferencePanel(
  profile: CharacterProfile,
  panelImage: string
): CharacterProfile {
  return {
    ...profile,
    styleReferencePanels: [...profile.styleReferencePanels, panelImage]
  }
}

/**
 * Zählt, wie viele Referenzbilder hochgeladen wurden
 */
export function getReferenceImageCount(profile: CharacterProfile): number {
  const images = profile.referenceImages
  let count = 0
  if (images.frontal) count++
  if (images.profileLeft) count++
  if (images.profileRight) count++
  if (images.threeQuarter) count++
  if (images.fullBody) count++
  return count
}

/**
 * Prüft, ob das Profil komplett ist (bereit für Comic-Generierung)
 */
export function isProfileComplete(profile: CharacterProfile): boolean {
  const hasImages = getReferenceImageCount(profile) >= 3  // Mindestens 3 Bilder
  const hasStyle = profile.stylePreferences.visualStyle.length > 0
  const hasBrandVoice = profile.brandVoice.writingStyle.length > 0
    && profile.brandVoice.coreThemes.length > 0

  return hasImages && hasStyle && hasBrandVoice
}

/**
 * Generiert einen System-Prompt der das Character Profile enthält
 */
export function generateSystemPromptWithProfile(profile: CharacterProfile): string {
  const imageCount = getReferenceImageCount(profile)

  return `Du bist eine einfühlsame Beraterin, die ${profile.name} bei der Entwicklung von Instagram-Comic-Ideen unterstützt.

CHARACTER INFORMATIONEN:
- Name: ${profile.name}
- Verfügbare Referenzbilder: ${imageCount}
- Visual Style: ${profile.stylePreferences.visualStyle || 'Noch nicht definiert'}
- Atmosphäre: ${profile.stylePreferences.atmosphere || 'Noch nicht definiert'}

BRAND VOICE:
- Schreibstil: ${profile.brandVoice.writingStyle || 'Noch nicht definiert'}
- Kernthemen: ${profile.brandVoice.coreThemes.join(', ') || 'Noch nicht definiert'}
- Zielgruppe: ${profile.brandVoice.targetAudience || 'Noch nicht definiert'}

${profile.styleReferencePanels.length > 0 ? `STIL-REFERENZEN:
[${profile.styleReferencePanels.length} erfolgreiche Panel(s) als Referenz verfügbar]` : ''}

${profile.brandVoice.examplePosts && profile.brandVoice.examplePosts.length > 0 ? `
ERFOLGREICHE POSTS (als Referenz):
${profile.brandVoice.examplePosts.map((post, i) => `${i + 1}. ${post.slice(0, 100)}...`).join('\n')}` : ''}

DEINE AUFGABE:
Unterstütze bei der Entwicklung von Instagram-Comic-Ideen.

WICHTIG - Dein Verhalten:
- Stelle ZUERST Fragen: "Worüber möchtest du heute eine Story entwickeln?"
- Höre zu und entwickle die Idee gemeinsam im Gespräch
- Generiere KEINE fertigen Story-Ideen ungefragt
- Warte auf Input, bevor du Vorschläge machst

WIE DU HELFEN KANNST:
1. Frage nach dem Thema oder der Botschaft
2. Stelle vertiefende Fragen zur Konkretisierung
3. Schlage Story-Strukturen vor (5-10 Panels)
4. Entwickle gemeinsam Panel-Texte (150-200 Zeichen)
5. Beschreibe, wie ${profile.name} in den Szenen aussehen könnte

KOMMUNIKATIONSSTIL:
- ${profile.brandVoice.writingStyle}
- Warm, einfühlsam, nahbar
- Stelle Fragen statt direkt Lösungen zu präsentieren
- Entwickle Ideen im Dialog

Antworte immer auf Deutsch.
`
}
