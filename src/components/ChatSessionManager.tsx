import { useState } from 'react'
import { MessageSquare, Plus, Archive, Clock, Tag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  type ChatSession,
  getOrCreateActiveChatSession,
  getActiveSessions,
  getArchivedSessions,
  createChatSession,
  setActiveChatSessionId,
  archiveChatSession
} from '@/lib/chat-persistence'

interface ChatSessionManagerProps {
  onSessionSelected: (session: ChatSession) => void
}

export function ChatSessionManager({ onSessionSelected }: ChatSessionManagerProps) {
  const [showArchived, setShowArchived] = useState(false)
  const activeSessions = getActiveSessions()
  const archivedSessions = getArchivedSessions()
  const currentSession = getOrCreateActiveChatSession()

  const handleContinue = () => {
    onSessionSelected(currentSession)
  }

  const handleNewChat = () => {
    const newSession = createChatSession()
    onSessionSelected(newSession)
  }

  const handleSelectSession = (session: ChatSession) => {
    setActiveChatSessionId(session.id)
    onSessionSelected(session)
  }

  const handleArchive = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (confirm('Diesen Chat archivieren?')) {
      archiveChatSession(sessionId)
      // Force re-render
      window.location.reload()
    }
  }

  const formatDate = (date: Date) => {
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 60) return `vor ${minutes} Min`
    if (hours < 24) return `vor ${hours} Std`
    if (days < 7) return `vor ${days} Tagen`
    return date.toLocaleDateString('de-DE')
  }

  const displaySessions = showArchived ? archivedSessions : activeSessions.slice(0, 5)

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Haupt-Aktionen */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Fortsetzen Card */}
        <Card className="cursor-pointer hover:shadow-lg transition-shadow border-2 border-primary/20 bg-primary/5" onClick={handleContinue}>
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <MessageSquare className="w-6 h-6 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-1">Letzten Chat fortsetzen</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  {currentSession.title}
                </p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  {formatDate(currentSession.lastActiveAt)}
                  {currentSession.tags.length > 0 && (
                    <>
                      <span>•</span>
                      <div className="flex gap-1">
                        {currentSession.tags.slice(0, 2).map((tag) => (
                          <span key={tag} className="px-1.5 py-0.5 bg-primary/10 rounded text-xs">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Neuer Chat Card */}
        <Card className="cursor-pointer hover:shadow-lg transition-shadow border-2 border-dashed" onClick={handleNewChat}>
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-muted rounded-lg">
                <Plus className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-1">Neuer Chat</h3>
                <p className="text-sm text-muted-foreground">
                  Frisch starten mit neuem Thema
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  (Dein Stil & Character bleiben erhalten)
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Frühere Chats */}
      {displaySessions.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-muted-foreground">
              {showArchived ? 'Archivierte Chats' : 'Frühere Chats'}
            </h3>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowArchived(!showArchived)}
              >
                <Archive className="w-4 h-4 mr-2" />
                {showArchived ? 'Aktive zeigen' : 'Archiv'}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            {displaySessions.map((session) => (
              <Card
                key={session.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => handleSelectSession(session)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <MessageSquare className="w-4 h-4 text-muted-foreground" />
                        <h4 className="font-medium text-sm">{session.title}</h4>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {formatDate(session.lastActiveAt)}
                        <span>•</span>
                        <span>{session.messages.length} Nachrichten</span>

                        {session.tags.length > 0 && (
                          <>
                            <span>•</span>
                            <div className="flex gap-1">
                              <Tag className="w-3 h-3" />
                              {session.tags.slice(0, 2).map((tag) => (
                                <span key={tag}>#{tag}</span>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {!showArchived && session.id !== currentSession.id && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => handleArchive(session.id, e)}
                        className="shrink-0"
                      >
                        <Archive className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {!showArchived && activeSessions.length > 5 && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setShowArchived(true)}
            >
              Alle {activeSessions.length} Chats anzeigen
            </Button>
          )}
        </div>
      )}

      {/* Empty State */}
      {!showArchived && activeSessions.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="p-12 text-center">
            <MessageSquare className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="font-semibold mb-2">Noch keine Chats</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Starte deinen ersten Chat und entwickle deine erste Geschichte!
            </p>
            <Button onClick={handleNewChat}>
              <Plus className="w-4 h-4 mr-2" />
              Ersten Chat starten
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
