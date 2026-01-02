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

export interface PanelGenerationProgress {
  currentPanel: number
  totalPanels: number
  status: 'generating_prompts' | 'generating_avatars' | 'completed' | 'failed'
  message: string
  generatedPanels: number
}

export type ProgressCallback = (progress: PanelGenerationProgress) => void

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
      const activeRefs = [...currentReferenceUrls].slice(0, 8)

      const result = await generateComicAvatar(
        imagePrompt,
        activeRefs,
        (progress, status) => {
          logger.debug(`Panel ${panelNumber}: ${status} (${progress}%)`)
        }
      )

      // WICHTIG: Die URL des neuen Bildes für das NÄCHSTE Panel hinzufügen
      // Wir fügen sie ganz vorne ein
      currentReferenceUrls = [result.url, ...currentReferenceUrls]

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