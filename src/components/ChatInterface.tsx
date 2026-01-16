import { useState, useEffect, useRef } from 'react'
import { Send, Loader2, Sparkles, Image as ImageIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { startChatSession, sendChatMessage, generatePanelsFromChat, generateInstagramCaptionAndHashtags, type ChatMessage, type PanelData } from '@/lib/chat-helper'
import { type ChatSession, addMessageToSession, updateChatSession } from '@/lib/chat-persistence'
import { type CharacterProfile, generateSystemPromptWithProfile } from '@/lib/character-profile'
import { generateCompleteStory, regenerateSinglePanel, editPanelWithImageToImage, estimateGenerationTime, type PanelGenerationProgress } from '@/lib/story-generator'
import { createStory, type ComicStory } from '@/lib/story-persistence'
import { StoryPreview } from '@/components/StoryPreview'
import { logger } from '@/lib/logger'

interface ChatInterfaceProps {
  numPanels: number
  session: ChatSession
  characterProfile: CharacterProfile | null
  onPanelsGenerated: (panels: string[]) => void
  onSessionUpdated: (session: ChatSession) => void
  onStoryCreated?: (story: ComicStory) => void
}

function isStoryboardMessage(content: string): boolean {
  try {
    // Versuche JSON zu parsen
    // Entferne mögliche Markdown Code Blocks falls vorhanden (sollte durch API Config nicht passieren, aber sicher ist sicher)
    const cleanContent = content.replace(/```json\n?|\n?```/g, '').trim()
    const data = JSON.parse(cleanContent)
    return Array.isArray(data) && data.length > 0 && 'text' in data[0] && 'scene' in data[0]
  } catch {
    return false
  }
}

export function ChatInterface({ numPanels, session, characterProfile, onPanelsGenerated, onSessionUpdated, onStoryCreated }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(session.messages)
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isGeneratingPanels, setIsGeneratingPanels] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Story-Generierung States
  const [isGeneratingStory, setIsGeneratingStory] = useState(false)
  const [storyProgress, setStoryProgress] = useState<PanelGenerationProgress | null>(null)
  const [generatedStory, setGeneratedStory] = useState<Omit<import('@/lib/story-persistence').StoryPanel, 'id' | 'generatedAt'>[] | null>(null)
  const [showStoryPreview, setShowStoryPreview] = useState(false)
  const [instagramCaption, setInstagramCaption] = useState<string | undefined>()
  const [instagramHashtags, setInstagramHashtags] = useState<string | undefined>()

  // Panel-Edit States
  const [editingPanelIndex, setEditingPanelIndex] = useState<number | null>(null)
  const [isRegeneratingPanel, setIsRegeneratingPanel] = useState(false)
  const [comparisonMode, setComparisonMode] = useState<{
    panelIndex: number
    oldPanel: Omit<import('@/lib/story-persistence').StoryPanel, 'id' | 'generatedAt'>
    newPanel: Omit<import('@/lib/story-persistence').StoryPanel, 'id' | 'generatedAt'>
  } | null>(null)

  // Prüfen ob die letzte Nachricht ein Storyboard ist
  const lastMessage = messages[messages.length - 1]
  const isStoryboardReady = lastMessage && lastMessage.role === 'assistant' && isStoryboardMessage(lastMessage.content)

  // Auto-scroll zu neuen Nachrichten
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Load session messages wenn Session wechselt
  useEffect(() => {
    logger.info('Session gewechselt', {
      component: 'ChatInterface',
      data: {
        sessionId: session.id,
        messageCount: session.messages.length
      }
    })
    setMessages(session.messages)
  }, [session.id])

  // Chat-Session starten wenn leer
  useEffect(() => {
    if (messages.length === 0) {
      const initChat = async () => {
        setIsLoading(true)
        try {
          // System-Prompt mit Character Profile generieren
          const systemPrompt = characterProfile
            ? generateSystemPromptWithProfile(characterProfile)
            : 'Du bist ein hilfreicher AI-Assistent für Instagram-Content.'

          const greeting = await startChatSession(systemPrompt)
          const greetingMessage: ChatMessage = {
            role: 'assistant',
            content: greeting,
            timestamp: new Date()
          }

          setMessages([greetingMessage])

          // In Session speichern
          const updatedSession = addMessageToSession(session.id, greetingMessage)
          if (updatedSession) {
            onSessionUpdated(updatedSession)
          }
        } catch (err) {
          console.error('Fehler beim Starten des Chats:', err)
          setError('Fehler beim Starten des Chats. Bitte lade die Seite neu.')
        } finally {
          setIsLoading(false)
        }
      }

      initChat()
    }
  }, [session.id, characterProfile])

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return

    const userMessage = inputValue.trim()
    setInputValue('')
    setError(null)

    // User-Nachricht hinzufügen
    const newUserMessage: ChatMessage = {
      role: 'user',
      content: userMessage,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, newUserMessage])

    // In Session speichern
    let updatedSession = addMessageToSession(session.id, newUserMessage)
    if (updatedSession) {
      onSessionUpdated(updatedSession)
    }

    // CHECK: Sind wir im Panel-Edit-Modus?
    if (editingPanelIndex !== null && generatedStory) {
      await handlePanelRegeneration(editingPanelIndex, userMessage)
      return
    }

    setIsLoading(true)

    try {
      const systemPrompt = characterProfile
        ? generateSystemPromptWithProfile(characterProfile)
        : undefined

      const assistantResponse = await sendChatMessage(messages, userMessage, systemPrompt)

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: assistantResponse,
        timestamp: new Date()
      }

      setMessages(prev => [...prev, assistantMessage])

      // In Session speichern
      updatedSession = addMessageToSession(session.id, assistantMessage)
      if (updatedSession) {
        onSessionUpdated(updatedSession)
      }
    } catch (err) {
      console.error('Fehler beim Senden der Nachricht:', err)
      setError('Fehler beim Senden der Nachricht. Bitte versuche es erneut.')
    } finally {
      setIsLoading(false)
    }
  }

  // Panel-Regenerierung mit User-Feedback
  const handlePanelRegeneration = async (panelIndex: number, userFeedback: string) => {
    if (!characterProfile || !generatedStory) return

    logger.userAction('ChatInterface', 'regenerate_single_panel', {
      panelIndex,
      feedback: userFeedback
    })

    setIsRegeneratingPanel(true)
    setError(null)

    try {
      // Hole das Storyboard aus dem Chat für allPanelData (Kontext)
      const storyboardMsg = messages.find(m => isStoryboardMessage(m.content))
      if (!storyboardMsg) {
        setError('Storyboard nicht gefunden. Bitte generiere die Story neu.')
        return
      }

      const panelDataList: PanelData[] = JSON.parse(
        storyboardMsg.content.replace(/```json\n?|\n?```/g, '').trim()
      )

      // WICHTIG: Nutze die AKTUELLE Scene Description aus dem generierten Panel
      // (nicht die ursprüngliche aus dem Storyboard)
      const currentPanel = generatedStory[panelIndex]
      const currentPanelData: PanelData = {
        text: currentPanel.panelText,
        scene: currentPanel.sceneDescription  // Aktuelle Scene (mit vorherigen Edits)
      }

      // Regeneriere NUR dieses eine Panel mit aktueller Scene + neuem Feedback
      const updatedPanel = await regenerateSinglePanel(
        panelIndex,
        currentPanelData,  // Nutze aktuelle Version statt Original
        panelDataList,
        characterProfile,
        '#e8dfd0',
        userFeedback
      )

      // Ersetze das Panel in der Story
      const updatedStory = [...generatedStory]
      updatedStory[panelIndex] = updatedPanel

      setGeneratedStory(updatedStory)

      // Erfolgsnachricht
      const successMessage: ChatMessage = {
        role: 'assistant',
        content: `✅ Panel ${panelIndex + 1} wurde neu generiert mit deinem Feedback!`,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, successMessage])

      // Zurück zur Preview & Edit-Modus deaktivieren
      setEditingPanelIndex(null)
      setShowStoryPreview(true)

    } catch (err) {
      console.error('Fehler bei Panel-Regenerierung:', err)
      setError(`Fehler bei Panel-Regenerierung: ${err instanceof Error ? err.message : 'Unbekannter Fehler'}`)
    } finally {
      setIsRegeneratingPanel(false)
    }
  }

  // SCHRITT 1: Storyboard vorschlagen (Text + Szenen)
  const handleProposeStory = async () => {
    if (messages.length < 3 || !characterProfile) return

    logger.userAction('ChatInterface', 'propose_story', {
      sessionId: session.id
    })

    setIsGeneratingPanels(true)
    setError(null)

    try {
      // Panel-Daten generieren (Text + Scene)
      const panelDataList = await generatePanelsFromChat(messages, numPanels)

      if (panelDataList.length === 0) throw new Error('Keine Panel-Daten generiert')

      // Als schöne JSON-Nachricht in den Chat posten
      const storyboardMessage: ChatMessage = {
        role: 'assistant',
        content: JSON.stringify(panelDataList, null, 2),
        timestamp: new Date()
      }

      setMessages(prev => [...prev, storyboardMessage])
      addMessageToSession(session.id, storyboardMessage)

      logger.info('Storyboard vorgeschlagen', {
        component: 'ChatInterface',
        data: { panelCount: panelDataList.length }
      })

    } catch (err) {
      console.error('Fehler beim Generieren des Storyboards:', err)
      setError(`Fehler beim Generieren des Storyboards: ${err instanceof Error ? err.message : 'Unbekannter Fehler'}`)
    } finally {
      setIsGeneratingPanels(false)
    }
  }

  // SCHRITT 2: Bilder generieren (basierend auf Chat-Storyboard)
  const handleGenerateImages = async () => {
    if (!isStoryboardReady || !characterProfile) return

    const lastMsg = messages[messages.length - 1]
    let panelDataList: PanelData[]
    try {
      panelDataList = JSON.parse(lastMsg.content.replace(/```json\n?|\n?```/g, '').trim())
    } catch (e) {
      setError('Fehler beim Lesen des Storyboards. Bitte generiere es neu.')
      return
    }

    logger.userAction('ChatInterface', 'generate_images_from_storyboard', {
      panelCount: panelDataList.length
    })

    setIsGeneratingStory(true)
    setError(null)
    setStoryProgress(null)

    try {
      // Callback für Parent (nur Text zur Info)
      onPanelsGenerated(panelDataList.map(p => p.text))

      // Komplette Story mit Avataren generieren (parallel)
      const storyPanels = await generateCompleteStory(
        panelDataList,
        characterProfile,
        '#e8dfd0',
        (progress) => {
          setStoryProgress(progress)
        }
      )

      setGeneratedStory(storyPanels)
      setShowStoryPreview(true)

      // Generiere Instagram Caption & Hashtags im Hintergrund
      try {
        logger.info('Generiere Instagram Caption & Hashtags im Hintergrund...', {
          component: 'ChatInterface'
        })

        const instagram = await generateInstagramCaptionAndHashtags(panelDataList, suggestedTitle)
        setInstagramCaption(instagram.caption)
        setInstagramHashtags(instagram.hashtags)

        logger.info('Instagram Content generiert', {
          component: 'ChatInterface',
          data: {
            captionLength: instagram.caption.length,
            hashtagCount: instagram.hashtags.split(' ').filter(h => h.startsWith('#')).length
          }
        })
      } catch (error) {
        logger.warn('Konnte Instagram Content nicht im Hintergrund generieren', {
          component: 'ChatInterface',
          data: error
        })
        // Nicht kritisch - Story ist trotzdem nutzbar
      }

    } catch (err) {
      console.error('Fehler bei Bild-Generierung:', err)
      setError(`Fehler bei Bild-Generierung: ${err instanceof Error ? err.message : 'Unbekannter Fehler'}`)
    } finally {
      setIsGeneratingStory(false)
      setStoryProgress(null)
    }
  }

  const handleStoryApprove = async (title: string, description?: string) => {
    if (!generatedStory || !characterProfile) return

    logger.userAction('ChatInterface', 'approve_story', {
      title,
      panelCount: generatedStory.length
    })

    try {
      // Extrahiere das Storyboard aus den Chat-Messages
      const storyboardMsg = messages.find(m => isStoryboardMessage(m.content))
      let originalStoryboard: Array<{ text: string; scene: string }>| undefined

      if (storyboardMsg) {
        try {
          originalStoryboard = JSON.parse(
            storyboardMsg.content.replace(/```json\n?|\n?```/g, '').trim()
          )
          logger.info('Storyboard aus Chat extrahiert', {
            component: 'ChatInterface',
            data: { panelCount: originalStoryboard?.length }
          })
        } catch (e) {
          logger.warn('Konnte Storyboard nicht extrahieren', {
            component: 'ChatInterface',
            data: e
          })
        }
      }

      // Nutze bereits generierte Instagram Caption & Hashtags (aus dem State)
      const story = await createStory(generatedStory, {
        title,
        description,
        characterProfileId: characterProfile.id,
        chatSessionId: session.id,
        tags: [],
        originalStoryboard,        // Speichere das Storyboard mit
        instagramCaption,          // Aus State (bereits generiert)
        instagramHashtags          // Aus State (bereits generiert)
      })

      // Alle Story-bezogenen States zurücksetzen
      setShowStoryPreview(false)
      setGeneratedStory(null)
      setInstagramCaption(undefined)
      setInstagramHashtags(undefined)
      setEditingPanelIndex(null)
      setIsRegeneratingPanel(false)
      setStoryProgress(null)

      // Erfolgs-Nachricht im Chat
      const successMessage: ChatMessage = {
        role: 'assistant',
        content: `✅ Story "${title}" wurde erfolgreich gespeichert! Du findest sie in der Galerie.`,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, successMessage])

      // In Session speichern
      const updatedSession = addMessageToSession(session.id, successMessage)
      if (updatedSession) {
        onSessionUpdated(updatedSession)
      }

      // Callback für Parent (wechselt zur Galerie)
      onStoryCreated?.(story)
    } catch (error) {
      logger.error('Fehler beim Speichern der Story', {
        component: 'ChatInterface',
        data: error
      })
      setError('Story konnte nicht gespeichert werden.')
    }
  }

  const handleStoryReject = () => {
    logger.userAction('ChatInterface', 'reject_story', {
      panelCount: generatedStory?.length || 0
    })

    // Alle Story-bezogenen States zurücksetzen
    setShowStoryPreview(false)
    setGeneratedStory(null)
    setInstagramCaption(undefined)
    setInstagramHashtags(undefined)
    setEditingPanelIndex(null)
    setIsRegeneratingPanel(false)
    setStoryProgress(null)

    // Bestätigungs-Nachricht im Chat
    const confirmMessage: ChatMessage = {
      role: 'assistant',
      content: '❌ Story verworfen. Du kannst jetzt eine neue Story erstellen.',
      timestamp: new Date()
    }
    setMessages(prev => [...prev, confirmMessage])

    // In Session speichern
    const updatedSession = addMessageToSession(session.id, confirmMessage)
    if (updatedSession) {
      onSessionUpdated(updatedSession)
    }
  }

  // Regeneriere Story mit gespeichertem Storyboard
  const handleRegenerateFromStoryboard = async () => {
    if (!characterProfile) return

    logger.userAction('ChatInterface', 'regenerate_from_storyboard')

    // Storyboard aus Messages holen
    const storyboardMsg = messages.find(m => isStoryboardMessage(m.content))
    if (!storyboardMsg) {
      setError('Storyboard nicht gefunden. Bitte generiere eine neue Story.')
      return
    }

    const panelDataList: PanelData[] = JSON.parse(
      storyboardMsg.content.replace(/```json\n?|\n?```/g, '').trim()
    )

    // Preview schließen, Generierung starten
    setShowStoryPreview(false)
    setIsGeneratingPanels(true)
    setIsGeneratingStory(true)
    setError(null)
    setStoryProgress(null)

    try {
      // Info-Nachricht
      const infoMessage: ChatMessage = {
        role: 'assistant',
        content: '♻️ Generiere Story neu mit dem gespeicherten Storyboard...',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, infoMessage])

      // Komplette Story neu generieren
      const storyPanels = await generateCompleteStory(
        panelDataList,
        characterProfile,
        '#e8dfd0',
        (progress) => {
          setStoryProgress(progress)
        }
      )

      setGeneratedStory(storyPanels)
      setShowStoryPreview(true)

      // Erfolg-Nachricht
      const successMessage: ChatMessage = {
        role: 'assistant',
        content: `✅ Story mit ${storyPanels.length} Panels erfolgreich neu generiert aus Storyboard!`,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, successMessage])

    } catch (err) {
      console.error('Fehler bei Storyboard-Regenerierung:', err)
      setError(`Fehler bei Storyboard-Regenerierung: ${err instanceof Error ? err.message : 'Unbekannter Fehler'}`)
    } finally {
      setIsGeneratingPanels(false)
      setIsGeneratingStory(false)
      setStoryProgress(null)
    }
  }

  // Panel-Edit-Handler
  const handleRegenerateAllPanels = async () => {
    if (!characterProfile) return

    logger.userAction('ChatInterface', 'regenerate_all_panels')

    // Storyboard aus Messages holen
    const storyboardMsg = messages.find(m => isStoryboardMessage(m.content))
    if (!storyboardMsg) {
      setError('Storyboard nicht gefunden. Bitte generiere die Story neu.')
      return
    }

    const panelDataList: PanelData[] = JSON.parse(
      storyboardMsg.content.replace(/```json\n?|\n?```/g, '').trim()
    )

    // Preview schließen, Generierung starten
    setShowStoryPreview(false)
    setIsGeneratingPanels(true)
    setIsGeneratingStory(true)
    setError(null)
    setStoryProgress(null)

    try {
      // Info-Nachricht
      const infoMessage: ChatMessage = {
        role: 'assistant',
        content: '🔄 Generiere komplette Story neu mit denselben Texten...',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, infoMessage])

      // Komplette Story neu generieren
      const storyPanels = await generateCompleteStory(
        panelDataList,
        characterProfile,
        '#e8dfd0',
        (progress) => {
          setStoryProgress(progress)
        }
      )

      setGeneratedStory(storyPanels)
      setShowStoryPreview(true)

      // Erfolg-Nachricht
      const successMessage: ChatMessage = {
        role: 'assistant',
        content: `✅ Story mit ${storyPanels.length} Panels erfolgreich neu generiert!`,
        timestamp: new Date()
      }
      setMessages(prev => [...prev, successMessage])

    } catch (err) {
      console.error('Fehler bei Neu-Generierung:', err)
      setError(`Fehler bei Neu-Generierung: ${err instanceof Error ? err.message : 'Unbekannter Fehler'}`)
    } finally {
      setIsGeneratingPanels(false)
      setIsGeneratingStory(false)
      setStoryProgress(null)
    }
  }

  const handlePanelEditRequest = async (panelIndex: number, userPrompt: string) => {
    if (!generatedStory || !characterProfile) return

    logger.userAction('ChatInterface', 'chat_panel_edit', {
      panelIndex,
      promptLength: userPrompt.length
    })

    setIsRegeneratingPanel(true)

    try {
      const oldPanel = generatedStory[panelIndex]

      // Image-to-Image Editing: Verwende aktuelles Panel-Bild als Basis
      const updatedPanel = await editPanelWithImageToImage(
        oldPanel.avatarBase64,
        userPrompt,
        characterProfile,
        oldPanel.panelText,
        oldPanel.backgroundColor
      )

      // Zeige Comparison Dialog
      setComparisonMode({
        panelIndex,
        oldPanel,
        newPanel: updatedPanel
      })

      logger.info('Panel erfolgreich via Image-to-Image editiert - warte auf User-Auswahl', {
        component: 'ChatInterface',
        data: { panelIndex }
      })

    } catch (error) {
      logger.error('Fehler beim Bearbeiten des Panels', {
        component: 'ChatInterface',
        data: error
      })
      alert('Fehler beim Regenerieren des Panels. Bitte versuche es erneut.')
    } finally {
      setIsRegeneratingPanel(false)
    }
  }

  const handlePanelReroll = async (panelIndex: number) => {
    if (!generatedStory || !characterProfile) return

    logger.userAction('ChatInterface', 'chat_panel_reroll', {
      panelIndex
    })

    setIsRegeneratingPanel(true)

    try {
      const oldPanel = generatedStory[panelIndex]

      // Sweet Spot Prompt: Comic-Stil beibehalten, aber Character ähnlicher machen
      const improvedReferenceFeedback =
        "Regenerate this comic panel illustration with the same composition, pose, and scene. " +
        "CRITICAL: This MUST remain a comic illustration - NOT a photograph, NOT realistic. " +
        "Improve the character's facial features to better match the reference images: " +
        "adjust facial structure, eye shape, nose proportions, and glasses style to be more similar to references. " +
        "Maintain the illustrated comic art style with clean lines and soft shading. " +
        "Keep all text, speech bubbles, and panel elements exactly as they are."

      // Image-to-Image Reroll mit Sweet-Spot-Prompt
      // Verwende aktuelles Panel für Komposition, aber betone Character-Improvement
      const updatedPanel = await editPanelWithImageToImage(
        oldPanel.avatarBase64,
        improvedReferenceFeedback,
        characterProfile,
        oldPanel.panelText,
        oldPanel.backgroundColor,
        false  // Aktuelles Panel MIT verwenden, aber Prompt fokussiert auf Character-Verbesserung
      )

      // Zeige Comparison Dialog
      setComparisonMode({
        panelIndex,
        oldPanel,
        newPanel: updatedPanel
      })

      logger.info('Panel erfolgreich neu gewürfelt - warte auf User-Auswahl', {
        component: 'ChatInterface',
        data: { panelIndex }
      })

    } catch (error) {
      logger.error('Fehler beim Reroll des Panels', {
        component: 'ChatInterface',
        data: error
      })
      alert('Fehler beim Neu-Würfeln des Panels. Bitte versuche es erneut.')
    } finally {
      setIsRegeneratingPanel(false)
    }
  }

  const handleSelectPanel = (panelIndex: number, useNew: boolean) => {
    if (!generatedStory || !comparisonMode) return

    logger.userAction('ChatInterface', 'select_panel_version', {
      panelIndex,
      selectedNew: useNew
    })

    const selectedPanel = useNew ? comparisonMode.newPanel : comparisonMode.oldPanel

    // Erstelle aktualisierte Story
    const updatedStoryPanels = generatedStory.map((p, idx) =>
      idx === panelIndex
        ? {
            ...p,
            panelNumber: p.panelNumber,
            panelText: selectedPanel.panelText,
            sceneDescription: selectedPanel.sceneDescription,
            avatarBase64: selectedPanel.avatarBase64,
            imagePrompt: selectedPanel.imagePrompt,
            backgroundColor: selectedPanel.backgroundColor
          }
        : p
    )

    // UI updaten
    setGeneratedStory(updatedStoryPanels)
    setComparisonMode(null)

    logger.info(`${useNew ? 'Neue' : 'Alte'} Panel-Version ausgewählt`, {
      component: 'ChatInterface',
      data: { panelIndex }
    })
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  // Wenn Story-Preview angezeigt wird, zeige nur Preview
  if (showStoryPreview && generatedStory) {
    const suggestedTitle = generatedStory[0]?.panelText.slice(0, 50) || 'Neue Story'

    // Extrahiere originalStoryboard aus Messages
    const storyboardMsg = messages.find(m => isStoryboardMessage(m.content))
    let originalStoryboard: Array<{ text: string; scene: string }> | undefined
    if (storyboardMsg) {
      try {
        originalStoryboard = JSON.parse(
          storyboardMsg.content.replace(/```json\n?|\n?```/g, '').trim()
        )
      } catch (e) {
        console.warn('Konnte Storyboard nicht extrahieren:', e)
      }
    }

    return (
      <StoryPreview
        panels={generatedStory}
        suggestedTitle={suggestedTitle}
        onApprove={handleStoryApprove}
        onReject={handleStoryReject}
        onRequestPanelEdit={handlePanelEditRequest}
        onRerollPanel={handlePanelReroll}
        onRegenerateAll={handleRegenerateAllPanels}
        originalStoryboard={originalStoryboard}
        onRegenerateFromStoryboard={originalStoryboard ? handleRegenerateFromStoryboard : undefined}
        isRegenerating={isRegeneratingPanel}
        instagramCaption={instagramCaption}
        instagramHashtags={instagramHashtags}
        comparisonMode={comparisonMode || undefined}
        onSelectPanel={handleSelectPanel}
      />
    )
  }

  return (
    <div className="flex flex-col h-[600px] border rounded-lg">
      {/* Chat-Nachrichten */}
      <div className="flex-1 overflow-y-auto p-3 md:p-4 space-y-4">
        {messages.map((message, index) => {
          const isJson = isStoryboardMessage(message.content)
          return (
            <div
              key={index}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <Card
                className={`max-w-[80%] ${ 
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : isJson 
                      ? 'bg-secondary border-2 border-primary/20' // Highlight für Storyboards
                      : 'bg-muted'
                }`}
              >
                <CardContent className="p-3">
                  {/* Panel-Bild für Edit-Modus */}
                  {message.image && (
                    <div className="mb-3">
                      <img
                        src={message.image}
                        alt="Panel zur Überarbeitung"
                        className="w-full max-w-sm rounded border-2 border-primary/30"
                      />
                    </div>
                  )}

                  {isJson ? (
                    <div className="font-mono text-xs whitespace-pre-wrap overflow-x-auto">
                      {message.content}
                    </div>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  )}
                  <p className="text-xs opacity-60 mt-1">
                    {message.timestamp.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </CardContent>
              </Card>
            </div>
          )
        })}

        {isLoading && (
          <div className="flex justify-start">
            <Card className="bg-muted">
              <CardContent className="p-3 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <p className="text-sm">Denke nach...</p>
              </CardContent>
            </Card>
          </div>
        )}

        {isRegeneratingPanel && (
          <div className="flex justify-start">
            <Card className="bg-primary/10">
              <CardContent className="p-3 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">🤖 KI interpretiert dein Feedback...</p>
                  <p className="text-xs text-muted-foreground">Erstelle verbesserte Bildanweisungen und regeneriere Panel</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Fehler-Anzeige */}
      {error && (
        <div className="px-3 md:px-4 py-2 bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      {/* Input-Bereich */}
      <div className="border-t p-3 md:p-4 space-y-3">
        {/* Konversations-Optionen (A/B/C/D) */}
        <div className="flex flex-wrap gap-1.5 md:gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="glass-subtle border border-white/40"
            disabled={isLoading || isGeneratingStory || isGeneratingPanels || isRegeneratingPanel}
            onClick={() => setInputValue(prev => prev ? `${prev} Ich möchte das Thema noch schärfen.` : 'Ich möchte das Thema noch schärfen.')}
            aria-label="A) Thema klären"
          >
            A) 🧭 Thema klären
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="glass-subtle border border-white/40"
            disabled={isLoading || isGeneratingStory || isGeneratingPanels || isRegeneratingPanel}
            onClick={() => setInputValue(prev => prev ? `${prev} Ziel der Story: ` : 'Ziel der Story: ')}
            aria-label="B) Ziel definieren"
          >
            B) 🎯 Ziel definieren
          </Button>

          <Button
            type="button"
            size="sm"
            className="glass-subtle border border-white/40"
            disabled={isGeneratingPanels || isLoading || !characterProfile}
            onClick={handleProposeStory}
            aria-label="C) Storyboard vorschlagen"
          >
            C) 🧩 Storyboard vorschlagen
          </Button>

          <Button
            type="button"
            size="sm"
            className="glass-subtle border border-white/40"
            disabled={!isStoryboardReady || isGeneratingStory}
            onClick={handleGenerateImages}
            aria-label="D) Bilder generieren"
          >
            D) 🖼️ Bilder generieren
          </Button>
        </div>
        <div className="flex gap-2">
          <Textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={
              editingPanelIndex !== null
                ? `Was möchtest du an Panel ${editingPanelIndex + 1} ändern? (z.B. "mehr lächeln", "heller", "Avatar sieht nicht ähnlich aus")`
                : "Schreibe deine Nachricht... (Enter zum Senden, Shift+Enter für neue Zeile)"
            }
            rows={2}
            disabled={isLoading || isGeneratingStory || isGeneratingPanels || isRegeneratingPanel}
            className="flex-1 resize-none"
          />
          <Button
            onClick={handleSendMessage}
            disabled={isLoading || !inputValue.trim() || isGeneratingStory || isRegeneratingPanel}
            size="icon"
            className="h-full aspect-square"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>

        {/* Action Buttons */}
        {messages.length >= 3 && !isGeneratingStory && (
          isStoryboardReady ? (
            <Button
              onClick={handleGenerateImages}
              disabled={isGeneratingStory}
              className="w-full bg-green-600 hover:bg-green-700 text-white"
              size="lg"
            >
              {isGeneratingStory ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <ImageIcon className="w-4 h-4 mr-2" />
              )}
              Storyboard bestätigen & Bilder generieren
            </Button>
          ) : (
            <Button
              onClick={handleProposeStory}
              disabled={isGeneratingPanels || isLoading || !characterProfile}
              className="w-full"
              size="lg"
            >
              {isGeneratingPanels ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Sparkles className="w-4 h-4 mr-2" />
              )}
              Storyboard vorschlagen
            </Button>
          )
        )}

        {/* Progress-Anzeige während Generierung */}
        {isGeneratingStory && storyProgress && (
          <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">
                {storyProgress.status === 'generating_prompts' && '🎨 Generiere Image-Prompts...'}
                {storyProgress.status === 'generating_avatars' && '✨ Generiere Avatare parallel...'}
                {storyProgress.status === 'completed' && '✅ Story fertig!'}
                {storyProgress.status === 'failed' && '❌ Fehler aufgetreten'}
              </span>
              <span className="text-muted-foreground">
                {storyProgress.generatedPanels}/{storyProgress.totalPanels}
              </span>
            </div>

            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
              <div
                className="bg-primary h-full transition-all duration-300"
                style={{
                  width: `${(storyProgress.generatedPanels / storyProgress.totalPanels) * 100}%`
                }}
              />
            </div>

            <p className="text-xs text-muted-foreground">
              {storyProgress.message}
            </p>

            {storyProgress.status === 'generating_avatars' && (
              <p className="text-xs text-muted-foreground">
                ⏱️ Geschätzte Dauer: ~{estimateGenerationTime(numPanels).formattedTime}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
