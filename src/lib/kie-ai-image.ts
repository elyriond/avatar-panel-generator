/**
 * KIE.AI Image Generation Library
 * Verwendet Nano Banana Pro (Google Imagen 4) für Character-konsistente Comic-Avatars
 */

import { logger } from './logger'
import { uploadImagesToImgbb } from './imgbb-uploader'

const API_KEY = import.meta.env.VITE_KIE_AI_API_KEY
const API_BASE_URL = 'https://api.kie.ai/api/v1/jobs'

if (!API_KEY) {
  throw new Error('VITE_KIE_AI_API_KEY ist nicht gesetzt. Bitte in .env.local hinzufügen.')
}

// ============================================================================
// Types & Interfaces
// ============================================================================

export interface ImageGenerationOptions {
  prompt: string
  referenceImages: string[]        // Base64 encoded images (max 8)
  aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4'
  resolution?: '1K' | '2K' | '4K'
  outputFormat?: 'png' | 'jpg'
  negativePrompt?: string
}

export interface TaskResponse {
  success: boolean
  taskId: string
  message?: string
}

export interface TaskStatus {
  taskId: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress?: number
  output?: GeneratedImage[]
  error?: string
}

export interface GeneratedImage {
  url: string
  base64?: string
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Erstellt eine neue Image-Generation-Task bei KIE.AI
 */
export async function createImageTask(
  options: ImageGenerationOptions
): Promise<TaskResponse> {
  logger.apiCall('kie-ai', 'createImageTask', {
    promptLength: options.prompt.length,
    referenceImageCount: options.referenceImages.length,
    aspectRatio: options.aspectRatio || '1:1',
    resolution: options.resolution || '1K'
  })

  try {
    // Prepare image_input array - API akzeptiert Data URIs oder URLs
    const imageInputs = options.referenceImages.map(imageInput => {
      // URLs direkt verwenden (von imgbb)
      if (imageInput.startsWith('http://') || imageInput.startsWith('https://')) {
        return imageInput
      }
      // Base64: Stelle sicher, dass Data URI Prefix vorhanden ist
      if (!imageInput.startsWith('data:')) {
        return `data:image/jpeg;base64,${imageInput}`
      }
      return imageInput
    })

    const requestBody = {
      model: 'nano-banana-pro',
      task_type: 'image_generation',
      input: {
        prompt: options.prompt,
        image_input: imageInputs,  // String-Array statt Objekt-Array
        aspect_ratio: options.aspectRatio || '1:1',
        output_format: options.outputFormat || 'jpg',  // JPG statt PNG für kleinere Dateien
        resolution: options.resolution || '1K',        // 1K = 1024x1024 (ausreichend für Instagram)
        quality: 80,                                    // 80% Qualität für gute Balance
        ...(options.negativePrompt && { negative_prompt: options.negativePrompt })
      }
    }

    // Analyse der Bildquellen für Debugging
    const imageTypes = imageInputs.map(img => {
      if (img.startsWith('http')) return 'URL'
      if (img.startsWith('data:')) return 'Base64'
      return 'Unknown'
    })

    console.log('📤 KIE.AI Request:', {
      url: `${API_BASE_URL}/createTask`,
      model: requestBody.model,
      promptLength: requestBody.input.prompt.length,
      imageCount: requestBody.input.image_input.length,
      imageTypes: imageTypes,
      imageInputSample: imageInputs[0]?.substring(0, 100) + '...'
    })
    console.log('📦 Full Request Body:', JSON.stringify(requestBody, null, 2))

    const response = await fetch(`${API_BASE_URL}/createTask`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify(requestBody)
    })

    console.log('📥 KIE.AI Response Status:', response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ KIE.AI Error Response:', errorText)
      let errorData
      try {
        errorData = JSON.parse(errorText)
      } catch {
        errorData = { message: errorText }
      }
      throw new Error(`KIE.AI API Error: ${response.status} - ${JSON.stringify(errorData)}`)
    }

    const data = await response.json()
    console.log('✅ KIE.AI Task Created:', data)

    // KIE.AI API Response Format: { code: 200, msg: "success", data: { taskId, recordId } }
    const success = data.code === 200
    const taskId = data.data?.taskId
    const message = data.msg

    if (!taskId) {
      throw new Error(`KIE.AI API Error: Keine Task-ID in Response: ${JSON.stringify(data)}`)
    }

    logger.apiResponse('kie-ai', response.status, {
      taskId: taskId,
      success: success
    })

    return {
      success: success,
      taskId: taskId,
      message: message
    }
  } catch (error) {
    logger.error('Fehler beim Erstellen der Image-Task', {
      component: 'KieAiImage',
      data: error
    })
    throw error
  }
}

