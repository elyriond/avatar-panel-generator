/**
 * Camera Angle Detection & Reference Selection
 * Analyzes scene descriptions to detect camera angles and select appropriate reference images
 */

import { logger } from './logger'

export type CameraAngle =
  | 'frontal'
  | 'three_quarter_left'
  | 'three_quarter_right'
  | 'profile_left'
  | 'profile_right'
  | 'back'
  | 'overhead'
  | 'low_angle'
  | 'unknown'

export interface AngleDetectionResult {
  angle: CameraAngle
  confidence: number
  keywords: string[]
}

/**
 * Analyzes a scene description and detects the camera angle/view needed
 */
export function detectCameraAngle(sceneDescription: string): AngleDetectionResult {
  const scene = sceneDescription.toLowerCase()

  // Define keywords for each angle
  const anglePatterns: Record<CameraAngle, string[]> = {
    profile_left: [
      'profile', 'side view', 'from the side', 'from left side',
      'looking left', 'turns left', 'facing left', 'left profile',
      'left side view'
    ],
    profile_right: [
      'side view', 'from the side', 'from right side',
      'looking right', 'turns right', 'facing right', 'right profile',
      'right side view'
    ],
    three_quarter_left: [
      'three quarter left', '3/4 left', 'three-quarter left',
      'slightly turned left', 'angled left', 'turned to the left',
      'over left shoulder', 'quarter turn left'
    ],
    three_quarter_right: [
      'three quarter right', '3/4 right', 'three-quarter right',
      'slightly turned right', 'angled right', 'turned to the right',
      'over right shoulder', 'looking back', 'glancing back',
      'quarter turn right', 'over shoulder'
    ],
    back: [
      'from behind', 'back view', 'rear view', 'walking away',
      'turned away', 'back to camera', 'seen from behind'
    ],
    frontal: [
      'facing camera', 'looking at viewer', 'direct eye contact',
      'frontal view', 'straight on', 'faces forward', 'front view',
      'looking directly', 'straight ahead'
    ],
    overhead: [
      'overhead', 'top down', 'bird\'s eye', 'from above',
      'looking down at', 'aerial view'
    ],
    low_angle: [
      'low angle', 'from below', 'looking up', 'worm\'s eye',
      'shot from below'
    ],
    unknown: []
  }

  // Check each angle for keyword matches
  const matches: Array<{angle: CameraAngle, count: number, keywords: string[]}> = []

  for (const [angle, keywords] of Object.entries(anglePatterns)) {
    if (angle === 'unknown') continue

    const foundKeywords = keywords.filter(kw => scene.includes(kw))
    if (foundKeywords.length > 0) {
      matches.push({
        angle: angle as CameraAngle,
        count: foundKeywords.length,
        keywords: foundKeywords
      })
    }
  }

  // If no matches, default to frontal (most common)
  if (matches.length === 0) {
    logger.debug('No camera angle keywords found, defaulting to frontal', {
      component: 'AngleDetector',
      data: { scenePreview: sceneDescription.substring(0, 100) }
    })
    return {
      angle: 'frontal',
      confidence: 0.3,
      keywords: []
    }
  }

  // Sort by number of keyword matches (descending)
  matches.sort((a, b) => b.count - a.count)
  const bestMatch = matches[0]

  logger.info(`📐 Detected camera angle: ${bestMatch.angle}`, {
    component: 'AngleDetector',
    data: {
      confidence: Math.min(bestMatch.count * 0.3, 1.0),
      keywords: bestMatch.keywords
    }
  })

  return {
    angle: bestMatch.angle,
    confidence: Math.min(bestMatch.count * 0.3, 1.0),
    keywords: bestMatch.keywords
  }
}

/**
 * Parse filename to extract character name and angle
 *
 * Format: {characterName}_{angle}[_{variant}].{ext}
 * Examples:
 *   - theresa_frontal.jpg → { character: 'theresa', angle: 'frontal' }
 *   - theresa_profile_left.jpg → { character: 'theresa', angle: 'profile_left' }
 *   - ben_three_quarter_right.jpg → { character: 'ben', angle: 'three_quarter_right' }
 *   - theresa_frontal_smiling.jpg → { character: 'theresa', angle: 'frontal', variant: 'smiling' }
 */
