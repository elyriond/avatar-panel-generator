import { useState, useEffect } from 'react'
import { Trash2, RefreshCw, AlertTriangle, HardDrive } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  getAllStories,
  deleteStory,
  deleteMultipleStories,
  clearAllStories,
  cleanupOldStories,
  getStorageSize,
  type ComicStory
} from '@/lib/story-persistence'
import { logger } from '@/lib/logger'
import { toast } from 'sonner'

export function StoryManagement() {
  const [stories, setStories] = useState<ComicStory[]>([])
  const [storageSize, setStorageSize] = useState({ bytes: 0, mb: '0.00' })
  const [isLoading, setIsLoading] = useState(true)
  const [selectedStories, setSelectedStories] = useState<Set<string>>(new Set())

  // Lade Stories und Storage-Größe
  const loadData = async () => {
    setIsLoading(true)
    try {
      const [loadedStories, size] = await Promise.all([
        getAllStories(),
        getStorageSize()
      ])
      setStories(loadedStories)
      setStorageSize(size)
    } catch (error) {
      logger.error('Fehler beim Laden der Story-Daten', {
        component: 'StoryManagement',
        data: error
      })
      toast.error('Fehler beim Laden der Stories')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Einzelne Story löschen
  const handleDeleteStory = async (storyId: string) => {
    if (!confirm('Diese Story wirklich löschen?')) return

    try {
      await deleteStory(storyId)
      toast.success('Story gelöscht')
      loadData()
    } catch (error) {
      logger.error('Fehler beim Löschen der Story', {
        component: 'StoryManagement',
        data: error
      })
      toast.error('Fehler beim Löschen der Story')
    }
  }

  // Mehrere Stories löschen
  const handleDeleteSelected = async () => {
    if (selectedStories.size === 0) {
      toast.error('Keine Stories ausgewählt')
      return
    }

    if (!confirm(`${selectedStories.size} Story(s) wirklich löschen?`)) return

    try {
      await deleteMultipleStories(Array.from(selectedStories))
      toast.success(`${selectedStories.size} Story(s) gelöscht`)
      setSelectedStories(new Set())
      loadData()
    } catch (error) {
      logger.error('Fehler beim Löschen mehrerer Stories', {
        component: 'StoryManagement',
        data: error
      })
      toast.error('Fehler beim Löschen der Stories')
    }
  }

  // Alte Stories bereinigen (nur die neuesten 50 behalten)
  const handleCleanupOld = async () => {
    if (!confirm('Alle Stories außer den neuesten 50 löschen?')) return

    try {
      const deletedCount = await cleanupOldStories(50)
      if (deletedCount > 0) {
        toast.success(`${deletedCount} alte Story(s) gelöscht`)
        loadData()
      } else {
        toast.info('Keine alten Stories zum Löschen')
      }
    } catch (error) {
      logger.error('Fehler beim Bereinigen alter Stories', {
        component: 'StoryManagement',
        data: error
      })
      toast.error('Fehler beim Bereinigen')
    }
  }

  // Alle Stories löschen
  const handleClearAll = async () => {
    if (!confirm('WIRKLICH ALLE Stories löschen? Das kann nicht rückgängig gemacht werden!')) return

    try {
      await clearAllStories()
      toast.success('Alle Stories gelöscht')
      setSelectedStories(new Set())
      loadData()
    } catch (error) {
      logger.error('Fehler beim Löschen aller Stories', {
        component: 'StoryManagement',
        data: error
      })
      toast.error('Fehler beim Löschen')
    }
  }

  // Story-Auswahl togglen
  const toggleStorySelection = (storyId: string) => {
    setSelectedStories(prev => {
      const newSet = new Set(prev)
      if (newSet.has(storyId)) {
        newSet.delete(storyId)
      } else {
        newSet.add(storyId)
      }
      return newSet
    })
  }

  // Alle auswählen / abwählen
  const toggleSelectAll = () => {
    if (selectedStories.size === stories.length) {
      setSelectedStories(new Set())
    } else {
      setSelectedStories(new Set(stories.map(s => s.id)))
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Storage Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HardDrive className="w-5 h-5" />
            Story-Speicher
          </CardTitle>
          <CardDescription>
            IndexedDB speichert deine Stories lokal im Browser
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Gespeicherte Stories</p>
              <p className="text-2xl font-bold">{stories.length}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Speichergröße</p>
              <p className="text-2xl font-bold">{storageSize.mb} MB</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Aktionen */}
      <Card>
        <CardHeader>
          <CardTitle>Speicher verwalten</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Aktualisieren
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleCleanupOld}
              disabled={stories.length <= 50}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Alte Stories bereinigen ({">"} 50)
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleDeleteSelected}
              disabled={selectedStories.size === 0}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Ausgewählte löschen ({selectedStories.size})
            </Button>

            <Button
              variant="destructive"
              size="sm"
              onClick={handleClearAll}
              disabled={stories.length === 0}
            >
              <AlertTriangle className="w-4 h-4 mr-2" />
              Alle löschen
            </Button>
          </div>

          {stories.length > 0 && (
            <div className="flex items-center gap-2 pt-2 border-t">
              <input
                type="checkbox"
                checked={selectedStories.size === stories.length && stories.length > 0}
                onChange={toggleSelectAll}
                className="rounded"
              />
              <label className="text-sm text-muted-foreground cursor-pointer" onClick={toggleSelectAll}>
                Alle auswählen / abwählen
              </label>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Story-Liste */}
      {stories.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8 text-muted-foreground">
            Noch keine Stories gespeichert
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          <h3 className="text-lg font-semibold">Gespeicherte Stories</h3>
          {stories.map((story) => (
            <Card key={story.id} className={selectedStories.has(story.id) ? 'border-primary' : ''}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    checked={selectedStories.has(story.id)}
                    onChange={() => toggleStorySelection(story.id)}
                    className="rounded"
                  />

                  {/* Story Info */}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium truncate">{story.title}</h4>
                    <div className="flex gap-4 text-xs text-muted-foreground">
                      <span>{story.panels.length} Panels</span>
                      <span>{new Date(story.createdAt).toLocaleDateString('de-DE')}</span>
                      <span className="capitalize">{story.status}</span>
                    </div>
                    {story.description && (
                      <p className="text-sm text-muted-foreground mt-1 truncate">
                        {story.description}
                      </p>
                    )}
                  </div>

                  {/* Delete Button */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteStory(story.id)}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
