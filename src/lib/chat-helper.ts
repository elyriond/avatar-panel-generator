import { GoogleGenerativeAI } from '@google/generative-ai'
import { logger } from './logger'
import { detectCameraAngle, getAngleGuidance, type CameraAngle } from './angle-detector'

// Raw imports of prompt templates
import systemPromptTemplate from '../../prompts/system-prompt.txt?raw'
import panelGenerationPromptTemplate from '../../prompts/panel-generation-prompt.txt?raw'
import imageGenerationPromptTemplate from '../../prompts/image-generation-prompt.txt?raw'

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY

if (!API_KEY) {
  throw new Error('VITE_GEMINI_API_KEY ist nicht gesetzt. Bitte in .env.local hinzufügen.')
}

const genAI = new GoogleGenerativeAI(API_KEY)

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  image?: string  // Optional: Base64-Bild für Panel-Editing
}

export interface PanelData {
  text: string          // Deutscher Panel-Text (150-200 Zeichen)
  scene: string         // Englische Szenen-Beschreibung für Image-Generation
  characters: string[]  // Charaktere die in diesem Panel erscheinen (z.B. ["Theresa"], ["Theresa", "Ben"])
}

/**
 * Startet eine neue Chat-Session und gibt die erste Begrüßung zurück
 */