export function parseReferenceFilename(filename: string): {
  character: string
  angle: CameraAngle
  variant?: string
} | null {
  // Remove file extension
  const nameWithoutExt = filename.replace(/\.[^.]+$/, '')

  // Split by underscores
  const parts = nameWithoutExt.split('_')

  if (parts.length < 2) {
    logger.warn(`Invalid reference filename format: ${filename}`, {
      component: 'AngleDetector'
    })
    return null
  }

  const character = parts[0].toLowerCase()

  // Try to match angle (could be one or two parts, e.g., "frontal" or "profile_left")
  const validAngles: CameraAngle[] = [
    'frontal',
    'profile_left',
    'profile_right',
    'three_quarter_left',
    'three_quarter_right',
    'back',
    'overhead',
    'low_angle'
  ]

  // Check if parts[1] + parts[2] form a valid angle (e.g., "profile" + "left")
  if (parts.length >= 3) {
    const twoPartAngle = `${parts[1]}_${parts[2]}` as CameraAngle
    if (validAngles.includes(twoPartAngle)) {
      return {
        character,
        angle: twoPartAngle,
        variant: parts.length > 3 ? parts.slice(3).join('_') : undefined
      }
    }
  }

  // Check if parts[1] is a valid single-part angle (e.g., "frontal")
  const singlePartAngle = parts[1] as CameraAngle
  if (validAngles.includes(singlePartAngle)) {
    return {
      character,
      angle: singlePartAngle,
      variant: parts.length > 2 ? parts.slice(2).join('_') : undefined
    }
  }

  logger.warn(`Unrecognized angle in filename: ${filename}`, {
    component: 'AngleDetector',
    data: { parts }
  })

  return null
}

/**
 * Get similar/related angles for fallback matching
 * Returns angles in order of similarity
 */
export function getSimilarAngles(angle: CameraAngle): CameraAngle[] {
  const similarityMap: Record<CameraAngle, CameraAngle[]> = {
    frontal: ['three_quarter_left', 'three_quarter_right'],
    three_quarter_left: ['frontal', 'profile_left'],
    three_quarter_right: ['frontal', 'profile_right'],
    profile_left: ['three_quarter_left', 'back'],
    profile_right: ['three_quarter_right', 'back'],
    back: ['profile_left', 'profile_right'],
    overhead: ['frontal'],
    low_angle: ['frontal'],
    unknown: ['frontal']
  }

  return similarityMap[angle] || ['frontal']
}

/**
 * Get human-readable camera angle guidance for prompts
 */
export function getAngleGuidance(angle: CameraAngle): string {
  const guidance: Record<CameraAngle, string> = {
    frontal: 'Character faces directly toward camera. Front view.',
    three_quarter_left: 'Character turned approximately 45° to the left. Three-quarter view.',
    three_quarter_right: 'Character turned approximately 45° to the right. Three-quarter view.',
    profile_left: 'Character shown from the left side. Full side profile view.',
    profile_right: 'Character shown from the right side. Full side profile view.',
    back: 'Character shown from behind. Back view.',
    overhead: 'Camera positioned above, looking down at character.',
    low_angle: 'Camera positioned below, looking up at character.',
    unknown: 'Camera angle unspecified - use natural framing.'
  }

  return guidance[angle] || guidance.unknown
}

/**
 * Select the best reference images for a given camera angle
 * Returns URLs in priority order (exact match first, then similar angles)
 *
 * @param angle - The detected camera angle
 * @param referencesByAngle - Map of angle -> array of image URLs
 * @param maxImages - Maximum number of references to return (default: 3)
 * @returns Array of reference image URLs
 */
export function selectReferencesForAngle(
  angle: CameraAngle,
  referencesByAngle: Map<CameraAngle, string[]>,
  maxImages: number = 3
): string[] {
  const selected: string[] = []

  logger.debug(`Selecting references for angle: ${angle}`, {
    component: 'AngleDetector',
    data: {
      availableAngles: Array.from(referencesByAngle.keys()),
      maxImages
    }
  })

  // Priority 1: Exact angle match
  const exactMatch = referencesByAngle.get(angle)
  if (exactMatch && exactMatch.length > 0) {
    const toAdd = Math.min(exactMatch.length, maxImages - selected.length)
    selected.push(...exactMatch.slice(0, toAdd))
    logger.debug(`Added ${toAdd} exact match refs for ${angle}`, {
      component: 'AngleDetector'
    })
  }

  // Priority 2: Similar angles (if we need more)
  if (selected.length < maxImages) {
    const similarAngles = getSimilarAngles(angle)
    for (const similarAngle of similarAngles) {
      const refs = referencesByAngle.get(similarAngle)
      if (refs && refs.length > 0) {
        const needed = maxImages - selected.length
        const toAdd = Math.min(refs.length, needed)
        selected.push(...refs.slice(0, toAdd))
        logger.debug(`Added ${toAdd} similar angle refs (${similarAngle})`, {
          component: 'AngleDetector'
        })
        if (selected.length >= maxImages) break
      }
    }
  }

  // Priority 3: Frontal as universal fallback
  if (selected.length < maxImages && angle !== 'frontal') {
    const frontal = referencesByAngle.get('frontal')
    if (frontal && frontal.length > 0) {
      const needed = maxImages - selected.length
      const toAdd = Math.min(frontal.length, needed)
      selected.push(...frontal.slice(0, toAdd))
      logger.debug(`Added ${toAdd} frontal fallback refs`, {
        component: 'AngleDetector'
      })
    }
  }

  logger.info(`✅ Selected ${selected.length} references for angle ${angle}`, {
    component: 'AngleDetector'
  })

  return selected
}
