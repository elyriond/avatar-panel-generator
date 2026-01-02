import { GoogleGenerativeAI } from '@google/generative-ai'
import { logger } from './logger'

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY

if (!API_KEY) {
  throw new Error('VITE_GEMINI_API_KEY ist nicht gesetzt. Bitte in .env.local hinzufügen.')
}

const genAI = new GoogleGenerativeAI(API_KEY)

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

const SYSTEM_PROMPT = `Du bist eine einfühlsame, kreative Beraterin für therapeutische Instagram-Content-Entwicklung.

DEINE AUFGABE:
- Hilf der Nutzerin, Inhalte für Instagram-Story-Panels zu entwickeln
- Die Inhalte drehen sich um Psychotherapie, Hochsensibilität, Beziehungen und Nervensystem
- Stelle gezielte Fragen, um die Gedanken zu strukturieren
- Gib konkrete Vorschläge für Instagram-taugliche Formulierungen
- Sei warm, unterstützend und inspirierend

KONTEXT:
- Die Nutzerin ist Gestalttherapeutin und arbeitet mit hochsensiblen Menschen
- Instagram-Panels haben begrenzten Platz (ca. 150-200 Zeichen pro Panel)
- Die Inhalte sollen nahbar, persönlich und professionell sein
- Am Ende sollen 5-10 kurze Panel-Texte entstehen

STIL:
- Verwende weibliche, unterstützende Sprache
- Stelle offene Fragen, die zum Nachdenken anregen
- Hilf, komplexe therapeutische Konzepte einfach zu formulieren
- Ermutige authentische, persönliche Perspektiven

ABLAUF:
1. Verstehe das Thema: "Worüber möchtest du sprechen?"
2. Vertiefe: Stelle 2-3 gezielte Fragen
3. Strukturiere: "Lass uns das in Abschnitte gliedern"
4. Formuliere: Schlage konkrete Panel-Texte vor
5. Verfeinere: Reagiere auf Feedback

Antworte immer auf Deutsch. Sei prägnant aber herzlich.`

/**
 * Startet eine neue Chat-Session und gibt die erste Begrüßung zurück
 */
export async function startChatSession(customSystemPrompt?: string): Promise<string> {
  logger.apiCall('gemini-2.5-flash-preview-09-2025', 'startChatSession')

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-preview-09-2025' })

    const systemPrompt = customSystemPrompt || SYSTEM_PROMPT

    const chat = model.startChat({
      history: [],
    })

    const result = await chat.sendMessage(systemPrompt + '\n\nStarte jetzt die Konversation mit einer kurzen, herzlichen Begrüßung und stelle EINE offene Frage: \"Worüber möchtest du heute eine Story entwickeln?\" oder ähnlich. WICHTIG: Generiere KEINE eigenen Ideen, Vorschläge oder Beispiele. Warte auf die Antwort der Nutzerin.')

    const greeting = result.response.text()

    logger.apiResponse('gemini-2.0-flash-exp', 200, {
      responseLength: greeting.length
    })

    return greeting
  } catch (error) {
    logger.error('Fehler beim Starten der Chat-Session', {
      component: 'ChatHelper',
      data: error
    })
    throw error
  }
}

/**
 * Sendet eine Nachricht im Chat und bekommt Antwort
 */
export async function sendChatMessage(
  history: ChatMessage[],
  userMessage: string,
  customSystemPrompt?: string
): Promise<string> {
  logger.apiCall('gemini-2.5-flash-preview-09-2025', 'sendChatMessage', {
    historyLength: history.length,
    messageLength: userMessage.length
  })

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-preview-09-2025' })

    const systemPrompt = customSystemPrompt || SYSTEM_PROMPT

    // Konversations-Historie für Gemini formatieren
    const geminiHistory = [
      {
        role: 'user',
        parts: [{ text: systemPrompt }]
      },
      {
        role: 'model',
        parts: [{ text: 'Verstanden. Ich bin bereit, der Nutzerin zu helfen.' }]
      },
      ...history.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      }))
    ]

    const chat = model.startChat({
      history: geminiHistory,
    })

    const result = await chat.sendMessage(userMessage)
    const response = result.response.text()

    logger.apiResponse('gemini-2.0-flash-exp', 200, {
      responseLength: response.length
    })

    return response
  } catch (error) {
    logger.error('Fehler beim Senden der Nachricht', {
      component: 'ChatHelper',
      data: error
    })
    throw error
  }
}

