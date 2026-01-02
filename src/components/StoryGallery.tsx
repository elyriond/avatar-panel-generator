import { useState, useEffect } from 'react'
import { Download, Trash2, Eye, Search, Calendar, Tag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  getAllStories,
  deleteStory,
  type ComicStory,
  getStoryStats,
  searchStories
} from '@/lib/story-persistence'
import { exportPanelsAsZip, type ApprovedPanel } from '@/lib/panel-exporter'
import { logger } from '@/lib/logger'

interface StoryGalleryProps {
  onViewStory?: (story: ComicStory) => void
}

export function StoryGallery({ onViewStory }: StoryGalleryProps) {
  const [stories, setStories] = useState<ComicStory[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isExporting, setIsExporting] = useState<string | null>(null)
  const [stats, setStats] = useState(getStoryStats())

  // Lade Stories beim Mount
  useEffect(() => {
    loadStories()
  }, [])

  const loadStories = async () => {
    const allStories = searchQuery
      ? await searchStories(searchQuery)
      : await getAllStories()

    setStories(allStories)
    setStats(await getStoryStats())
  }

  // Suche mit Debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      loadStories()
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery])

  const handleDelete = async (storyId: string) => {
    const story = stories.find(s => s.id === storyId)
    if (!story) return

    if (confirm(`Möchtest du die Story "${story.title}" wirklich löschen?`)) {
      logger.userAction('StoryGallery', 'delete_story', {
        storyId,
        title: story.title
      })

      await deleteStory(storyId)
      await loadStories()
    }
  }

  const handleExport = async (story: ComicStory) => {
    logger.userAction('StoryGallery', 'export_story', {
      storyId: story.id,
      title: story.title,
      panelCount: story.panels.length
    })

    setIsExporting(story.id)

    try {
      // Konvertiere StoryPanels zu ApprovedPanels
      const approvedPanels: ApprovedPanel[] = story.panels.map(panel => ({
        id: panel.id,
        panelText: panel.panelText,
        avatarBase64: panel.avatarBase64,
        backgroundColor: panel.backgroundColor,
        generatedAt: panel.generatedAt,
        imagePrompt: panel.imagePrompt
      }))

      const zipBlob = await exportPanelsAsZip(approvedPanels)

      // Download ZIP
      const url = URL.createObjectURL(zipBlob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${story.title.replace(/[^a-zA-Z0-9-_]/g, '-')}.zip`
      link.click()
      URL.revokeObjectURL(url)

      logger.info('Story erfolgreich exportiert', {
        component: 'StoryGallery',
        data: { storyId: story.id, panelCount: story.panels.length }
      })
    } catch (error) {
      logger.error('Fehler beim Exportieren der Story', {
        component: 'StoryGallery',
        data: error
      })
      alert('Fehler beim Exportieren. Bitte versuche es erneut.')
    } finally {
      setIsExporting(null)
    }
  }

  const handleView = (story: ComicStory) => {
    logger.userAction('StoryGallery', 'view_story', {
      storyId: story.id,
      title: story.title
    })
    onViewStory?.(story)
  }

  if (stories.length === 0 && !searchQuery) {
    return (
      <Card className="max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle>Story-Galerie</CardTitle>
          <p className="text-sm text-muted-foreground">
            Hier erscheinen deine gespeicherten Comic-Stories
          </p>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-lg mb-2">Keine Stories vorhanden</p>
            <p className="text-sm">
              Erstelle deine erste Story im Chat und speichere sie hier.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header mit Stats */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Story-Galerie</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {stats.total} {stats.total === 1 ? 'Story' : 'Stories'} gespeichert • {stats.totalPanels} Panels insgesamt
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Suchfeld */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Stories durchsuchen..."
              className="pl-10"
            />
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold">{stats.total}</div>
              <div className="text-xs text-muted-foreground">Stories</div>
            </div>
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold">{stats.totalPanels}</div>
              <div className="text-xs text-muted-foreground">Panels</div>
            </div>
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold">{stats.averagePanelsPerStory}</div>
              <div className="text-xs text-muted-foreground">Ø Panels</div>
            </div>
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold">{stats.published}</div>
              <div className="text-xs text-muted-foreground">Published</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Story Grid */}
      {stories.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p>Keine Stories gefunden für "{searchQuery}"</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {stories.map((story) => (
            <Card key={story.id} className="group hover:shadow-lg transition-shadow">
              <CardContent className="p-0">
                {/* Thumbnail (erstes Panel) */}
                <div
                  className="relative aspect-square overflow-hidden cursor-pointer"
                  onClick={() => handleView(story)}
                  style={{ backgroundColor: story.panels[0]?.backgroundColor || '#e8dfd0' }}
                >
                  {story.panels[0]?.avatarBase64 && (
                    <img
                      src={story.panels[0].avatarBase64}
                      alt={story.title}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  )}

                  {/* Overlay bei Hover */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                    <Eye className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>

                  {/* Panel Count Badge */}
                  <div className="absolute top-2 right-2 bg-black/70 text-white rounded-full px-2 py-1 text-xs font-bold">
                    {story.panels.length} Panels
                  </div>

                  {/* Status Badge */}
                  {story.status === 'published' && (
                    <div className="absolute top-2 left-2 bg-green-500 text-white rounded-full px-2 py-1 text-xs font-bold">
                      Published
                    </div>
                  )}
                </div>

                {/* Story Info */}
                <div className="p-4 space-y-3">
                  <div>
                    <h3 className="font-semibold line-clamp-2 mb-1">
                      {story.title}
                    </h3>
                    {story.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {story.description}
                      </p>
                    )}
                  </div>

                  {/* Metadaten */}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="w-3 h-3" />
                    <span>{new Date(story.createdAt).toLocaleDateString('de-DE')}</span>
                  </div>

                  {/* Tags */}
                  {story.tags.length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap">
                      <Tag className="w-3 h-3 text-muted-foreground" />
                      {story.tags.slice(0, 3).map((tag, i) => (
                        <span
                          key={i}
                          className="text-xs bg-muted px-2 py-0.5 rounded"
                        >
                          {tag}
                        </span>
                      ))}
                      {story.tags.length > 3 && (
                        <span className="text-xs text-muted-foreground">
                          +{story.tags.length - 3}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-2 border-t">
                    <Button
                      onClick={() => handleView(story)}
                      variant="outline"
                      size="sm"
                      className="flex-1"
                    >
                      <Eye className="w-3 h-3 mr-1" />
                      Ansehen
                    </Button>
                    <Button
                      onClick={() => handleExport(story)}
                      disabled={isExporting === story.id}
                      variant="outline"
                      size="sm"
                      className="flex-1"
                    >
                      {isExporting === story.id ? (
                        <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <Download className="w-3 h-3 mr-1" />
                          ZIP
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={() => handleDelete(story.id)}
                      variant="outline"
                      size="sm"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
