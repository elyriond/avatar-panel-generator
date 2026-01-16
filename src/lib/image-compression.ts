/**
 * Bildkompression für LocalStorage-Optimierung
 * Reduziert Dateigröße durch Skalierung und Qualitätsreduktion
 */

import { logger } from './logger'

interface CompressionOptions {
  maxWidth?: number
  maxHeight?: number
  quality?: number // 0-1
}

const DEFAULT_OPTIONS: CompressionOptions = {
  maxWidth: 800,
  maxHeight: 800,
  quality: 0.8
}

/**
 * Komprimiert ein Bild-File und gibt Base64 zurück
 */
export async function compressImage(
  file: File,
  options: CompressionOptions = {}
): Promise<string> {
  const opts = { ...DEFAULT_OPTIONS, ...options }

  logger.debug('Komprimiere Bild', {
    component: 'ImageCompression',
    data: {
      fileName: file.name,
      originalSize: `${(file.size / 1024).toFixed(2)} KB`,
      maxWidth: opts.maxWidth,
      quality: opts.quality
    }
  })

  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      const img = new Image()

      img.onload = () => {
        try {
          // Berechne neue Dimensionen (aspect ratio beibehalten)
          let width = img.width
          let height = img.height

          if (width > opts.maxWidth! || height > opts.maxHeight!) {
            const aspectRatio = width / height

            if (width > height) {
              width = opts.maxWidth!
              height = width / aspectRatio
            } else {
              height = opts.maxHeight!
              width = height * aspectRatio
            }
          }

          // Canvas erstellen und Bild skalieren
          const canvas = document.createElement('canvas')
          canvas.width = width
          canvas.height = height

          const ctx = canvas.getContext('2d')
          if (!ctx) {
            throw new Error('Canvas context nicht verfügbar')
          }

          // Bild auf Canvas zeichnen (skaliert)
          ctx.drawImage(img, 0, 0, width, height)

          // Als JPEG mit reduzierter Qualität exportieren
          const compressedBase64 = canvas.toDataURL('image/jpeg', opts.quality)

          // Größenvergleich loggen
          const originalSizeKB = file.size / 1024
          const compressedSizeKB = (compressedBase64.length * 0.75) / 1024 // Base64 ist ~33% größer
          const savings = ((1 - compressedSizeKB / originalSizeKB) * 100).toFixed(1)

          logger.info('Bild erfolgreich komprimiert', {
            component: 'ImageCompression',
            data: {
              fileName: file.name,
              originalSize: `${originalSizeKB.toFixed(2)} KB`,
              compressedSize: `${compressedSizeKB.toFixed(2)} KB`,
              savings: `${savings}%`,
              dimensions: `${Math.round(width)}x${Math.round(height)}`
            }
          })

          resolve(compressedBase64)
        } catch (error) {
          logger.error('Fehler beim Komprimieren des Bildes', {
            component: 'ImageCompression',
            data: error
          })
          reject(error)
        }
      }

      img.onerror = () => {
        const error = new Error('Bild konnte nicht geladen werden')
        logger.error('Fehler beim Laden des Bildes', {
          component: 'ImageCompression',
          data: error
        })
        reject(error)
      }

      img.src = e.target?.result as string
    }

    reader.onerror = () => {
      const error = new Error('Datei konnte nicht gelesen werden')
      logger.error('Fehler beim Lesen der Datei', {
        component: 'ImageCompression',
        data: error
      })
      reject(error)
    }

    reader.readAsDataURL(file)
  })
}

/**
 * Komprimiert mehrere Bilder parallel
 */
export async function compressImages(
  files: File[],
  options?: CompressionOptions
): Promise<string[]> {
  logger.info(`Komprimiere ${files.length} Bilder`, {
    component: 'ImageCompression'
  })

  const promises = files.map(file => compressImage(file, options))
  return Promise.all(promises)
}

/**
 * Schätzt die Speichergröße eines Base64-Strings in KB
 */
export function estimateBase64Size(base64: string): number {
  // Base64 ist ~33% größer als die Original-Binärdaten
  // Jedes Zeichen ist 1 Byte
  return (base64.length * 0.75) / 1024
}

/**
 * Prüft, ob ein Base64-String das LocalStorage-Limit überschreiten würde
 */
export function wouldExceedQuota(base64Strings: string[]): boolean {
  const totalSizeKB = base64Strings.reduce(
    (sum, str) => sum + estimateBase64Size(str),
    0
  )

  // LocalStorage Limit: ~5 MB (vorsichtig geschätzt)
  const LOCALSTORAGE_LIMIT_KB = 5000

  logger.debug('Quota-Check', {
    component: 'ImageCompression',
    data: {
      totalSize: `${totalSizeKB.toFixed(2)} KB`,
      limit: `${LOCALSTORAGE_LIMIT_KB} KB`,
      wouldExceed: totalSizeKB > LOCALSTORAGE_LIMIT_KB
    }
  })

  return totalSizeKB > LOCALSTORAGE_LIMIT_KB
}

/**
 * Komprimiert ein Base64-Bild (für generierte Story-Panels)
 * Perfekt für Bilder die von KIE.AI kommen
 */
export async function compressBase64Image(
  base64: string,
  options: CompressionOptions = {}
): Promise<string> {
  const opts = { ...DEFAULT_OPTIONS, ...options }

  logger.debug('Komprimiere Base64-Bild', {
    component: 'ImageCompression',
    data: {
      originalSize: `${estimateBase64Size(base64).toFixed(2)} KB`,
      maxWidth: opts.maxWidth,
      quality: opts.quality
    }
  })

  return new Promise((resolve, reject) => {
    const img = new Image()

    img.onload = () => {
      try {
        // Berechne neue Dimensionen (aspect ratio beibehalten)
        let width = img.width
        let height = img.height

        if (width > opts.maxWidth! || height > opts.maxHeight!) {
          const aspectRatio = width / height

          if (width > height) {
            width = opts.maxWidth!
            height = width / aspectRatio
          } else {
            height = opts.maxHeight!
            width = height * aspectRatio
          }
        }

        // Canvas erstellen und Bild skalieren
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext('2d')
        if (!ctx) {
          throw new Error('Canvas context nicht verfügbar')
        }

        // Bild auf Canvas zeichnen (skaliert)
        ctx.drawImage(img, 0, 0, width, height)

        // Als JPEG mit reduzierter Qualität exportieren
        const compressedBase64 = canvas.toDataURL('image/jpeg', opts.quality)

        // Größenvergleich loggen
        const originalSizeKB = estimateBase64Size(base64)
        const compressedSizeKB = estimateBase64Size(compressedBase64)
        const savings = ((1 - compressedSizeKB / originalSizeKB) * 100).toFixed(1)

        logger.info('Base64-Bild erfolgreich komprimiert', {
          component: 'ImageCompression',
          data: {
            originalSize: `${originalSizeKB.toFixed(2)} KB`,
            compressedSize: `${compressedSizeKB.toFixed(2)} KB`,
            savings: `${savings}%`,
            dimensions: `${Math.round(width)}x${Math.round(height)}`
          }
        })

        resolve(compressedBase64)
      } catch (error) {
        logger.error('Fehler beim Komprimieren des Base64-Bildes', {
          component: 'ImageCompression',
          data: error
        })
        reject(error)
      }
    }

    img.onerror = () => {
      const error = new Error('Base64-Bild konnte nicht geladen werden')
      logger.error('Fehler beim Laden des Base64-Bildes', {
        component: 'ImageCompression',
        data: error
      })
      reject(error)
    }

    img.src = base64
  })
}
