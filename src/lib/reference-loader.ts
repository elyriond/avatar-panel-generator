/**
 * Lädt Referenzbilder automatisch aus dem public-Ordner
 */

import { logger } from './logger'

const REFERENCE_IMAGE_FILES = [
  'ref-1.jpg', // Frontal Face (High Detail)
  'ref-2.jpg', // 3/4 View
  'ref-5.jpg'  // Full Body Profile
]

/**
 * Konvertiert eine Bild-URL zu Base64
 */
async function urlToBase64(url: string): Promise<string> {
  try {
    const response = await fetch(url)
    const blob = await response.blob()

    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch (error) {
    logger.error('Fehler beim Laden des Referenzbildes', {
      component: 'ReferenceLoader',
      data: { url, error }
    })
    throw error
  }
}

/**
 * Lädt alle Referenzbilder aus dem public-Ordner und konvertiert sie zu Base64
 * @returns Array von Base64-kodierten Bildern
 */
export async function loadReferenceImages(): Promise<string[]> {
  logger.info('Lade Referenzbilder aus public-Ordner', {
    component: 'ReferenceLoader',
    data: { count: REFERENCE_IMAGE_FILES.length }
  })

  try {
    const imagePromises = REFERENCE_IMAGE_FILES.map(filename => {
      const url = `/reference-images/${filename}`
      return urlToBase64(url)
    })

    const images = await Promise.all(imagePromises)

    logger.info('Referenzbilder erfolgreich geladen', {
      component: 'ReferenceLoader',
      data: { count: images.length }
    })

    return images
  } catch (error) {
    logger.error('Fehler beim Laden der Referenzbilder', {
      component: 'ReferenceLoader',
      data: error
    })
    throw new Error('Referenzbilder konnten nicht geladen werden')
  }
}

/**
 * Erstellt ein minimales Character Profile mit Pfaden zu Referenzbildern
 * (lädt Bilder NICHT, um LocalStorage nicht zu überlasten)
 */
export function createAutoCharacterProfile() {
  return {
    id: 'auto-profile',
    name: 'Theresa', // TODO: Anpassen
    createdAt: new Date(),
    lastUpdatedAt: new Date(),
    referenceImages: {
      // Leere Referenzen - wir nutzen stattdessen referenceImagePaths
    },
    // Pfade zu den Bildern (werden bei Bedarf geladen)
    referenceImagePaths: REFERENCE_IMAGE_FILES,
    stylePreferences: {
      visualStyle: 'Warmer, therapeutischer Comic-Stil mit weichen Linien',
      colorPalette: ['#e8dfd0', '#f5ebe0', '#d4c5b0'],
      atmosphere: 'Ruhig, einfühlsam, nahbar'
    },
    brandVoice: {
      writingStyle: 'Warm, professionell, nahbar',
      coreThemes: ['Hochsensibilität', 'Beziehungen', 'Nervensystem', 'Selbstfürsorge'],
      targetAudience: 'Hochsensible Menschen, Therapie-Interessierte'
    },
    styleReferencePanels: []
  }
}
