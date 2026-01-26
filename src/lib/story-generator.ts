/**
 * Story Generator
 * Sequential generation of avatars to allow recursive character referencing
 * Now with angle-aware reference selection for better consistency
 */

import { generateImagePrompt, interpretFeedbackForSceneImprovement, type PanelData } from './chat-helper'
import {
  generateComicAvatar,
  extractReferenceImagesFromProfile
} from './kie-ai-image'
import type { CharacterProfile } from './character-profile'
import type { StoryPanel } from './story-persistence'
import { logger } from './logger'
import { uploadImagesToImgbb } from './imgbb-uploader'
import { getCharacterProfiles } from './character-registry'
import { loadAngleOrganizedReferences, type AngleOrganizedReferences } from './angle-aware-reference-loader'
import { selectReferencesForAngle } from './angle-detector'

export interface PanelGenerationProgress {
  currentPanel: number
  totalPanels: number
  status: 'generating_prompts' | 'generating_avatars' | 'completed' | 'failed'
  message: string
  generatedPanels: number
}

export type ProgressCallback = (progress: PanelGenerationProgress) => void

/**
 * Lädt Referenzbilder für ein Character-Profile, organisiert nach Kamera-Winkeln
 * Neue Logik: Verwendet Dateinamen-basierte Winkel-Erkennung
 */
