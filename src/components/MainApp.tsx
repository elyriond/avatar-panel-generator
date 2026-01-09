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
      <div className="min-h-screen bg-background p-4 md:p-8">
        <div className="max-w-6xl mx-auto space-y-10 md:space-y-12">
          {/* Apple-Style Hero Header with Glass & Gradient for readability */}
          <div className="relative overflow-hidden rounded-3xl shadow-apple-lg hero-gradient p-[1px]">
            <div className="glass-card rounded-3xl text-center space-y-5 md:space-y-6 py-10 md:py-16">
              <h1 className="text-5xl md:text-7xl font-semibold text-apple-title tracking-tight title-readable text-gradient-warm">
                Comic Panel Generator
              </h1>
              <p className="text-base md:text-xl text-apple-body text-muted-foreground max-w-xl md:max-w-2xl mx-auto leading-relaxed subtitle-readable">
                Erstelle AI-generierte Comic-Stories mit deinem Character
              </p>
              <div className="flex justify-center gap-2 md:gap-3 pt-3 md:pt-4">
                <span className="inline-flex items-center px-3 py-1.5 md:px-4 md:py-2 glass-subtle text-xs md:text-sm font-semibold rounded-full text-foreground">
                  ✨ AI-Powered
                </span>
                <span className="inline-flex items-center px-3 py-1.5 md:px-4 md:py-2 glass-subtle text-xs md:text-sm font-semibold rounded-full text-foreground">
                  🎨 Character Consistency
                </span>
                <span className="inline-flex items-center px-3 py-1.5 md:px-4 md:py-2 glass-subtle text-xs md:text-sm font-semibold rounded-full text-foreground">
                  🚀 Instant Generation
                </span>
              </div>
            </div>
          </div>

          <ChatSessionManager onSessionSelected={handleSessionSelected} />

          {characterProfile && (
            <div className="text-center">
              <button
                onClick={() => setCurrentView('profile-setup')}
                className="text-sm text-primary hover:text-primary-strong font-medium transition-smooth"
              >
                Character Profile bearbeiten →
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
      <div className="min-h-screen bg-background p-4 md:p-8">
        <div className="max-w-6xl mx-auto space-y-6 md:space-y-8">
          {/* Apple-Style Glassmorphism Header */}
          <div className="glass-card rounded-3xl shadow-apple-lg p-5 md:p-8 hover-lift">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <h1 className="text-3xl md:text-5xl font-semibold text-apple-title title-readable text-foreground tracking-tight">{currentSession.title}</h1>
                {currentSession.tags.length > 0 && (
                  <div className="flex gap-1.5 md:gap-2 pt-1">
                    {currentSession.tags.map((tag, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center px-2.5 py-1 text-[11px] md:text-xs font-semibold bg-primary/15 text-primary rounded-full border border-primary/20"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-4">
                {/* AI-Modell Auswahl - Apple Style */}
                <div className="glass-subtle flex items-center gap-3 px-5 py-3 rounded-2xl border border-white/30">
                  <span className="text-sm font-semibold text-foreground">🧪 Modell</span>
                  <select
                    value={characterProfile?.aiModel || 'nano-banana-pro'}
                    onChange={(e) => handleAiModelChange(e.target.value as KieAiModel)}
                    className="px-4 py-2 rounded-xl bg-white/80 border border-white/50 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all backdrop-blur-sm"
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
                  className="px-5 py-2.5 text-sm font-semibold text-primary hover:text-primary-strong hover:bg-primary/10 rounded-xl transition-all"
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
