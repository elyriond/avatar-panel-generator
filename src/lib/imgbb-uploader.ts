/**
 * imgbb Image Upload Service
 * Lädt Bilder zu imgbb hoch und gibt URLs zurück
 */

import { logger } from './logger'

const IMGBB_API_KEY = import.meta.env.VITE_IMGBB_API_KEY
const IMGBB_UPLOAD_URL = 'https://api.imgbb.com/1/upload'

if (!IMGBB_API_KEY) {
  console.warn('VITE_IMGBB_API_KEY ist nicht gesetzt')
}

/**
 * Lädt ein Bild zu imgbb hoch und gibt die URL zurück
 * @param base64Image - Base64-kodiertes Bild (mit oder ohne Data-URI Prefix)
 * @param name - Optional: Name für das Bild
 * @returns URL des hochgeladenen Bildes
 */
export async function uploadImageToImgbb(
  base64Image: string,
  name: string = 'reference'
): Promise<string> {
  try {
    // Entferne Data-URI Prefix falls vorhanden
    const base64Data = base64Image.startsWith('data:')
      ? base64Image.split(',')[1]
      : base64Image

    // Erstelle FormData
    const formData = new FormData()
    formData.append('key', IMGBB_API_KEY)
    formData.append('image', base64Data)
    formData.append('name', name)

    logger.info('Lade Bild zu imgbb hoch', {
      component: 'ImgbbUploader',
      data: { name, size: base64Data.length }
    })

    const response = await fetch(IMGBB_UPLOAD_URL, {
      method: 'POST',
      body: formData
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`imgbb Upload fehlgeschlagen: ${response.status} - ${errorText}`)
    }

    const data = await response.json()

    if (!data.success) {
      throw new Error(`imgbb Upload fehlgeschlagen: ${data.error?.message || 'Unbekannter Fehler'}`)
    }

    const imageUrl = data.data.url

    logger.info('Bild erfolgreich hochgeladen', {
      component: 'ImgbbUploader',
      data: { url: imageUrl }
    })

    return imageUrl
  } catch (error) {
    logger.error('Fehler beim imgbb Upload', {
      component: 'ImgbbUploader',
      data: error
    })
    throw error
  }
}

/**
 * Lädt mehrere Bilder zu imgbb hoch (parallel)
 * @param base64Images - Array von Base64-kodierten Bildern
 * @returns Array von URLs
 */
export async function uploadImagesToImgbb(
  base64Images: string[]
): Promise<string[]> {
  console.log(`📤 Lade ${base64Images.length} Bilder zu imgbb hoch...`)

  logger.info('Lade mehrere Bilder zu imgbb hoch', {
    component: 'ImgbbUploader',
    data: { count: base64Images.length }
  })

  try {
    const uploadPromises = base64Images.map((img, index) =>
      uploadImageToImgbb(img, `reference-${index + 1}`)
    )

    const urls = await Promise.all(uploadPromises)

    console.log(`✅ Alle ${urls.length} Bilder hochgeladen`)
    logger.info('Alle Bilder erfolgreich hochgeladen', {
      component: 'ImgbbUploader',
      data: { count: urls.length }
    })

    return urls
  } catch (error) {
    logger.error('Fehler beim Upload mehrerer Bilder', {
      component: 'ImgbbUploader',
      data: error
    })
    throw error
  }
}