/**
 * Fragt den Status einer Task ab
 */
export async function getTaskStatus(taskId: string): Promise<TaskStatus> {
  logger.apiCall('kie-ai', 'getTaskStatus', { taskId })

  try {
    // KIE.AI API: recordInfo mit Query-Parameter (nicht Path-Parameter!)
    const url = `${API_BASE_URL}/recordInfo?taskId=${taskId}`
    console.log('🔍 KIE.AI getTaskStatus URL:', url)

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${API_KEY}`
      }
    })

    console.log('📥 KIE.AI getTaskStatus Response:', response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ KIE.AI getTaskStatus Error:', errorText)
      throw new Error(`KIE.AI API Error: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    console.log('✅ KIE.AI Task Status (full response):', JSON.stringify(data, null, 2))

    // KIE.AI Response Format: { code, msg, data: { state, resultJson, ... } }
    const taskData = data.data
    console.log('📋 Task Data:', {
      state: taskData.state,
      failCode: taskData.failCode,
      failMsg: taskData.failMsg,
      resultJson: taskData.resultJson
    })

    // Map KIE.AI states to our status format
    // state: waiting/queuing/generating/success/failed
    let status: 'pending' | 'processing' | 'completed' | 'failed'
    if (taskData.state === 'waiting' || taskData.state === 'queuing') {
      status = 'pending'
    } else if (taskData.state === 'generating') {
      status = 'processing'
    } else if (taskData.state === 'success') {
      status = 'completed'
    } else if (taskData.state === 'failed') {
      status = 'failed'
    } else {
      // Unbekannter State - als pending behandeln und loggen
      console.warn('⚠️ Unbekannter Task-State:', taskData.state)
      status = 'pending'
    }

    // Parse resultJson for image URLs
    let output: GeneratedImage[] | undefined
    if (taskData.resultJson) {
      try {
        const resultData = typeof taskData.resultJson === 'string'
          ? JSON.parse(taskData.resultJson)
          : taskData.resultJson

        if (resultData.resultUrls && Array.isArray(resultData.resultUrls)) {
          output = resultData.resultUrls.map((url: string) => ({ url }))
        }
      } catch (e) {
        console.error('Fehler beim Parsen von resultJson:', e)
      }
    }

    logger.apiResponse('kie-ai', response.status, {
      taskId,
      status,
      state: taskData.state
    })

    return {
      taskId: taskData.taskId || taskId,
      status,
      progress: undefined, // KIE.AI gibt keinen Progress zurück
      output,
      error: taskData.failMsg
    }
  } catch (error) {
    logger.error('Fehler beim Abrufen des Task-Status', {
      component: 'KieAiImage',
      data: error
    })
    throw error
  }
}

/**
 * Wartet auf Completion einer Task mit Polling
 * @param taskId - Die Task-ID
 * @param onProgress - Optional: Callback für Progress-Updates
 * @param maxWaitTime - Max. Wartezeit in Millisekunden (default: 300000 = 5 Minuten)
 * @returns Generierte Bilder
 */
