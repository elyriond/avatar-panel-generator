import { GoogleGenerativeAI } from '@google/generative-ai'
import { getAvatars } from './avatar-storage'

export interface EmotionResult {
  emotion: string
  confidence: number
}

export interface StoryPanel {
  text: string
  emotion: string
  panelNumber: number
  // Individuelle Einstellungen pro Panel
  backgroundColor?: string
  avatarPosition?: 'bottom-center' | 'bottom-right' | 'left' | 'right'
  removeBackground?: boolean
  customFontSize?: number // Optional: Benutzerdefinierte Schriftgröße
  selectedAvatarId?: string // Optional: Manuell ausgewählter Avatar (überschreibt emotion)
}

let genAI: GoogleGenerativeAI | null = null

function getGeminiClient(): GoogleGenerativeAI {
  if (!genAI) {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY

    if (!apiKey) {
      throw new Error(
        'Gemini API Key fehlt! Bitte füge VITE_GEMINI_API_KEY in die .env Datei ein.'
      )
    }

    genAI = new GoogleGenerativeAI(apiKey)
  }

  return genAI
}

/**
 * Erkennt die Emotion in einem Text basierend auf verfügbaren Avataren
 */
export async function detectEmotion(text: string): Promise<string> {
  try {
    const avatars = getAvatars()

    if (avatars.length === 0) {
      throw new Error('Keine Avatare verfügbar')
    }

    const availableEmotions = avatars.map(a => a.emotion)

    const genAI = getGeminiClient()
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

    const prompt = `Analysiere den folgenden Text und bestimme die Haupt-Emotion oder Körperhaltung, die am besten passt.

Text: "${text}"

Verfügbare Emotionen/Posen: ${availableEmotions.join(', ')}

Antworte NUR mit dem Namen der passenden Emotion, nichts anderes.
Wenn keine Emotion stark erkennbar ist, wähle die neutralste Option aus der Liste.`

    const result = await model.generateContent(prompt)
    const response = result.response
    const emotionText = response.text().trim().toLowerCase()

    // Finde die am besten passende Emotion aus der Liste
    const matchedEmotion = availableEmotions.find(
      e => e.toLowerCase() === emotionText
    )

    return matchedEmotion || availableEmotions[0]
  } catch (error) {
    console.error('Fehler bei der Emotions-Erkennung:', error)
    // Fallback: erste verfügbare Emotion
    const avatars = getAvatars()
    return avatars.length > 0 ? avatars[0].emotion : 'neutral'
  }
}

/**
 * Teilt eine lange Story in mehrere Panels auf und erkennt Emotionen
 */
export async function splitStoryIntoPanels(
  story: string,
  numPanels: number = 5
): Promise<StoryPanel[]> {
  try {
    const genAI = getGeminiClient()
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

    const prompt = `Teile die folgende Geschichte in ${numPanels} Instagram-Panels auf. Jedes Panel sollte einen Teil der Geschichte erzählen und etwa gleich lang sein (ca. 15-30 Wörter pro Panel).

Geschichte:
"${story}"

Format: Gib NUR die ${numPanels} Panel-Texte zurück, getrennt durch "---" (drei Bindestriche). Keine zusätzlichen Erklärungen.

Beispiel:
Text für Panel 1
---
Text für Panel 2
---
Text für Panel 3`

    const result = await model.generateContent(prompt)
    const response = result.response
    const responseText = response.text()

    // Panels extrahieren
    const panelTexts = responseText
      .split('---')
      .map(text => text.trim())
      .filter(text => text.length > 0)
      .slice(0, numPanels)

    // Für jeden Panel die Emotion erkennen
    const panels: StoryPanel[] = await Promise.all(
      panelTexts.map(async (text, index) => {
        const emotion = await detectEmotion(text)
        return {
          text,
          emotion,
          panelNumber: index + 1
        }
      })
    )

    return panels
  } catch (error) {
    console.error('Detaillierter Fehler beim Aufteilen der Story:', error)
    // Gib den echten Fehler weiter, damit wir ihn sehen können
    if (error instanceof Error) {
      throw new Error(`Gemini API Fehler: ${error.message}`)
    }
    throw error
  }
}
