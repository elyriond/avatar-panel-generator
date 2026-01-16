/**
 * Character Registry
 * Zentrale Verwaltung aller verfügbaren Character-Profile
 */

import type { CharacterProfile } from './character-profile'

/**
 * Theresa's Character Profile
 */
export const THERESA_PROFILE: CharacterProfile = {
  id: 'theresa',
  name: 'Theresa',
  createdAt: new Date(),
  lastUpdatedAt: new Date(),

  referenceImages: {},

  // Pfade zu Referenzbildern (4x dasselbe Bild für maximale Consistency)
  referenceImagePaths: [
    'ref-1.jpg',
    'ref-1.jpg',
    'ref-1.jpg',
    'ref-1.jpg'
  ],

  // Physische Beschreibung für Image-Prompts
  physicalDescription: `Woman in early 40s. Light blonde hair tied back in a low bun with side-swept wispy bangs. Large round to slightly panto-shaped full-rim glasses in matte black acetate, modern retro style. Plain black long-sleeve crew-neck sweater, casual minimal style.`,

  aiModel: 'nano-banana-pro',

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

/**
 * Ben's Character Profile
 */
export const BEN_PROFILE: CharacterProfile = {
  id: 'ben',
  name: 'Ben',
  createdAt: new Date(),
  lastUpdatedAt: new Date(),

  referenceImages: {},

  // Pfad zu Referenzbild (4x dasselbe Bild für maximale Consistency)
  referenceImagePaths: [
    'ben-ref.jpg', // Wird aus /Avatare/Ben/Extreme close-up comic.jpg geladen
    'ben-ref.jpg',
    'ben-ref.jpg',
    'ben-ref.jpg'
  ],

  // Physische Beschreibung für Image-Prompts
  physicalDescription: `Man in mid 30s. Short dark brown hair, casual style. Friendly, approachable appearance. Casual clothing, modern style.`,

  aiModel: 'nano-banana-pro',

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

/**
 * Registry aller verfügbaren Charaktere
 */
export const CHARACTER_REGISTRY: Record<string, CharacterProfile> = {
  'Theresa': THERESA_PROFILE,
  'Ben': BEN_PROFILE
}

/**
 * Lädt ein Character-Profile nach Name
 */
export function getCharacterProfile(name: string): CharacterProfile | null {
  return CHARACTER_REGISTRY[name] || null
}

/**
 * Lädt mehrere Character-Profiles nach Namen
 */
export function getCharacterProfiles(names: string[]): CharacterProfile[] {
  return names
    .map(name => getCharacterProfile(name))
    .filter((profile): profile is CharacterProfile => profile !== null)
}

/**
 * Gibt alle verfügbaren Character-Namen zurück
 */
export function getAvailableCharacters(): string[] {
  return Object.keys(CHARACTER_REGISTRY)
}