export async function waitForTaskCompletion(
  taskId: string,
  onProgress?: (progress: number, status: string) => void,
  maxWaitTime: number = 300000
): Promise<GeneratedImage[]> {
  const startTime = Date.now()
  const pollInterval = 5000 // Poll alle 5 Sekunden (weniger API-Calls)

  logger.info('Warte auf Task-Completion', {
    component: 'KieAiImage',
    data: { taskId, maxWaitTime }
  })

  return new Promise((resolve, reject) => {
    const poll = async () => {
      try {
        const elapsed = Date.now() - startTime

        // Timeout Check
        if (elapsed > maxWaitTime) {
          logger.error('Task Timeout', {
            component: 'KieAiImage',
            data: {
              taskId,
              elapsedMs: elapsed,
              maxWaitMs: maxWaitTime
            }
          })
          reject(new Error(`Task Timeout: Maximale Wartezeit überschritten (${Math.round(elapsed / 1000)}s)`))
          return
        }

        const status = await getTaskStatus(taskId)

        // Log alle 30 Sekunden den aktuellen Status
        if (Math.floor(elapsed / 30000) > Math.floor((elapsed - pollInterval) / 30000)) {
          console.log(`⏳ Task ${taskId.substring(0, 8)}... läuft seit ${Math.round(elapsed / 1000)}s (Status: ${status.status})`)
        }

        // Progress-Callback
        if (onProgress && status.progress !== undefined) {
          onProgress(status.progress, status.status)
        }

        // Status-Check
        if (status.status === 'completed') {
          if (!status.output || status.output.length === 0) {
            reject(new Error('Task completed aber keine Bilder generiert'))
            return
          }

          logger.info('Task erfolgreich abgeschlossen', {
            component: 'KieAiImage',
            data: {
              taskId,
              imageCount: status.output.length,
              duration: Date.now() - startTime
            }
          })

          resolve(status.output)
          return
        }

        if (status.status === 'failed') {
          logger.error('Task fehlgeschlagen', {
            component: 'KieAiImage',
            data: { taskId, error: status.error }
          })
          reject(new Error(`Task failed: ${status.error || 'Unbekannter Fehler'}`))
          return
        }

        // Noch pending/processing → weiter pollen
        setTimeout(poll, pollInterval)
      } catch (error) {
        logger.error('Fehler beim Polling', {
          component: 'KieAiImage',
          data: error
        })
        reject(error)
      }
    }

    // Start polling
    poll()
  })
}

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
    logger.error('Fehler beim Konvertieren von URL zu Base64', {
      component: 'KieAiImage',
      data: error
    })
    throw error
  }
}

// ============================================================================
// High-Level Functions
// ============================================================================

/**
 * Generiert einen Comic-Avatar mit Character Consistency
 *
 * @param prompt - Detaillierte Szenen-Beschreibung
 * @param referenceImages - Base64-kodierte Referenzbilder ODER URLs (max 8)
 * @param onProgress - Optional: Progress-Callback
 * @returns Objekt mit Base64-kodiertem Bild und der Original-URL
 */
export async function generateComicAvatar(
  prompt: string,
  referenceImages: string[],
  onProgress?: (progress: number, status: string) => void
): Promise<{ base64: string, url: string }> {
  logger.info('Starte Comic-Avatar-Generierung', {
    component: 'KieAiImage',
    data: {
      promptLength: prompt.length,
      referenceImageCount: referenceImages.length
    }
  })

  try {
    // Validierung
    if (referenceImages.length === 0) {
      throw new Error('Mindestens ein Referenzbild erforderlich')
    }

    // SICHERHEIT: Alle Base64-Referenzen zu imgbb hochladen
    const base64ImagesToUpload = referenceImages.filter(img => img.startsWith('data:') || (img.length > 500 && !img.startsWith('http')))
    const existingUrls = referenceImages.filter(img => img.startsWith('http'))
    
    let finalReferenceUrls = [...existingUrls]
    
    if (base64ImagesToUpload.length > 0) {
      logger.info(`Lade ${base64ImagesToUpload.length} neue Referenzbilder zu imgbb hoch...`)
      const newUrls = await uploadImagesToImgbb(base64ImagesToUpload)
      finalReferenceUrls = [...newUrls, ...finalReferenceUrls]
    }

    if (finalReferenceUrls.length > 8) {
      finalReferenceUrls = finalReferenceUrls.slice(0, 8)
    }

    // 1. Task erstellen
    const taskResponse = await createImageTask({
      prompt,
      referenceImages: finalReferenceUrls,
      aspectRatio: '1:1',
      resolution: '1K',
      outputFormat: 'jpg',
      negativePrompt: 'realistic photo, photograph, 3d render, ugly, deformed, blurry, low quality'
    })

    if (!taskResponse.success) {
      throw new Error(`Task creation failed: ${taskResponse.message}`)
    }

    // 2. Auf Completion warten
    const images = await waitForTaskCompletion(
      taskResponse.taskId,
      onProgress,
      300000 // 5 Minuten Timeout (Bildgenerierung kann 3-5 Min dauern)
    )

    if (images.length === 0) {
      throw new Error('Keine Bilder generiert')
    }

    // 3. Erstes Bild verarbeiten
    const firstImage = images[0]
    const imageUrl = firstImage.url

    if (!imageUrl) {
      throw new Error('Keine Bild-URL in der API-Antwort gefunden')
    }

    // URL zu Base64 konvertieren (für lokale Anzeige/Speicherung)
    const base64 = await urlToBase64(imageUrl)

    return { base64, url: imageUrl }

  } catch (error) {
    logger.error('Fehler bei Comic-Avatar-Generierung', {
      component: 'KieAiImage',
      data: error
    })
    throw error
  }
}

