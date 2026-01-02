import { useState } from 'react'
import { Check, X, ChevronLeft, ChevronRight, Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { StoryPanel } from '@/lib/story-persistence'
import { logger } from '@/lib/logger'

interface StoryPreviewProps {
  panels: Omit<StoryPanel, 'id' | 'generatedAt'>[]
  suggestedTitle: string
  onApprove: (title: string, description?: string) => void
  onReject: () => void
}

export function StoryPreview({
  panels,
  suggestedTitle,
  onApprove,
  onReject
}: StoryPreviewProps) {
  const [currentPanelIndex, setCurrentPanelIndex] = useState(0)
  const [title, setTitle] = useState(suggestedTitle)
  const [description, setDescription] = useState('')
  const [showMetadata, setShowMetadata] = useState(false)

  const currentPanel = panels[currentPanelIndex]
  const totalPanels = panels.length

  const handleNext = () => {
    if (currentPanelIndex < totalPanels - 1) {
      setCurrentPanelIndex(currentPanelIndex + 1)
    }
  }

  const handlePrevious = () => {
    if (currentPanelIndex > 0) {
      setCurrentPanelIndex(currentPanelIndex - 1)
    }
  }

  const handleApprove = () => {
    logger.userAction('StoryPreview', 'approve_story', {
      panelCount: panels.length,
      title
    })
    onApprove(title, description || undefined)
  }

  const handleReject = () => {
    logger.userAction('StoryPreview', 'reject_story', {
      panelCount: panels.length
    })
    onReject()
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Story-Preview: {totalPanels} Panels</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowMetadata(!showMetadata)}
            >
              {showMetadata ? 'Metadaten ausblenden' : 'Metadaten bearbeiten'}
            </Button>
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Durchblättere die Story und entscheide, ob du sie speichern möchtest
          </p>
        </CardHeader>

        {/* Metadaten-Formular */}
        {showMetadata && (
          <CardContent className="space-y-4 border-t pt-6">
            <div>
              <Label htmlFor="story-title">Story-Titel</Label>
              <Input
                id="story-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Titel für diese Story"
                className="mt-2"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Wird automatisch generiert, kannst du aber ändern
              </p>
            </div>

            <div>
              <Label htmlFor="story-description">Beschreibung (optional)</Label>
              <Textarea
                id="story-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Kurze Beschreibung der Story..."
                rows={2}
                className="mt-2"
              />
            </div>
          </CardContent>
        )}
      </Card>

      {/* Panel Viewer */}
      <Card>
        <CardContent className="p-0">
          {/* Panel Display */}
          <div
            className="relative overflow-hidden rounded-t-lg"
            style={{
              backgroundColor: currentPanel.backgroundColor,
              aspectRatio: '1 / 1',
              maxWidth: '600px',
              margin: '0 auto'
            }}
          >
            {/* Avatar */}
            {currentPanel.avatarBase64 && (
              <img
                src={currentPanel.avatarBase64}
                alt={`Panel ${currentPanelIndex + 1}`}
                className="absolute inset-0 w-full h-full object-cover"
              />
            )}

            {/* Text Overlay */}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-8">
              <p className="text-white text-xl font-medium leading-relaxed text-center">
                {currentPanel.panelText}
              </p>
            </div>

            {/* Panel Number Badge */}
            <div className="absolute top-4 right-4 bg-black/70 text-white rounded-full px-3 py-1 text-sm font-bold">
              {currentPanelIndex + 1} / {totalPanels}
            </div>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between p-4 border-t bg-muted/50">
            <Button
              onClick={handlePrevious}
              disabled={currentPanelIndex === 0}
              variant="outline"
              size="sm"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Vorheriges
            </Button>

            <div className="text-sm text-muted-foreground">
              Panel {currentPanelIndex + 1} von {totalPanels}
            </div>

            <Button
              onClick={handleNext}
              disabled={currentPanelIndex === totalPanels - 1}
              variant="outline"
              size="sm"
            >
              Nächstes
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>

          {/* Panel Info */}
          <div className="p-4 border-t space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Panel-Text:</span>
              <span className="font-medium">{currentPanel.panelText.length} Zeichen</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Hintergrund:</span>
              <div className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded border"
                  style={{ backgroundColor: currentPanel.backgroundColor }}
                />
                <span className="font-medium">{currentPanel.backgroundColor}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Thumbnail Strip */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {panels.map((panel, index) => (
          <button
            key={index}
            onClick={() => setCurrentPanelIndex(index)}
            className={`relative flex-shrink-0 w-20 h-20 rounded border-2 overflow-hidden transition-all ${
              index === currentPanelIndex
                ? 'border-primary ring-2 ring-primary ring-offset-2'
                : 'border-muted hover:border-primary/50'
            }`}
            style={{ backgroundColor: panel.backgroundColor }}
          >
            {panel.avatarBase64 && (
              <img
                src={panel.avatarBase64}
                alt={`Panel ${index + 1}`}
                className="absolute inset-0 w-full h-full object-cover"
              />
            )}
            <div className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-xs text-center py-0.5">
              {index + 1}
            </div>
          </button>
        ))}
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Button
          onClick={handleReject}
          variant="outline"
          size="lg"
          className="flex-1"
        >
          <X className="w-4 h-4 mr-2" />
          Story verwerfen
        </Button>

        <Button
          onClick={handleApprove}
          variant="default"
          size="lg"
          className="flex-1"
        >
          <Save className="w-4 h-4 mr-2" />
          Story speichern
        </Button>
      </div>

      {/* Info Box */}
      <div className="bg-muted/50 rounded-lg p-4 space-y-2">
        <p className="text-sm font-medium">💡 Story-Verwaltung:</p>
        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
          <li><strong>Speichern:</strong> Story wird in deiner Galerie gespeichert</li>
          <li><strong>Verwerfen:</strong> Story wird gelöscht, zurück zum Chat</li>
          <li><strong>Navigation:</strong> Nutze die Pfeile oder klicke auf die Thumbnails</li>
          <li><strong>Export:</strong> Nach dem Speichern kannst du die Story als ZIP exportieren</li>
        </ul>
      </div>
    </div>
  )
}