/**
 * Generiert aus der Chat-Historie Panel-Texte
 */
export async function generatePanelsFromChat(
  history: ChatMessage[],
  numPanels: number
): Promise<string[]> {
  logger.apiCall('gemini-2.5-flash-preview-09-2025', 'generatePanelsFromChat', {
    historyLength: history.length,
    numPanels
  })

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-preview-09-2025' })

    const conversationText = history
      .map(msg => `${msg.role === 'user' ? 'Nutzerin' : 'Beraterin'}: ${msg.content}`)
      .join('\n\n')

    const prompt = `Basierend auf dieser Konversation über therapeutische Instagram-Inhalte:

${conversationText}

AUFGABE: Erstelle ${numPanels} kurze, prägnante Panel-Texte für Instagram-Story-Panels.

ANFORDERUNGEN:
- Jeder Panel-Text: 150-250 Zeichen (inkl. Leerzeichen)
- Sprache: Warm, nahbar, professionell
- Zielgruppe: Hochsensible Menschen, Therapie-Interessierte
- Themen: Hochsensibilität, Beziehungen, Nervensystem, Selbstfürsorge
- Stil: Persönlich, inspirierend, nicht zu akademisch

FORMAT:
Gib NUR die Panel-Texte zurück, jeder auf einer neuen Zeile, nummeriert 1-${numPanels}.
Keine zusätzlichen Erklärungen oder Kommentare.

Beispiel:
1. [Panel-Text hier]
2. [Panel-Text hier]
3. [Panel-Text hier]`

    const result = await model.generateContent(prompt)
    const responseText = result.response.text()

    // Parse die nummerierten Panel-Texte
    const panels = responseText
      .split('\n')
      .filter(line => line.trim().match(/^\d+\./))
      .map(line => line.replace(/^\d+\.\s*/, '').trim())

    logger.apiResponse('gemini-2.0-flash-exp', 200, {
      panelsGenerated: panels.length,
      expectedPanels: numPanels
    })

    if (panels.length !== numPanels) {
      logger.warn('Panel-Anzahl stimmt nicht überein', {
        component: 'ChatHelper',
        data: { expected: numPanels, actual: panels.length }
      })
    }

    return panels
  } catch (error) {
    logger.error('Fehler beim Generieren der Panels', {
      component: 'ChatHelper',
      data: error
    })
    throw error
  }
}

/**
 * Generiert einen detaillierten Image-Prompt für KIE.AI basierend auf Panel-Text und Chat-Kontext
 */