export async function startChatSession(customSystemPrompt?: string): Promise<string> {
  logger.apiCall('gemini-2.5-flash-preview-09-2025', 'startChatSession')

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-preview-09-2025' })

    const systemPrompt = customSystemPrompt || systemPromptTemplate

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
  logger.apiCall('gemini-2.5-flash-preview-09-2025', 'sendChatMessage',
    {
      historyLength: history.length,
      messageLength: userMessage.length
    }
  )

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-preview-09-2025' })

    const systemPrompt = customSystemPrompt || systemPromptTemplate

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
 * Generiert aus der Chat-Historie Panel-Texte UND Szenenbeschreibungen
 */
export async function generatePanelsFromChat(
  history: ChatMessage[],
  numPanels: number
): Promise<PanelData[]> {
  logger.apiCall('gemini-2.5-flash-preview-09-2025', 'generatePanelsFromChat',
    {
      historyLength: history.length,
      numPanels
    }
  )

  try {
    const model = genAI.getGenerativeModel({
       model: 'gemini-2.5-flash-preview-09-2025',
       generationConfig: { 
         responseMimeType: "application/json",
         temperature: 0.7 
       }
    })

    const conversationText = history
      .map(msg => `${msg.role === 'user' ? 'Nutzerin' : 'Beraterin'}: ${msg.content}`)
      .join('\n\n')

    // Template-Variablen ersetzen
    const prompt = panelGenerationPromptTemplate
      .replace('{{CONVERSATION_TEXT}}', conversationText)
      .replace('{{NUM_PANELS}}', numPanels.toString())
      .replace(/{{NUM_PANELS}}/g, numPanels.toString())

    const result = await model.generateContent(prompt)
    const panels = JSON.parse(result.response.text()) as PanelData[]

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
 * Generiert einen detaillierten Image-Prompt für KIE.AI mit Kamera-Winkel-Erkennung
 *
 * @returns Object mit { prompt: string, detectedAngle: CameraAngle }
 */

export async function generateImagePrompt(
  panelData: PanelData,
  previousContext: string = '',
  characterProfiles?: Map<string, any>  // Optional: Character-Profile für Beschreibungen
): Promise<{ prompt: string; detectedAngle: CameraAngle }> {
  logger.apiCall('gemini-2.5-flash-preview-09-2025', 'generateImagePrompt', {
    panelTextLength: panelData.text.length,
    sceneDescriptionLength: panelData.scene.length,
    contextLength: previousContext.length,
    characters: panelData.characters
  })

  try {
    // STEP 1: Detect camera angle from scene description
    const angleInfo = detectCameraAngle(panelData.scene)

    logger.info(`📐 Detected camera angle: ${angleInfo.angle}`, {
      component: 'ChatHelper',
      data: {
        confidence: angleInfo.confidence,
        keywords: angleInfo.keywords,
        scenePreview: panelData.scene.substring(0, 100)
      }
    })

    // STEP 2: Get angle guidance text
    const angleGuidance = getAngleGuidance(angleInfo.angle)

    // STEP 3: Enhance scene description with explicit angle instruction
    const enhancedScene = `${panelData.scene}\n\n🎥 CAMERA ANGLE: ${angleGuidance}`

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash-preview-09-2025',
      generationConfig: { temperature: 0.7 }
    })

    // Character-Beschreibungen aus Profilen extrahieren
    let characterDescriptions = ''
    if (panelData.characters && panelData.characters.length > 0 && characterProfiles) {
      const descriptions = panelData.characters
        .map((charName, index) => {
          const profile = characterProfiles.get(charName)
          if (profile && profile.physicalDescription) {
            return `CHARACTER ${index + 1} - ${charName}: ${profile.physicalDescription}`
          }
          return null
        })
        .filter(Boolean)
        .join('\n')

      characterDescriptions = descriptions || 'No character descriptions available.'
    } else {
      characterDescriptions = 'No character information provided.'
    }

    // Template-Variablen ersetzen (use enhancedScene with angle guidance)
    const prompt = imageGenerationPromptTemplate
      .replace('{{PANEL_TEXT}}', panelData.text)
      .replace('{{SCENE_DESCRIPTION}}', enhancedScene)  // Enhanced with angle!
      .replace('{{PREVIOUS_CONTEXT}}', previousContext || 'None (First Panel)')
      .replace('{{CHARACTER_DESCRIPTIONS}}', characterDescriptions)

    const result = await model.generateContent(prompt)
    const imagePromptText = result.response.text().trim()

    logger.apiResponse('gemini-2.0-flash-exp', 200, {
      imagePromptLength: imagePromptText.length,
      detectedAngle: angleInfo.angle
    })

    return {
      prompt: imagePromptText,
      detectedAngle: angleInfo.angle
    }
  } catch (error) {
    logger.error('Fehler beim Generieren des Image-Prompts', {
      component: 'ChatHelper',
      data: error
    })
    throw error
  }
}

/**
 * Interpretiert User-Feedback und verbessert die Scene Description
 * Übersetzt natürliche Sprache in technische Bild-Anweisungen
 */
export async function interpretFeedbackForSceneImprovement(
  currentScene: string,
  userFeedback: string
): Promise<string> {
  logger.apiCall('gemini-2.5-flash-preview-09-2025', 'interpretFeedbackForSceneImprovement', {
    currentSceneLength: currentScene.length,
    feedbackLength: userFeedback.length
  })

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash-preview-09-2025',
      generationConfig: { temperature: 0.6 }  // Etwas niedriger für präzisere Interpretation
    })

    const prompt = `Du bist ein Experte für Bild-Prompt-Engineering.

AKTUELLE SCENE DESCRIPTION (Englisch):
${currentScene}

USER FEEDBACK (kann Deutsch oder Englisch sein):
"${userFeedback}"

DEINE AUFGABE:
Verstehe das User-Feedback und erstelle eine VERBESSERTE Scene Description auf Englisch, die:
1. Die technischen Details des User-Feedbacks präzise umsetzt
2. Die ursprüngliche Scene Description beibehält (sofern nicht widersprochen)
3. Konkrete, umsetzbare Anweisungen für einen Image-Generator enthält

BEISPIELE:
- Feedback: "Der Avatar sieht nicht ähnlich aus"
  → Verbessert: "${currentScene}. CRITICAL: Match facial features exactly from reference images, ensure consistent face structure, maintain glasses style."

- Feedback: "Zu dunkel, bitte heller"
  → Verbessert: "${currentScene}. Bright lighting, light background, cheerful atmosphere, avoid shadows."

- Feedback: "Mehr lächeln"
  → Verbessert: "${currentScene.replace(/expression[^.]*/, '')} Warm, genuine smile, happy facial expression, friendly demeanor."

- Feedback: "Anderer Gesichtsausdruck, ernster"
  → Verbessert: "${currentScene.replace(/expression[^.]*/, '')} Serious facial expression, focused look, professional demeanor."

WICHTIG:
- Antworte NUR mit der verbesserten Scene Description (Englisch)
- Keine Erklärungen, kein Markdown
- Sei konkret und technisch präzise
- Behalte den visuellen Stil bei (comic illustration, etc.)

VERBESSERTE SCENE DESCRIPTION:`

    const result = await model.generateContent(prompt)
    const improvedScene = result.response.text().trim()

    logger.apiResponse('gemini-2.0-flash-exp', 200, {
      improvedSceneLength: improvedScene.length
    })

    logger.info('Feedback interpretiert und Scene verbessert', {
      component: 'ChatHelper',
      data: {
        originalLength: currentScene.length,
        improvedLength: improvedScene.length,
        feedback: userFeedback.substring(0, 50)
      }
    })

    return improvedScene

  } catch (error) {
    logger.error('Fehler bei Feedback-Interpretation', {
      component: 'ChatHelper',
      data: error
    })
    // Fallback: Original Scene + Feedback anhängen
    return `${currentScene}. User feedback: ${userFeedback}`
  }
}

/**
 * Generiert Instagram Caption und Hashtags basierend auf dem Storyboard
 */
