import { useState, useEffect } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { CharacterProfileSetup } from '@/components/CharacterProfileSetup'
import { ChatSessionManager } from '@/components/ChatSessionManager'
import { ChatInterface } from '@/components/ChatInterface'
import { StoryCreator } from '@/components/StoryCreator'
import { StoryGallery } from '@/components/StoryGallery'
import { StoryPreview } from '@/components/StoryPreview'
import { StoryManagement } from '@/components/StoryManagement'
import {
  type CharacterProfile,
  getCharacterProfile,
  isProfileComplete,
  saveCharacterProfile
} from '@/lib/character-profile'
import {
  type ChatSession,
  getOrCreateActiveChatSession,
  updateChatSession
} from '@/lib/chat-persistence'
import { type ComicStory } from '@/lib/story-persistence'
import { createAutoCharacterProfile } from '@/lib/reference-loader'
import { logger } from '@/lib/logger'
import { type KieAiModel } from '@/lib/kie-ai-image'

type AppView = 'profile-setup' | 'session-select' | 'chat' | 'story-creator' | 'loading'

export function MainApp() {
  const [characterProfile, setCharacterProfile] = useState<CharacterProfile | null>(null)
  const [currentSession, setCurrentSession] = useState<ChatSession | null>(null)
  const [currentView, setCurrentView] = useState<AppView>('loading')
  const [viewedStory, setViewedStory] = useState<ComicStory | null>(null)
  const [activeTab, setActiveTab] = useState('chat')
  const [loadingError, setLoadingError] = useState<string | null>(null)

  // Load Character Profile on mount
  useEffect(() => {
    try {
      // Versuche erst, gespeichertes Profil zu laden
      let profile = getCharacterProfile()

      if (!profile || !isProfileComplete(profile)) {
        // Wenn kein Profil vorhanden, automatisch aus Referenzbildern erstellen
        logger.info('Erstelle Auto-Character-Profile aus Referenzbildern', {
          component: 'MainApp'
        })

        profile = createAutoCharacterProfile()
        saveCharacterProfile(profile)

        logger.info('Auto-Character-Profile erstellt und gespeichert', {
          component: 'MainApp',
          data: { profileName: profile.name }
        })
      }

      setCharacterProfile(profile)
      setCurrentView('session-select')
    } catch (error) {
      logger.error('Fehler beim Laden/Erstellen des Character Profiles', {
        component: 'MainApp',
        data: error
      })
      setLoadingError('Fehler beim Erstellen des Character Profiles.')
      setCurrentView('profile-setup')
    }
  }, [])

  const handleProfileComplete = (profile: CharacterProfile) => {
    logger.userAction('MainApp', 'profile_completed', {
      profileName: profile.name
    })
    setCharacterProfile(profile)
    setCurrentView('session-select')
  }

  const handleSessionSelected = (session: ChatSession) => {
    logger.userAction('MainApp', 'session_selected', {
      sessionId: session.id,
      sessionTitle: session.title
    })
    setCurrentSession(session)
    setCurrentView('chat')
  }

  const handleSessionUpdated = (session: ChatSession) => {
    setCurrentSession(session)
    updateChatSession(session)
  }

  const handleBackToSessionSelect = () => {
    logger.userAction('MainApp', 'back_to_session_select')
    setCurrentView('session-select')
  }

  const handleStoryCreated = (story: ComicStory) => {
    logger.info('Story erstellt und gespeichert', {
      component: 'MainApp',
      data: { storyId: story.id, title: story.title }
    })
    // Wechsle zur Galerie und zeige die neue Story
    setActiveTab('gallery')
  }

  const handleViewStory = (story: ComicStory) => {
    logger.userAction('MainApp', 'view_story', {
      storyId: story.id,
      title: story.title
    })
    setViewedStory(story)
  }

  const handleCloseStoryView = () => {
    setViewedStory(null)
  }

  const handleAiModelChange = (model: KieAiModel) => {
    if (!characterProfile) return

    logger.userAction('MainApp', 'ai_model_changed', {
      previousModel: characterProfile.aiModel || 'nano-banana-pro',
      newModel: model
    })

    const updatedProfile = {
      ...characterProfile,
      aiModel: model,
      lastUpdatedAt: new Date()
    }

    setCharacterProfile(updatedProfile)
    saveCharacterProfile(updatedProfile)
  }

  // View: Loading
  if (currentView === 'loading') {
    return (
      <div className="min-h-screen bg-background p-6 flex items-center justify-center">
        <div className="text-center space-y-6">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary border-t-transparent mx-auto"></div>
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold text-foreground">Comic Panel Generator</h2>
            <p className="text-muted-foreground">Lade Referenzbilder...</p>
          </div>
        </div>
      </div>
    )
  }

  // View: Profile Setup
  if (currentView === 'profile-setup') {
    return (
      <div className="min-h-screen bg-background p-6">
        {loadingError && (
          <div className="mb-6 p-4 bg-destructive/10 text-destructive rounded-lg">
            {loadingError}
          </div>
        )}
        <CharacterProfileSetup
          existingProfile={characterProfile || undefined}
          onComplete={handleProfileComplete}
        />
      </div>
    )
  }

  // View: Session Select
  if (currentView === 'session-select') {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Header mit Gradient */}
          <div className="text-center space-y-4 py-12">
            <div className="inline-block px-6 py-3 bg-gradient-warm rounded-2xl shadow-soft mb-4">
              <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary-strong">
                Comic Panel Generator
              </h1>
            </div>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Erstelle AI-generierte Comic-Stories mit deinem Character ✨
            </p>
          </div>

          <ChatSessionManager onSessionSelected={handleSessionSelected} />

          {characterProfile && (
            <div className="text-center">
              <button
                onClick={() => setCurrentView('profile-setup')}
                className="text-sm text-primary hover:text-primary-strong underline transition-smooth"
              >
                Character Profile bearbeiten
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  // View: Chat
  if (currentView === 'chat' && currentSession) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Modern Header with Card */}
          <div className="bg-card rounded-2xl shadow-elegant p-6 border border-border">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <h1 className="text-3xl font-bold text-foreground">{currentSession.title}</h1>
                {currentSession.tags.length > 0 && (
                  <div className="flex gap-2">
                    {currentSession.tags.map((tag, i) => (
                      <span
                        key={i}
                        className="inline-block px-3 py-1 text-xs font-medium bg-primary/10 text-primary rounded-full"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-4">
                {/* AI-Modell Auswahl (TEST) */}
                <div className="flex items-center gap-3 bg-accent/30 px-4 py-2 rounded-xl border border-border">
                  <span className="text-sm font-medium text-foreground">🧪 Modell:</span>
                  <select
                    value={characterProfile?.aiModel || 'nano-banana-pro'}
                    onChange={(e) => handleAiModelChange(e.target.value as KieAiModel)}
                    className="px-3 py-2 rounded-lg border border-input bg-card text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary transition-smooth"
                  >
                    <option value="nano-banana-pro">Imagen 4 ✅</option>
                    <option value="flux-2">Flux.2</option>
                    <option value="ideogram-v3">Ideogram V3</option>
                    <option value="flux-kontxt">Flux Kontxt</option>
                    <option value="gpt-image-1.5">GPT Image 1.5</option>
                  </select>
                </div>

                <button
                  onClick={handleBackToSessionSelect}
                  className="px-4 py-2 text-sm font-medium text-primary hover:text-primary-strong hover:bg-primary/5 rounded-lg transition-smooth"
                >
                  ← Zurück
                </button>
              </div>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="chat">💬 Chat & Story</TabsTrigger>
              <TabsTrigger value="gallery">🎨 Story-Galerie</TabsTrigger>
              <TabsTrigger value="storage">💾 Speicher</TabsTrigger>
              <TabsTrigger value="panels">📋 Panels (alt)</TabsTrigger>
            </TabsList>

            <TabsContent value="chat" className="mt-6">
              <ChatInterface
                numPanels={5}
                session={currentSession}
                characterProfile={characterProfile}
                onPanelsGenerated={(panels) => {
                  console.log('Panels generiert:', panels)
                }}
                onSessionUpdated={handleSessionUpdated}
                onStoryCreated={handleStoryCreated}
              />
            </TabsContent>

            <TabsContent value="gallery" className="mt-6">
              {viewedStory ? (
                <div className="space-y-4">
                  <Button
                    onClick={handleCloseStoryView}
                    variant="outline"
                    size="sm"
                  >
                    ← Zurück zur Galerie
                  </Button>
                  <StoryPreview
                    panels={viewedStory.panels.map(p => ({
                      panelNumber: p.panelNumber,
                      panelText: p.panelText,
                      avatarBase64: p.avatarBase64,
                      imagePrompt: p.imagePrompt,
                      backgroundColor: p.backgroundColor
                    }))}
                    suggestedTitle={viewedStory.title}
                    onApprove={() => {
                      // Already saved, just close
                      handleCloseStoryView()
                    }}
                    onReject={handleCloseStoryView}
                  />
                </div>
              ) : (
                <StoryGallery onViewStory={handleViewStory} />
              )}
            </TabsContent>

            <TabsContent value="storage" className="mt-6">
              <StoryManagement />
            </TabsContent>

            <TabsContent value="panels" className="mt-6">
              <StoryCreator />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    )
  }

  return null
}
