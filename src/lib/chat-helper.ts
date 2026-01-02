import { GoogleGenerativeAI } from '@google/generative-ai'
import { logger } from './logger'

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
}

export interface PanelData {
  text: string
  scene: string
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
       generationConfig: { responseMimeType: "application/json" }
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

 * Generiert einen detaillierten Image-Prompt für KIE.AI

 */

export async function generateImagePrompt(

  panelData: PanelData,

  previousContext: string = ''

): Promise<string> {

  logger.apiCall('gemini-2.5-flash-preview-09-2025', 'generateImagePrompt', {

    panelTextLength: panelData.text.length,

    sceneDescriptionLength: panelData.scene.length,

    contextLength: previousContext.length

  })



  try {

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-preview-09-2025' })



    // Template-Variablen ersetzen

    const prompt = imageGenerationPromptTemplate

      .replace('{{PANEL_TEXT}}', panelData.text)

      .replace('{{SCENE_DESCRIPTION}}', panelData.scene)

      .replace('{{PREVIOUS_CONTEXT}}', previousContext || 'None (First Panel)')



    const result = await model.generateContent(prompt)

    const imagePromptText = result.response.text().trim()



    logger.apiResponse('gemini-2.0-flash-exp', 200, {

      imagePromptLength: imagePromptText.length

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
