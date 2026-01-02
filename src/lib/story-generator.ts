/**
 * Story Generator
 * Batch-Generierung aller Avatare einer Story parallel
 */

import { generateImagePrompt, type ChatMessage } from './chat-helper'
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
 * Generiert eine komplette Story mit allen Avataren parallel
 */
export async function generateCompleteStory(
  panelTexts: string[],
  chatHistory: ChatMessage[],
  characterProfile: CharacterProfile,
  backgroundColor: string = '#e8dfd0',
  onProgress?: ProgressCallback
): Promise<Omit<StoryPanel, 'id' | 'generatedAt'>[]> {

  logger.info('Starte Story-Generierung', {
    component: 'StoryGenerator',
    data: {
      panelCount: panelTexts.length,
      characterName: characterProfile.name
    }
  })

  const totalPanels = panelTexts.length

  try {
    // ========================================================================
    // Phase 1: Image-Prompts parallel generieren
    // ========================================================================

    onProgress?.({
      currentPanel: 0,
      totalPanels,
      status: 'generating_prompts',
      message: 'Generiere Image-Prompts...',
      generatedPanels: 0
    })

    logger.info('Phase 1: Generiere Image-Prompts', {
      component: 'StoryGenerator',
      data: { panelCount: totalPanels }
    })

    const imagePromptPromises = panelTexts.map((panelText, index) =>
      generateImagePrompt(
        panelText,
        chatHistory,
        characterProfile.name,
        characterProfile.stylePreferences.visualStyle,
        characterProfile.stylePreferences.atmosphere
      ).then(prompt => {
        logger.debug(`Image-Prompt ${index + 1}/${totalPanels} generiert`, {
          component: 'StoryGenerator'
        })
        return prompt
      })
    )

    const imagePrompts = await Promise.all(imagePromptPromises)

    logger.info('Alle Image-Prompts generiert', {
      component: 'StoryGenerator',
      data: { count: imagePrompts.length }
    })

    // ========================================================================
    // Phase 2: Avatare parallel generieren
    // ========================================================================

    onProgress?.({
      currentPanel: 0,
      totalPanels,
      status: 'generating_avatars',
      message: 'Generiere Avatare parallel...',
      generatedPanels: 0
    })

    logger.info('Phase 2: Generiere Avatare parallel', {
      component: 'StoryGenerator',
      data: { panelCount: totalPanels }
    })

    // Referenzbilder aus Character Profile extrahieren (lädt bei Bedarf aus public-Ordner)
    const referenceImages = await extractReferenceImagesFromProfile(characterProfile)

    if (referenceImages.length === 0) {
      throw new Error('Keine Referenzbilder im Character Profile gefunden')
    }

    logger.info('Verwende Referenzbilder', {
      component: 'StoryGenerator',
      data: { count: referenceImages.length }
    })

    let completedCount = 0

    const avatarPromises = imagePrompts.map((imagePrompt, index) =>
      generateComicAvatar(
        imagePrompt,
        referenceImages,
        (progress, status) => {
          // Progress-Update für einzelnen Avatar
          logger.debug(`Avatar ${index + 1}/${totalPanels}: ${status} (${progress}%)`, {
            component: 'StoryGenerator'
          })
        }
      ).then(avatarBase64 => {
        completedCount++

        // Progress-Update nach Completion
        onProgress?.({
          currentPanel: completedCount,
          totalPanels,
          status: 'generating_avatars',
          message: `Avatar ${completedCount}/${totalPanels} generiert...`,
          generatedPanels: completedCount
        })

        logger.info(`Avatar ${completedCount}/${totalPanels} fertig`, {
          component: 'StoryGenerator',
          data: { panelNumber: index + 1 }
        })

        return avatarBase64
      })
    )

    const avatars = await Promise.all(avatarPromises)

    logger.info('Alle Avatare generiert', {
      component: 'StoryGenerator',
      data: { count: avatars.length }
    })

    // ========================================================================
    // Phase 3: Panels zusammenbauen
    // ========================================================================

    const panels: Omit<StoryPanel, 'id' | 'generatedAt'>[] = panelTexts.map((text, index) => ({
      panelNumber: index + 1,
      panelText: text,
      avatarBase64: avatars[index],
      imagePrompt: imagePrompts[index],
      backgroundColor
    }))

    onProgress?.({
      currentPanel: totalPanels,
      totalPanels,
      status: 'completed',
      message: 'Story komplett generiert!',
      generatedPanels: totalPanels
    })

    logger.info('Story-Generierung abgeschlossen', {
      component: 'StoryGenerator',
      data: {
        panelCount: panels.length,
        characterName: characterProfile.name
      }
    })

    return panels

  } catch (error) {
    logger.error('Fehler bei Story-Generierung', {
      component: 'StoryGenerator',
      data: error
    })

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
 * Generiert nur die Image-Prompts für eine Story (ohne Avatare)
 * Nützlich für Preview oder manuelle Generierung
 */
export async function generateImagePromptsForStory(
  panelTexts: string[],
  chatHistory: ChatMessage[],
  characterProfile: CharacterProfile
): Promise<string[]> {

  logger.info('Generiere Image-Prompts für Story', {
    component: 'StoryGenerator',
    data: { panelCount: panelTexts.length }
  })

  const promises = panelTexts.map(panelText =>
    generateImagePrompt(
      panelText,
      chatHistory,
      characterProfile.name,
      characterProfile.stylePreferences.visualStyle,
      characterProfile.stylePreferences.atmosphere
    )
  )

  return Promise.all(promises)
}

/**
 * Generiert Avatare für bereits vorhandene Image-Prompts
 * Nützlich für Regenerierung einzelner Panels
 */
export async function generateAvatarsFromPrompts(
  imagePrompts: string[],
  referenceImages: string[],
  onProgress?: (current: number, total: number) => void
): Promise<string[]> {

  logger.info('Generiere Avatare aus Prompts', {
    component: 'StoryGenerator',
    data: { promptCount: imagePrompts.length }
  })

  let completedCount = 0

  const promises = imagePrompts.map((prompt, index) =>
    generateComicAvatar(prompt, referenceImages).then(avatar => {
      completedCount++
      onProgress?.(completedCount, imagePrompts.length)
      return avatar
    })
  )

  return Promise.all(promises)
}

/**
 * Schätzt die Generierungsdauer
 * Basierend auf: ~15 Sekunden pro Avatar bei paralleler Generierung
 */
export function estimateGenerationTime(panelCount: number): {
  seconds: number
  formattedTime: string
} {
  // Image-Prompts: ~2 Sekunden (parallel)
  // Avatare: ~15 Sekunden pro Avatar (parallel)
  // Da parallel: Max-Zeit eines Avatars ist die Gesamt-Zeit

  const promptTime = 2  // Sekunden
  const avatarTime = 15  // Sekunden pro Avatar (bei paralleler Generierung)

  const totalSeconds = promptTime + avatarTime

  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  let formattedTime = ''
  if (minutes > 0) {
    formattedTime = `${minutes} Min ${seconds} Sek`
  } else {
    formattedTime = `${seconds} Sekunden`
  }

  return {
    seconds: totalSeconds,
    formattedTime
  }
}
