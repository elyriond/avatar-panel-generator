/**
 * Story Generator
 * Sequential generation of avatars to allow recursive character referencing
 */

import { generateImagePrompt, type PanelData } from './chat-helper'
import {
  generateComicAvatar,
  extractReferenceImagesFromProfile
} from './kie-ai-image'
import type { CharacterProfile } from './character-profile'
import type { StoryPanel } from './story-persistence'
import { logger } from './logger'
import { uploadImagesToImgbb } from './imgbb-uploader'

export interface PanelGenerationProgress {
  currentPanel: number
  totalPanels: number
  status: 'generating_prompts' | 'generating_avatars' | 'completed' | 'failed'
  message: string
  generatedPanels: number
}

export type ProgressCallback = (progress: PanelGenerationProgress) => void

/**
 * Lädt Ben's Referenzbild, wenn "Freund" in der Scene Description vorkommt
 */
async function loadBenReferenceIfNeeded(sceneDescription: string): Promise<string[]> {
  // Prüfe ob "Freund" (case-insensitive) in der Scene Description vorkommt
  const needsBen = /\bfreund\b/i.test(sceneDescription)

  if (!needsBen) {
    logger.debug('Ben nicht benötigt in dieser Scene', { component: 'StoryGenerator' })
    return []
  }

  logger.info('Ben wird in dieser Scene benötigt, lade Referenzbild...', { component: 'StoryGenerator' })

  try {
    // Lade Ben's Referenzbild
    const benImagePath = '/Avatare/Winkel /Ben.jpg'
    const response = await fetch(benImagePath)

    if (!response.ok) {
      throw new Error(`Konnte Ben's Bild nicht laden: ${response.status}`)
    }

    const blob = await response.blob()

    // Konvertiere zu Base64
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })

    // Upload zu imgbb und erhalte URL
    const urls = await uploadImagesToImgbb([base64])
    logger.info('Ben Referenzbild erfolgreich geladen und hochgeladen', {
      component: 'StoryGenerator',
      data: { url: urls[0] }
    })

    return urls
  } catch (error) {
    logger.error('Fehler beim Laden von Ben\'s Referenzbild', {
      component: 'StoryGenerator',
      data: error
    })
    // Bei Fehler: Weiter ohne Ben's Bild
    return []
  }
}

/**
 * Generiert eine komplette Story sequentiell
 */
export async function generateCompleteStory(
  panelDataList: PanelData[],
  characterProfile: CharacterProfile,
  backgroundColor: string = '#e8dfd0',
  onProgress?: ProgressCallback
): Promise<Omit<StoryPanel, 'id' | 'generatedAt'>[]> {

  logger.info('Starte sequentielle Story-Generierung', {
    component: 'StoryGenerator',
    data: { panelCount: panelDataList.length }
  })

  const totalPanels = panelDataList.length
  const panels: Omit<StoryPanel, 'id' | 'generatedAt'>[] = []
  
  // Start-Referenzen aus dem Profil (das sind bereits URLs)
  let currentReferenceUrls = await extractReferenceImagesFromProfile(characterProfile)

  try {
    for (let i = 0; i < totalPanels; i++) {
      const panelData = panelDataList[i]
      const panelNumber = i + 1

      const previousContext = panelDataList
        .slice(0, i)
        .map((p, idx) => `Panel ${idx + 1}: ${p.scene}`)
        .join('\n')

      onProgress?.({
        currentPanel: panelNumber,
        totalPanels,
        status: 'generating_prompts',
        message: `Plane Panel ${panelNumber}/${totalPanels}...`,
        generatedPanels: i
      })

      const imagePrompt = await generateImagePrompt(panelData, previousContext)

      onProgress?.({
        currentPanel: panelNumber,
        totalPanels,
        status: 'generating_avatars',
        message: `Zeichne Panel ${panelNumber}/${totalPanels}...`,
        generatedPanels: i
      })

      // Wir nehmen die Kern-Referenzen + die letzten 2 generierten Panel-URLs
      // (Priorität: Neueste zuerst)
      let activeRefs = [...currentReferenceUrls].slice(0, 8)

      // WICHTIG: Prüfe ob Ben (Freund) in dieser Scene vorkommt
      const benRefs = await loadBenReferenceIfNeeded(panelData.scene)
      if (benRefs.length > 0) {
        // Ben's Bild hinzufügen (mit Priorität, daher am Anfang)
        activeRefs = [...benRefs, ...activeRefs]
        // Limit auf 8 Bilder beachten
        if (activeRefs.length > 8) {
          activeRefs = activeRefs.slice(0, 8)
        }
      }

      const result = await generateComicAvatar(
        imagePrompt,
        activeRefs,
        (progress, status) => {
          logger.debug(`Panel ${panelNumber}: ${status} (${progress}%)`)
        }
      )

      // WICHTIG: Wir deaktivieren das recursive Referencing, um den "Drift" zu verhindern.
      // Wir nutzen für JEDES Panel nur die originalen Referenzbilder.
      // currentReferenceUrls = [result.url, ...currentReferenceUrls]

      panels.push({
        panelNumber,
        panelText: panelData.text,
        avatarBase64: result.base64,
        imagePrompt,
        backgroundColor
      })

      onProgress?.({
        currentPanel: panelNumber,
        totalPanels,
        status: i === totalPanels - 1 ? 'completed' : 'generating_avatars',
        message: `Panel ${panelNumber} fertig!`,
        generatedPanels: panelNumber
      })
    }

    return panels

  } catch (error) {
    logger.error('Fehler bei sequentieller Generierung', { component: 'StoryGenerator', data: error })
    onProgress?.({
      currentPanel: 0,
      totalPanels,
      status: 'failed',
      message: `Fehler: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`,
      generatedPanels: 0
    })
    throw error
  }
}

