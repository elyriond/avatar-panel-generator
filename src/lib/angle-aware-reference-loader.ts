/**
 * Angle-Aware Reference Image Loader
 * Loads reference images from filesystem and organizes them by camera angle
 */

import { logger } from './logger'
import { uploadImagesToImgbb } from './imgbb-uploader'
import {
  parseReferenceFilename,
  type CameraAngle
} from './angle-detector'

export interface AngleOrganizedReferences {
  characterName: string
  referencesByAngle: Map<CameraAngle, string[]>  // angle -> imgbb URLs
  allReferences: string[]  // All URLs (flat list for fallback)
  totalCount: number
}

/**
 * Load reference images from filesystem and organize by angle
 *
 * @param characterName - Name of the character (e.g., "Theresa", "Ben")
 * @param referenceFolder - Path to the folder containing reference images (default: "/reference-images")
 * @returns Organized references by angle, with imgbb URLs ready for KIE.AI
 */
export async function loadAngleOrganizedReferences(
  characterName: string,
  referenceFolder: string = '/reference-images'
): Promise<AngleOrganizedReferences> {
  logger.info(`📂 Loading angle-organized references for ${characterName}`, {
    component: 'AngleReferenceLoader',
    data: { characterName, referenceFolder }
  })

  try {
    // Step 1: Discover all image files in the reference folder
    const imageFiles = await discoverReferenceImages(referenceFolder, characterName)

    if (imageFiles.length === 0) {
      logger.warn(`No reference images found for ${characterName} in ${referenceFolder}`, {
        component: 'AngleReferenceLoader'
      })
      return {
        characterName,
        referencesByAngle: new Map(),
        allReferences: [],
        totalCount: 0
      }
    }

    logger.info(`Found ${imageFiles.length} reference images for ${characterName}`, {
      component: 'AngleReferenceLoader',
      data: { files: imageFiles }
    })

    // Step 2: Parse filenames and group by angle
    const imagesByAngle = new Map<CameraAngle, string[]>()  // angle -> filenames

    for (const filename of imageFiles) {
      const parsed = parseReferenceFilename(filename)

      if (!parsed) {
        logger.warn(`Skipping file with invalid format: ${filename}`, {
          component: 'AngleReferenceLoader'
        })
        continue
      }

      // Check if this file belongs to the requested character
      if (parsed.character.toLowerCase() !== characterName.toLowerCase()) {
        continue
      }

      // Group by angle
      if (!imagesByAngle.has(parsed.angle)) {
        imagesByAngle.set(parsed.angle, [])
      }
      imagesByAngle.get(parsed.angle)!.push(filename)
    }

    logger.info(`Organized into ${imagesByAngle.size} angle categories`, {
      component: 'AngleReferenceLoader',
      data: {
        angles: Array.from(imagesByAngle.keys()),
        countsPerAngle: Array.from(imagesByAngle.entries()).map(([angle, files]) => ({
          angle,
          count: files.length
        }))
      }
    })

    // Step 3: Load images as Base64
    const base64ByAngle = new Map<CameraAngle, string[]>()
    const allBase64Images: string[] = []

    for (const [angle, filenames] of imagesByAngle.entries()) {
      const base64Images: string[] = []

      for (const filename of filenames) {
        const url = `${referenceFolder}/${filename}`
        const base64 = await loadImageAsBase64(url)
        if (base64) {
          base64Images.push(base64)
          allBase64Images.push(base64)
        }
      }

      if (base64Images.length > 0) {
        base64ByAngle.set(angle, base64Images)
      }
    }

    logger.info(`✅ Loaded ${allBase64Images.length} base64 images`, {
      component: 'AngleReferenceLoader'
    })

    // Step 4: Upload all to imgbb (batch upload)
    logger.info('☁️ Uploading references to imgbb...', {
      component: 'AngleReferenceLoader'
    })

    const allUrls = await uploadImagesToImgbb(allBase64Images)

    logger.info(`✅ Uploaded ${allUrls.length} images to imgbb`, {
      component: 'AngleReferenceLoader'
    })

    // Step 5: Re-organize URLs by angle (maintain same order as base64)
    const urlsByAngle = new Map<CameraAngle, string[]>()
    let urlIndex = 0

    for (const [angle, base64Images] of base64ByAngle.entries()) {
      const urls = allUrls.slice(urlIndex, urlIndex + base64Images.length)
      urlsByAngle.set(angle, urls)
      urlIndex += base64Images.length
    }

    logger.info('✅ References organized by angle and ready for generation', {
      component: 'AngleReferenceLoader',
      data: {
        totalUrls: allUrls.length,
        angleBreakdown: Array.from(urlsByAngle.entries()).map(([angle, urls]) => ({
          angle,
          count: urls.length
        }))
      }
    })

    return {
      characterName,
      referencesByAngle: urlsByAngle,
      allReferences: allUrls,
      totalCount: allUrls.length
    }

  } catch (error) {
    logger.error(`Failed to load angle-organized references for ${characterName}`, {
      component: 'AngleReferenceLoader',
      data: error
    })
    // Return empty structure on error
    return {
      characterName,
      referencesByAngle: new Map(),
      allReferences: [],
      totalCount: 0
    }
  }
}

/**
 * Discover all image files in a folder that match a character name
 * This is a simple implementation that tries common patterns
 */
async function discoverReferenceImages(
  folderPath: string,
  characterName: string
): Promise<string[]> {
  // Common angle patterns
  const angles = [
    'frontal',
    'profile_left',
    'profile_right',
    'three_quarter_left',
    'three_quarter_right',
    'back',
    'overhead',
    'low_angle'
  ]

  const extensions = ['jpg', 'jpeg', 'png', 'webp']
  const imageFiles: string[] = []

  // Try to fetch each possible file pattern
  for (const angle of angles) {
    for (const ext of extensions) {
      // Try with just angle
      const filename = `${characterName.toLowerCase()}_${angle}.${ext}`
      const exists = await checkFileExists(`${folderPath}/${filename}`)
      if (exists) {
        imageFiles.push(filename)
      }

      // Try with variant patterns (e.g., theresa_frontal_smiling.jpg)
      // We'll try a few common variants
      const variants = ['smiling', 'neutral', 'thinking', 'speaking', '1', '2', '3']
      for (const variant of variants) {
        const variantFilename = `${characterName.toLowerCase()}_${angle}_${variant}.${ext}`
        const variantExists = await checkFileExists(`${folderPath}/${variantFilename}`)
        if (variantExists) {
          imageFiles.push(variantFilename)
        }
      }
    }
  }

  return imageFiles
}

/**
 * Check if a file exists (using fetch with HEAD request)
 */
async function checkFileExists(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: 'HEAD' })
    return response.ok
  } catch {
    return false
  }
}

/**
 * Load an image as Base64 string
 */
async function loadImageAsBase64(url: string): Promise<string | null> {
  try {
    const response = await fetch(url)

    if (!response.ok) {
      logger.warn(`Failed to load image: ${url} (${response.status})`, {
        component: 'AngleReferenceLoader'
      })
      return null
    }

    const blob = await response.blob()

    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        const result = reader.result as string
        resolve(result)
      }
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch (error) {
    logger.error(`Error loading image from ${url}`, {
      component: 'AngleReferenceLoader',
      data: error
    })
    return null
  }
}
