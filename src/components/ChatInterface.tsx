import { useState, useEffect, useRef } from 'react'
import { Send, Loader2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { startChatSession, sendChatMessage, generatePanelsFromChat, type ChatMessage } from '@/lib/chat-helper'
import { type ChatSession, addMessageToSession, updateChatSession } from '@/lib/chat-persistence'
import { type CharacterProfile, generateSystemPromptWithProfile } from '@/lib/character-profile'
import { generateCompleteStory, estimateGenerationTime, type PanelGenerationProgress } from '@/lib/story-generator'
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

          logger.info('Starte Chat mit Character Profile', {
            component: 'ChatInterface',
            data: {
              hasProfile: !!characterProfile,
              profileName: characterProfile?.name
            }
          })

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

    logger.userAction('ChatInterface', 'send_message', {
      messageLength: userMessage.length,
      sessionId: session.id
    })

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

    setIsLoading(true)

    try {
      // System-Prompt mit Character Profile generieren
      const systemPrompt = characterProfile
        ? generateSystemPromptWithProfile(characterProfile)
        : undefined

      // KI-Antwort holen
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

  const handleGenerateStory = async () => {
    console.log('🎨 handleGenerateStory aufgerufen')

    if (messages.length < 3) {
      setError('Bitte führe erst ein längeres Gespräch, bevor du eine Story generierst.')
      console.log('❌ Zu wenige Nachrichten:', messages.length)
      return
    }

    if (!characterProfile) {
      setError('Bitte erstelle erst ein Character Profile.')
      console.log('❌ Kein Character Profile vorhanden')
      return
    }

    console.log('✅ Validierung erfolgreich, starte Story-Generierung')

    logger.userAction('ChatInterface', 'generate_story', {
      messageCount: messages.length,
      numPanels,
      sessionId: session.id
    })

    setIsGeneratingStory(true)
    setIsGeneratingPanels(true)
    setError(null)
    setStoryProgress(null)

    try {
      // 1. Panel-Texte generieren
      console.log('📝 Schritt 1: Generiere Panel-Texte...')
      const panelTexts = await generatePanelsFromChat(messages, numPanels)
      console.log('✅ Panel-Texte generiert:', panelTexts)

      if (panelTexts.length === 0) {
        throw new Error('Keine Panel-Texte generiert')
      }

      logger.info(`${panelTexts.length} Panel-Texte generiert, starte Avatar-Generierung`, {
        component: 'ChatInterface',
        data: { panelCount: panelTexts.length }
      })

      // 2. Komplette Story mit Avataren generieren (parallel)
      console.log('🎨 Schritt 2: Generiere Avatare parallel...')
      const storyPanels = await generateCompleteStory(
        panelTexts,
        messages,
        characterProfile,
        '#e8dfd0',  // Standard-Hintergrundfarbe
        (progress) => {
          console.log('📊 Progress:', progress)
          setStoryProgress(progress)
          logger.debug('Story-Progress Update', {
            component: 'ChatInterface',
            data: progress
          })
        }
      )

      console.log('✅ Story erfolgreich generiert:', storyPanels.length, 'Panels')
      logger.info('Story erfolgreich generiert', {
        component: 'ChatInterface',
        data: { panelCount: storyPanels.length }
      })

      setGeneratedStory(storyPanels)
      setShowStoryPreview(true)
      console.log('✅ Story Preview angezeigt')
    } catch (err) {
      console.error('❌ Fehler beim Generieren der Story:', err)
      logger.error('Fehler beim Generieren der Story', {
        component: 'ChatInterface',
        data: err
      })
      setError(`Fehler beim Generieren der Story: ${err instanceof Error ? err.message : 'Unbekannter Fehler'}`)
    } finally {
      setIsGeneratingStory(false)
      setIsGeneratingPanels(false)
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
      const story = await createStory(generatedStory, {
        title,
        description,
        characterProfileId: characterProfile.id,
        chatSessionId: session.id,
        tags: [] // TODO: Auto-generierte Tags basierend auf Inhalt
      })

      logger.info('Story gespeichert', {
        component: 'ChatInterface',
        data: { storyId: story.id, title: story.title }
      })

      setShowStoryPreview(false)
      setGeneratedStory(null)

      onStoryCreated?.(story)
    } catch (error) {
      logger.error('Fehler beim Speichern der Story', {
        component: 'ChatInterface',
        data: error
      })
      setError('Story konnte nicht gespeichert werden. Bitte versuche es erneut.')
    }
  }

  const handleStoryReject = () => {
    logger.userAction('ChatInterface', 'reject_story', {
      panelCount: generatedStory?.length || 0
    })

    setShowStoryPreview(false)
    setGeneratedStory(null)
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

    return (
      <StoryPreview
        panels={generatedStory}
        suggestedTitle={suggestedTitle}
        onApprove={handleStoryApprove}
        onReject={handleStoryReject}
      />
    )
  }

  return (
    <div className="flex flex-col h-[600px] border rounded-lg">
      {/* Chat-Nachrichten */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <Card
              className={`max-w-[80%] ${
                message.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted'
              }`}
            >
              <CardContent className="p-3">
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                <p className="text-xs opacity-60 mt-1">
                  {message.timestamp.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </CardContent>
            </Card>
          </div>
        ))}

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

        <div ref={messagesEndRef} />
      </div>

      {/* Fehler-Anzeige */}
      {error && (
        <div className="px-4 py-2 bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      {/* Input-Bereich */}
      <div className="border-t p-4 space-y-3">
        <div className="flex gap-2">
          <Textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Schreibe deine Nachricht... (Enter zum Senden, Shift+Enter für neue Zeile)"
            rows={2}
            disabled={isLoading}
            className="flex-1 resize-none"
          />
          <Button
            onClick={handleSendMessage}
            disabled={isLoading || !inputValue.trim()}
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

        {/* Story generieren Button */}
        {messages.length >= 3 && !isGeneratingStory && (
          <Button
            onClick={handleGenerateStory}
            disabled={isGeneratingPanels || isLoading || !characterProfile}
            className="w-full"
            size="lg"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Story mit {numPanels} Panels generieren
          </Button>
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

            {/* Progress Bar */}
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

        <p className="text-xs text-muted-foreground text-center">
          {messages.length < 3
            ? 'Chatte ein wenig, um deine Ideen zu entwickeln. Dann kannst du eine Story generieren.'
            : !characterProfile
            ? 'Bitte erstelle erst ein Character Profile im "Profil"-Tab.'
            : `Bereit! Du kannst jetzt eine Story mit ${numPanels} Panels generieren.`}
        </p>
      </div>
    </div>
  )
}