/**
 * Schätzt die Generierungsdauer
 */
export function estimateGenerationTime(panelCount: number): {
  seconds: number
  formattedTime: string
} {
  const timePerPanel = 25
  const totalSeconds = panelCount * timePerPanel
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return {
    seconds: totalSeconds,
    formattedTime: minutes > 0 ? `${minutes} Min ${seconds} Sek` : `${seconds} Sekunden`
  }
}

/**
 * Regeneriert ein einzelnes Panel mit neuem Feedback
 */
export async function regenerateSinglePanel(
  panelIndex: number,
  panelData: PanelData,
  allPanelData: PanelData[],
  characterProfile: CharacterProfile,
  backgroundColor: string = '#e8dfd0',
  userFeedback?: string
): Promise<Omit<StoryPanel, 'id' | 'generatedAt'>> {
  logger.info('Regeneriere einzelnes Panel', {
    component: 'StoryGenerator',
    data: { panelIndex, panelNumber: panelIndex + 1 }
  })

  const panelNumber = panelIndex + 1

  // Kontext der vorherigen Panels
  const previousContext = allPanelData
    .slice(0, panelIndex)
    .map((p, idx) => `Panel ${idx + 1}: ${p.scene}`)
    .join('\n')

  // Image-Prompt generieren (mit Feedback falls vorhanden)
  let sceneDescription = panelData.scene
  if (userFeedback) {
    sceneDescription = `${panelData.scene}. User feedback: ${userFeedback}`
  }

  const imagePrompt = await generateImagePrompt(
    { text: panelData.text, scene: sceneDescription },
    previousContext
  )

  // Referenzen holen
  let referenceUrls = await extractReferenceImagesFromProfile(characterProfile)

  // WICHTIG: Prüfe ob Ben (Freund) in dieser Scene vorkommt
  const benRefs = await loadBenReferenceIfNeeded(panelData.scene)
  if (benRefs.length > 0) {
    // Ben's Bild hinzufügen (mit Priorität, daher am Anfang)
    referenceUrls = [...benRefs, ...referenceUrls]
    // Limit auf 8 Bilder beachten
    if (referenceUrls.length > 8) {
      referenceUrls = referenceUrls.slice(0, 8)
    }
  }

  // Avatar generieren
  const result = await generateComicAvatar(imagePrompt, referenceUrls)

  return {
    panelNumber,
    panelText: panelData.text,
    avatarBase64: result.base64,
    imagePrompt,
    backgroundColor
  }
}

export async function generateImagePromptsForStory(panelDataList: PanelData[]): Promise<string[]> {
  const promises = panelDataList.map((panelData, index) => {
    const previousContext = panelDataList.slice(0, index).map((p, i) => `Panel ${i + 1}: ${p.scene}`).join('\n')
    return generateImagePrompt(panelData, previousContext)
  })
  return Promise.all(promises)
}

export async function generateAvatarsFromPrompts(imagePrompts: string[], referenceImages: string[], onProgress?: (current: number, total: number) => void): Promise<string[]> {
  let completedCount = 0
  const results: string[] = []

  // Da hier keine sequentiellen URLs zurückkommen, müssen wir mappen
  const promises = imagePrompts.map((prompt, index) =>
    generateComicAvatar(prompt, referenceImages).then(res => {
      completedCount++
      onProgress?.(completedCount, imagePrompts.length)
      return res.base64
    })
  )
  return Promise.all(promises)
}