export async function generateInstagramCaptionAndHashtags(
  storyboard: Array<{ text: string; scene: string }>,
  storyTitle?: string
): Promise<{ caption: string; hashtags: string }> {
  logger.apiCall('gemini-2.5-flash-preview-09-2025', 'generateInstagramCaptionAndHashtags')

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-preview-09-2025' })

    // Erstelle Zusammenfassung der Story für den Prompt
    const storyContext = storyboard.map((panel, i) =>
      `Panel ${i + 1}: "${panel.text}"`
    ).join('\n')

    const prompt = `Du bist ein Social Media Experte für Instagram im Mental Health / Therapie Bereich mit psychologischem Hintergrundwissen.

STORY-KONTEXT:
${storyTitle ? `Titel: ${storyTitle}\n` : ''}
${storyContext}

AUFGABE:
Erstelle eine informative, wertvolle Instagram Caption und Hashtags für dieses Comic-Karussell.

CAPTION-ANFORDERUNGEN:

**STRUKTUR (8-12 Sätze):**
1. **Hook (1-2 Sätze)**: Relatable Einstieg, macht neugierig
2. **Story-Kontext (2-3 Sätze)**: Bezug zum Comic, persönlicher Einblick
3. **MINI-THEORIE-TEIL (3-5 Sätze)**:
   - Erkläre relevante Fachbegriffe verständlich (z.B. "Co-Regulation", "Hochsensibilität", "Grenzen setzen")
   - Gib psychologischen Kontext
   - Mache Zusammenhänge klar
   - Nutze Absätze für bessere Lesbarkeit
4. **Buchtipp (OPTIONAL, 1-2 Sätze)**:
   - Nur wenn es ein passendes Buch zum Thema gibt
   - Format: "📚 Buchtipp: [Titel] von [Autor/in]"
   - Kurz erklären warum das Buch hilfreich ist
5. **Call-to-Action (1 Satz)**: Frage an Community oder Reflection-Prompt

**TON & STIL:**
- Authentisch, warm, professionell aber zugänglich
- Nicht zu therapeutisch-formell, aber auch nicht zu casual
- Bildungsorientiert: Vermittle Wissen verständlich
- Nutze Absätze (\\n\\n) für Struktur und Lesbarkeit
- Zielgruppe: Hochsensible Menschen, Mental Health Community, Menschen die mehr lernen wollen

**BEISPIEL-CAPTION:**
"Kennst du das Gefühl, wenn alles zu viel wird? Mir passiert das regelmäßig – und ich bin Therapeutin. 😅

In solchen Momenten hilft mir Co-Regulation: Das ist die Fähigkeit, gemeinsam mit einer vertrauten Person wieder in Balance zu kommen. Unser Nervensystem kann sich am Nervensystem eines anderen Menschen "orientieren" und dadurch beruhigen.

📚 Buchtipp: "Polyvagal-Theorie" von Stephen Porges erklärt, warum soziale Verbindung so heilsam ist.

💭 Wer ist deine "sichere Basis", wenn alles zu viel wird?"

HASHTAG-ANFORDERUNGEN:
- 20-25 Hashtags
- Mix aus großen (#mentalhealth), mittleren (#hochsensibel) und Nischen-Hashtags
- Relevant für Hochsensibilität, Grenzen setzen, Selbstfürsorge, Therapie
- Deutsche und englische Hashtags gemischt
- Format: Alle Hashtags in einer Zeile, durch Leerzeichen getrennt

AUSGABEFORMAT (exakt so):
CAPTION:
[deine Caption hier mit \\n\\n für Absätze]

HASHTAGS:
[alle Hashtags in einer Zeile]

WICHTIG: Keine Erklärungen, keine Markdown-Formatierung, nur Caption und Hashtags wie oben beschrieben.`

    const result = await model.generateContent(prompt)
    const response = result.response.text().trim()

    // Parse Response
    const captionMatch = response.match(/CAPTION:\s*\n([\s\S]+?)\n\nHASHTAGS:/i)
    const hashtagsMatch = response.match(/HASHTAGS:\s*\n(.+)/i)

    const caption = captionMatch ? captionMatch[1].trim() : ''
    const hashtags = hashtagsMatch ? hashtagsMatch[1].trim() : ''

    logger.apiResponse('gemini-2.5-flash-preview-09-2025', 200, {
      captionLength: caption.length,
      hashtagCount: hashtags.split(' ').length
    })

    logger.info('Instagram Caption & Hashtags generiert', {
      component: 'ChatHelper',
      data: {
        captionLength: caption.length,
        hashtagCount: hashtags.split(' ').filter(h => h.startsWith('#')).length
      }
    })

    return { caption, hashtags }

  } catch (error) {
    logger.error('Fehler bei Caption/Hashtag-Generierung', {
      component: 'ChatHelper',
      data: error
    })

    // Fallback: Einfache Caption + Standard-Hashtags
    return {
      caption: storyTitle || 'Neue Story 💙\n\nKennst du das?\n\n💭 Wie geht es dir damit?',
      hashtags: '#hochsensibel #hsp #mentalhealth #selfcare #psychologie #grenzensetzen #selbstfürsorge #therapy #mentalhealthawareness #emotions #feelings #boundaries #mindfulness #achtsamkeit #emotionalhealth #sensitive #empathisch #innerearbeit #healing #mentalwellness'
    }
  }
}