/**
 * Hilfsfunktion: Extrahiert Referenzbilder aus CharacterProfile
 * Lädt Bilder aus Pfaden und uploaded sie zu imgbb, gibt URLs zurück
 */
export async function extractReferenceImagesFromProfile(
  profile: {
    referenceImages: {
      frontal?: string
      profileLeft?: string
      profileRight?: string
      threeQuarter?: string
      fullBody?: string
    }
    allReferenceImages?: string[]
    referenceImagePaths?: string[]
  }
): Promise<string[]> {
  // Wenn Pfade vorhanden, lade Bilder aus public-Ordner und upload zu imgbb
  if (profile.referenceImagePaths && profile.referenceImagePaths.length > 0) {
    console.log('📂 Lade Referenzbilder aus Pfaden:', profile.referenceImagePaths)

    logger.info('Lade Referenzbilder aus Pfaden', {
      component: 'KieAiImage',
      data: { count: profile.referenceImagePaths.length }
    })

    // 1. Lade Bilder aus public-Ordner als Base64
    const imagePromises = profile.referenceImagePaths.map(async (filename) => {
      const url = `/reference-images/${filename}`
      console.log(`📥 Lade Bild: ${url}`)

      const response = await fetch(url)

      if (!response.ok) {
        console.error(`❌ Fehler beim Laden von ${url}: ${response.status}`)
        throw new Error(`Konnte Bild nicht laden: ${url}`)
      }

      const blob = await response.blob()
      console.log(`✅ Bild geladen: ${filename} (${blob.size} bytes)`)

      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => {
          const result = reader.result as string
          console.log(`🔄 Konvertiert zu Base64: ${filename} (${result.length} chars)`)
          resolve(result)
        }
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })
    })

    const base64Images = await Promise.all(imagePromises)
    console.log(`✅ Alle ${base64Images.length} Referenzbilder geladen`)

    // 2. Upload zu imgbb und erhalte URLs
    console.log('☁️ Lade Bilder zu imgbb hoch...')
    const imageUrls = await uploadImagesToImgbb(base64Images)
    console.log(`✅ Alle ${imageUrls.length} Bild-URLs erhalten:`, imageUrls)

    return imageUrls
  }

  // Wenn allReferenceImages vorhanden, upload zu imgbb
  if (profile.allReferenceImages && profile.allReferenceImages.length > 0) {
    console.log('☁️ Lade existierende Referenzbilder zu imgbb hoch...')
    return await uploadImagesToImgbb(profile.allReferenceImages)
  }

  // Sonst extrahiere die 5 spezifischen Bilder und upload zu imgbb
  const images: string[] = []
  const refs = profile.referenceImages

  if (refs.frontal) images.push(refs.frontal)
  if (refs.profileLeft) images.push(refs.profileLeft)
  if (refs.profileRight) images.push(refs.profileRight)
  if (refs.threeQuarter) images.push(refs.threeQuarter)
  if (refs.fullBody) images.push(refs.fullBody)

  if (images.length > 0) {
    console.log('☁️ Lade spezifische Referenzbilder zu imgbb hoch...')
    return await uploadImagesToImgbb(images)
  }

  return []
}