async function loadCharacterReferencesOrganized(
  profile: CharacterProfile
): Promise<AngleOrganizedReferences> {
  logger.info(`Lade winkel-organisierte Referenzbilder für ${profile.name}...`, {
    component: 'StoryGenerator'
  })

  try {
    // Try angle-organized loading first (new system)
    const organizedRefs = await loadAngleOrganizedReferences(
      profile.name,
      '/reference-images'  // Default folder
    )

    if (organizedRefs.totalCount > 0) {
      logger.info(`✅ ${organizedRefs.totalCount} winkel-organisierte Referenzen geladen`, {
        component: 'StoryGenerator',
        data: {
          character: profile.name,
          angles: Array.from(organizedRefs.referencesByAngle.keys())
        }
      })
      return organizedRefs
    }

    // Fallback: Load all references the old way (not angle-organized)
    logger.warn(`Keine winkel-organisierten Referenzen gefunden für ${profile.name}, verwende Fallback`, {
      component: 'StoryGenerator'
    })

    // Special handling for Ben (old path)
    if (profile.name === 'Ben') {
      const benImagePath = '/Avatare/Ben/Extreme close-up comic.jpg'
      const response = await fetch(benImagePath)
      if (!response.ok) {
        throw new Error(`Konnte Ben's Bild nicht laden: ${response.status}`)
      }

      const blob = await response.blob()
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })

      const urls = await uploadImagesToImgbb([base64])
      const benUrl = urls[0]

      // Return as "frontal" angle by default
      return {
        characterName: profile.name,
        referencesByAngle: new Map([['frontal', [benUrl]]]),
        allReferences: [benUrl],
        totalCount: 1
      }
    }

    // For other characters: Use extractReferenceImagesFromProfile
    const allUrls = await extractReferenceImagesFromProfile(profile)

    return {
      characterName: profile.name,
      referencesByAngle: new Map([['frontal', allUrls]]),  // Default to frontal
      allReferences: allUrls,
      totalCount: allUrls.length
    }

  } catch (error) {
    logger.error(`Fehler beim Laden von ${profile.name}'s Referenzbildern`, {
      component: 'StoryGenerator',
      data: error
    })

    return {
      characterName: profile.name,
      referencesByAngle: new Map(),
      allReferences: [],
      totalCount: 0
    }
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

  logger.info('Starte parallele Story-Generierung mit dynamischen Character-Profilen', {
    component: 'StoryGenerator',
    data: { panelCount: panelDataList.length }
  })

  const totalPanels = panelDataList.length
  const panels: Omit<StoryPanel, 'id' | 'generatedAt'>[] = []

  // ============================================================================
  // OPTIMIZATION: Lade & cache alle benötigten Character-Profile NUR EINMAL
  // ============================================================================

  logger.info('Analysiere benötigte Charaktere...', { component: 'StoryGenerator' })

  // Sammle alle verwendeten Charaktere aus allen Panels
  const allCharacters = new Set<string>()
  panelDataList.forEach(panel => {
    if (panel.characters && Array.isArray(panel.characters)) {
      panel.characters.forEach(char => allCharacters.add(char))
    }
  })

  logger.info(`Gefundene Charaktere: ${Array.from(allCharacters).join(', ')}`, {
    component: 'StoryGenerator'
  })

  // Lade alle benötigten Character-Profile
  const characterProfiles = getCharacterProfiles(Array.from(allCharacters))
  const characterProfileMap = new Map(
    characterProfiles.map(profile => [profile.name, profile])
  )

  // Lade und cache Referenzbilder für alle Charaktere (ANGLE-ORGANIZED!)
  const characterReferencesMap = new Map<string, AngleOrganizedReferences>()

  for (const profile of characterProfiles) {
    logger.info(`Lade winkel-organisierte Referenzen für ${profile.name}...`, {
      component: 'StoryGenerator'
    })
    const organizedRefs = await loadCharacterReferencesOrganized(profile)
    characterReferencesMap.set(profile.name, organizedRefs)
  }

  logger.info('✅ Alle Character-Referenzen gecached (winkel-organisiert)', {
    component: 'StoryGenerator',
    data: {
      characters: Array.from(characterReferencesMap.keys()),
      refCounts: Array.from(characterReferencesMap.entries()).map(([name, refs]) => ({
        name,
        totalCount: refs.totalCount,
        angles: Array.from(refs.referencesByAngle.keys())
      }))
    }
  })

  // ============================================================================
  // Panel Generation - PARALLEL für maximale Geschwindigkeit! 🚀
  // ============================================================================

  try {
    onProgress?.({
      currentPanel: 0,
      totalPanels,
      status: 'generating_prompts',
      message: `Generiere Prompts für ${totalPanels} Panels...`,
      generatedPanels: 0
    })

    // Generiere alle Panels parallel
    let completedPanels = 0

    const panelPromises = panelDataList.map(async (panelData, i) => {
      const panelNumber = i + 1

      // Context für dieses Panel (alle vorherigen Panels in der geplanten Story)
      const previousContext = panelDataList
        .slice(0, i)
        .map((p, idx) => `Panel ${idx + 1}: ${p.scene}`)
        .join('\n')

      // Generiere Image-Prompt MIT Character-Profilen UND Winkel-Erkennung
      const { prompt: imagePrompt, detectedAngle } = await generateImagePrompt(
        panelData,
        previousContext,
        characterProfileMap  // Übergebe Character-Profile für Beschreibungen
      )

      logger.info(`📐 Panel ${panelNumber}: Detected angle = ${detectedAngle}`, {
        component: 'StoryGenerator'
      })

      // Sammle ANGLE-SPECIFIC Referenzbilder für alle Charaktere in diesem Panel
      const panelCharacters = panelData.characters || ['Theresa'] // Fallback auf Theresa
      let activeRefs: string[] = []

      for (const charName of panelCharacters) {
        const organizedRefs = characterReferencesMap.get(charName)
        if (organizedRefs && organizedRefs.totalCount > 0) {
          // NEW: Select angle-appropriate references!
          const angleRefs = selectReferencesForAngle(
            detectedAngle,
            organizedRefs.referencesByAngle,
            3  // Max 3 refs per character per angle
          )
          activeRefs.push(...angleRefs)

          logger.debug(`Selected ${angleRefs.length} angle-specific refs for ${charName}`, {
            component: 'StoryGenerator',
            data: { angle: detectedAngle }
          })
        }
      }

      // Limit auf 8 Bilder (KIE.AI Max)
      activeRefs = activeRefs.slice(0, 8)

      logger.info(`Panel ${panelNumber}: ${panelCharacters.join(' + ')} | Angle: ${detectedAngle} | Refs: ${activeRefs.length}`, {
        component: 'StoryGenerator',
        data: { characters: panelCharacters, angle: detectedAngle }
      })

      // Hole AI-Modell vom ersten Character-Profile (oder default)
      const firstCharProfile = characterProfileMap.get(panelCharacters[0])
      const aiModel = firstCharProfile?.aiModel || characterProfile.aiModel || 'nano-banana-pro'

      // Generiere Avatar
      const result = await generateComicAvatar(
        imagePrompt,
        activeRefs,
        (progress, status) => {
          logger.debug(`Panel ${panelNumber}: ${status} (${progress}%)`)
        },
        aiModel
      )

      // Progress-Update nach jedem fertigen Panel
      completedPanels++
      onProgress?.({
        currentPanel: panelNumber,
        totalPanels,
        status: completedPanels === totalPanels ? 'completed' : 'generating_avatars',
        message: `Panel ${panelNumber} fertig! (${completedPanels}/${totalPanels})`,
        generatedPanels: completedPanels
      })

      return {
        panelNumber,
        panelText: panelData.text,
        sceneDescription: panelData.scene,
        avatarBase64: result.base64,
        imagePrompt,
        backgroundColor
      }
    })

    onProgress?.({
      currentPanel: 0,
      totalPanels,
      status: 'generating_avatars',
      message: `Generiere ${totalPanels} Panels parallel...`,
      generatedPanels: 0
    })

    // Warte auf alle Panels (parallel!)
    const generatedPanels = await Promise.all(panelPromises)

    return generatedPanels

  } catch (error) {
    logger.error('Fehler bei paralleler Panel-Generierung', { component: 'StoryGenerator', data: error })
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
 * Schätzt die Generierungsdauer (parallel!)
 * Bei paralleler Generierung hängt die Zeit hauptsächlich vom langsamsten Panel ab,
 * nicht von der Summe aller Panels
 */
export function estimateGenerationTime(panelCount: number): {
  seconds: number
  formattedTime: string
} {
  // Bei paralleler Generierung: ~30-60s für alle Panels gleichzeitig
  // Plus etwas mehr bei vielen Panels (Queue-Wartezeit)
  const baseTime = 40 // Basiszeit für parallel
  const queueOverhead = Math.floor(panelCount / 3) * 10 // Etwas mehr bei vielen Panels
  const totalSeconds = baseTime + queueOverhead

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
    // KI interpretiert das Feedback und verbessert die Scene Description
    logger.info('Interpretiere User-Feedback mit KI...', {
      component: 'StoryGenerator',
      data: { feedback: userFeedback.substring(0, 50) }
    })
    sceneDescription = await interpretFeedbackForSceneImprovement(panelData.scene, userFeedback)
    logger.info('Scene Description verbessert durch KI-Interpretation', {
      component: 'StoryGenerator',
      data: {
        originalLength: panelData.scene.length,
        improvedLength: sceneDescription.length
      }
    })
  }

  // Hole Characters aus PanelData (oder Fallback auf Theresa)
  const panelCharacters = panelData.characters || ['Theresa']

  // Lade Character-Profile
  const characterProfiles = getCharacterProfiles(panelCharacters)
  const characterProfileMap = new Map(
    characterProfiles.map(profile => [profile.name, profile])
  )

  // Generate image prompt with angle detection
  const { prompt: imagePrompt, detectedAngle } = await generateImagePrompt(
    { text: panelData.text, scene: sceneDescription, characters: panelCharacters },
    previousContext,
    characterProfileMap
  )

  logger.info(`📐 Regenerating panel ${panelNumber}: Detected angle = ${detectedAngle}`, {
    component: 'StoryGenerator'
  })

  // Sammle ANGLE-SPECIFIC Referenzen für alle Charaktere
  let referenceUrls: string[] = []
  for (const charName of panelCharacters) {
    const profile = characterProfileMap.get(charName)
    if (profile) {
      const organizedRefs = await loadCharacterReferencesOrganized(profile)

      if (organizedRefs.totalCount > 0) {
        // Select angle-appropriate references
        const angleRefs = selectReferencesForAngle(
          detectedAngle,
          organizedRefs.referencesByAngle,
          3  // Max 3 refs per character
        )
        referenceUrls.push(...angleRefs)

        logger.debug(`Selected ${angleRefs.length} angle-specific refs for ${charName}`, {
          component: 'StoryGenerator',
          data: { angle: detectedAngle }
        })
      }
    }
  }

  // Limit auf 8 Bilder
  referenceUrls = referenceUrls.slice(0, 8)

  // Avatar generieren
  const result = await generateComicAvatar(
    imagePrompt,
    referenceUrls,
    undefined,  // kein progress callback
    characterProfile.aiModel  // Verwende ausgewähltes Modell aus Profil
  )

  return {
    panelNumber,
    panelText: panelData.text,
    sceneDescription: sceneDescription,  // Speichere modifizierte Scene (mit Feedback) für weitere Edits
    avatarBase64: result.base64,
    imagePrompt,
    backgroundColor
  }
}

/**
 * 🎲 Würfelt ein Panel neu mit STRIKTER Referenz-Einhaltung
 * Kein User-Feedback, einfach nochmal generieren mit extra-verstärktem "FOLLOW REFERENCE!" Befehl
 *
 * Use-Case: Panel sieht nicht aus wie Referenzbild → Einfach nochmal versuchen
 */
export async function rerollPanelStrictReference(
  panelIndex: number,
  panelData: PanelData,
  allPanelData: PanelData[],
  characterProfile: CharacterProfile,
  backgroundColor: string = '#e8dfd0'
): Promise<Omit<StoryPanel, 'id' | 'generatedAt'>> {
  logger.info('🎲 Würfle Panel neu mit STRIKTER Referenz-Einhaltung', {
    component: 'StoryGenerator',
    data: { panelIndex, panelNumber: panelIndex + 1 }
  })

  // Rufe regenerateSinglePanel MIT speziellem Feedback auf
  // Das Feedback signalisiert: "Maximale Referenz-Treue!"
  const strictReferenceFeedback =
    "CRITICAL: The generated image does NOT match the reference images closely enough. " +
    "Character consistency is FAILING. " +
    "Regenerate with MAXIMUM adherence to reference images. " +
    "Copy the EXACT facial features, proportions, and characteristics from the reference images. " +
    "This is a STRICT REFERENCE MODE retry."

  return regenerateSinglePanel(
    panelIndex,
    panelData,
    allPanelData,
    characterProfile,
    backgroundColor,
    strictReferenceFeedback
  )
}

/**
 * Editiert ein Panel via Image-to-Image Editing
 * Verwendet das aktuelle Panel-Bild als Basis und modifiziert es basierend auf dem User-Prompt
 */
export async function editPanelWithImageToImage(
  currentPanelBase64: string,
  modificationPrompt: string,
  characterProfile: CharacterProfile,
  originalPanelText: string,
  backgroundColor: string = '#e8dfd0',
  prioritizeOriginalReferences: boolean = false  // Für Reroll: Original-Referenzen ZUERST
): Promise<Omit<StoryPanel, 'id' | 'generatedAt'>> {
  logger.info('Starte Image-to-Image Panel-Editing', {
    component: 'StoryGenerator',
    data: {
      promptLength: modificationPrompt.length,
      hasCurrentImage: !!currentPanelBase64,
      prioritizeOriginalReferences
    }
  })

  try {
    // 1. Hole Character-Referenzen (für Konsistenz)
    const characterReferenceUrls = await extractReferenceImagesFromProfile(characterProfile)

    // 2. Upload aktuelles Panel-Bild zu imgbb (nur wenn nicht Reroll)
    let referenceUrls: string[]

    if (prioritizeOriginalReferences) {
      // REROLL-MODUS: Nur Original-Referenzen, KEIN aktuelles Panel
      // Dies zwingt Imagen, sich an den Original-Referenzen zu orientieren
      referenceUrls = characterReferenceUrls.slice(0, 8)

      logger.info('Reroll-Modus: Verwende NUR Original-Referenzen', {
        component: 'StoryGenerator',
        data: {
          totalRefs: referenceUrls.length,
          currentImageIncluded: false
        }
      })
    } else {
      // EDIT-MODUS: Aktuelles Bild ZUERST (höchste Priorität), dann Character-Referenzen
      logger.info('Lade aktuelles Panel-Bild zu imgbb hoch...', { component: 'StoryGenerator' })
      const currentImageUrls = await uploadImagesToImgbb([currentPanelBase64])
      const currentImageUrl = currentImageUrls[0]

      referenceUrls = [currentImageUrl, ...characterReferenceUrls].slice(0, 8)

      logger.info('Edit-Modus: Aktuelles Bild hat Priorität', {
        component: 'StoryGenerator',
        data: {
          totalRefs: referenceUrls.length,
          currentImageFirst: true
        }
      })
    }

    // 3. Generiere modifiziertes Bild mit dem User-Prompt
    const result = await generateComicAvatar(
      modificationPrompt,
      referenceUrls,
      undefined,  // kein progress callback
      characterProfile.aiModel
    )

    logger.info('Panel erfolgreich via Image-to-Image editiert', {
      component: 'StoryGenerator',
      data: { imageUrl: result.url }
    })

    // 5. Extrahiere neuen Panel-Text aus dem Prompt (falls geändert)
    // Der Prompt könnte "Change text from 'X' to 'Y'" enthalten
    let newPanelText = originalPanelText
    const textChangeMatch = modificationPrompt.match(/change text from ['"](.+?)['"] to ['"](.+?)['"]/i)
    if (textChangeMatch) {
      newPanelText = textChangeMatch[2]
      logger.info('Panel-Text aus Prompt extrahiert', {
        component: 'StoryGenerator',
        data: { oldText: textChangeMatch[1], newText: newPanelText }
      })
    }

    return {
      panelNumber: 1, // Wird von MainApp überschrieben
      panelText: newPanelText,
      sceneDescription: modificationPrompt,  // Speichere den Modifikations-Prompt
      avatarBase64: result.base64,
      imagePrompt: modificationPrompt,
      backgroundColor
    }

  } catch (error) {
    logger.error('Fehler beim Image-to-Image Panel-Editing', {
      component: 'StoryGenerator',
      data: error
    })
    throw error
  }
}

export async function generateImagePromptsForStory(panelDataList: PanelData[]): Promise<string[]> {
  const promises = panelDataList.map(async (panelData, index) => {
    const previousContext = panelDataList.slice(0, index).map((p, i) => `Panel ${i + 1}: ${p.scene}`).join('\n')
    const { prompt } = await generateImagePrompt(panelData, previousContext)
    return prompt
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