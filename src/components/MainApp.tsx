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

  // View: Loading
  if (currentView === 'loading') {
    return (
      <div className="min-h-screen bg-background p-6 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Lade Referenzbilder...</p>
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
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold">Willkommen zurück! 💚</h1>
            <p className="text-muted-foreground">
              Wähle einen Chat aus oder starte einen neuen.
            </p>
          </div>

          <ChatSessionManager onSessionSelected={handleSessionSelected} />

          {characterProfile && (
            <div className="text-center">
              <button
                onClick={() => setCurrentView('profile-setup')}
                className="text-sm text-muted-foreground hover:text-foreground underline"
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
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">{currentSession.title}</h1>
              <p className="text-sm text-muted-foreground">
                {currentSession.tags.length > 0 && (
                  <>#{currentSession.tags.join(' #')}</>
                )}
              </p>
            </div>

            <button
              onClick={handleBackToSessionSelect}
              className="text-sm text-muted-foreground hover:text-foreground underline"
            >
              Zurück zur Übersicht
            </button>
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