export async function generateImagePrompt(
  panelText: string,
  chatHistory: ChatMessage[],
  characterName: string,
  visualStyle: string,
  atmosphere: string
): Promise<string> {
  logger.apiCall('gemini-2.5-flash-preview-09-2025', 'generateImagePrompt', {
    panelTextLength: panelText.length,
    historyLength: chatHistory.length,
    characterName
  })

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-preview-09-2025' })

    // Relevanten Chat-Kontext extrahieren (letzte 6 Nachrichten)
    const recentHistory = chatHistory.slice(-6)
    const contextText = recentHistory
      .map(msg => `${msg.role === 'user' ? 'Nutzerin' : 'Beraterin'}: ${msg.content}`)
      .join('\n')

    const prompt = `Du bist ein Experte für Comic-Bild-Prompts. Erstelle einen detaillierten, visuellen Prompt für ein KI-Bild-Generator-Modell (Imagen 3) mit Character Consistency.

KONTEXT AUS DEM GESPRÄCH:
${contextText}

PANEL-TEXT (was im fertigen Comic stehen wird):
"${panelText}"

STIL-VORGABEN:
- Visueller Stil: ${visualStyle}
- Atmosphäre: ${atmosphere}

WICHTIG - CHARACTER CONSISTENCY:
Das Modell erhält REFERENZBILDER des Characters. Dein Prompt soll KEINE physischen Merkmale des Characters beschreiben (kein Alter, Geschlecht, Haare, Kleidung, etc.). Das Modell lernt das Aussehen aus den Referenzbildern.

DEINE AUFGABE:
Erstelle einen präzisen Bild-Prompt, der NUR diese Aspekte beschreibt:

1. **Pose und Körpersprache**
   - Was macht die Person? (Sitzt, steht, gestikuliert, lehnt sich an, etc.)
   - Körperhaltung (aufrecht, entspannt, zusammengekauert, etc.)
   - Arm-/Handposition (verschränkt, auf Herz, ausgestreckt, etc.)

2. **Gesichtsausdruck und Emotion**
   - Augen: offen/geschlossen, nach vorne/unten/zur Seite blickend
   - Mimik: entspannt, nachdenklich, überfordert, lächelnd, ernst, etc.
   - Emotionale Atmosphäre der Szene

3. **Kamerawinkel und Komposition**
   - Shot-Typ: close-up (Gesicht), medium shot (Oberkörper), full body shot, three-quarter body
   - Perspektive: frontal, im Profil, dreiviertel-Ansicht
   - Bildaufbau: zentriert, leicht versetzt, Freiraum für Text

4. **Setting & Hintergrund**
   - Minimalistisch und abstrakt (keine Details!)
   - Farben: warme Beigetöne, Pastellfarben, Gradienten
   - Einfache geometrische Formen oder einfarbiger Hintergrund
   - Passend zum therapeutischen Kontext

5. **Visuelle Metaphern** (optional)
   - Symbolische Elemente (z.B. sanftes Licht vom Herzen, Wellen, etc.)
   - Halte sie subtil und minimalistisch

STIL-ANFORDERUNGEN:
- Comic-Stil: ${visualStyle}
- Atmosphäre: ${atmosphere}
- Flat colors, clean lines
- Warme, beruhigende Farbpalette
- KEINE fotorealistischen Details

VERBOTEN (beschreibe NIEMALS):
❌ Alter, Geschlecht oder physische Merkmale der Person
❌ Haarfarbe, Haarlänge, Frisur
❌ Kleidungsstil oder Farben
❌ Hautfarbe oder ethnische Merkmale
❌ Namen oder Bezeichnungen ("Feinblick", "woman", "man", etc.)

BEISPIEL (GUT):
"Comic-style illustration. Medium shot, person sitting cross-legged on the floor, hands gently resting on knees, eyes closed in peaceful meditation. Calm, serene expression. Minimalist background with soft beige gradient (#e8dfd0 to #f5ebe0). Centered composition with space for text at top. Warm, therapeutic atmosphere. Flat color style, soft shadows."

ANTWORTE NUR MIT DEM FERTIGEN ENGLISCHEN BILD-PROMPT. KEINE ERKLÄRUNGEN.`

    const result = await model.generateContent(prompt)
    const imagePromptText = result.response.text().trim()

    logger.apiResponse('gemini-2.0-flash-exp', 200, {
      imagePromptLength: imagePromptText.length
    })

    logger.info('Image-Prompt generiert', {
      component: 'ChatHelper',
      data: {
        panelText: panelText.slice(0, 50) + '...',
        promptLength: imagePromptText.length
      }
    })

    return imagePromptText
  } catch (error) {
    logger.error('Fehler beim Generieren des Image-Prompts', {
      component: 'ChatHelper',
      data: error
    })
    throw error
  }
}
