import { useEffect, useRef, useState } from 'react'
import { Download, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { generatePanel, downloadPanel, type AvatarPosition } from '@/lib/panel-generator'
import { getAvatarByEmotion, getAvatars } from '@/lib/avatar-storage'

interface PanelPreviewProps {
  text: string
  emotion: string
  backgroundColor: string
  avatarPosition: AvatarPosition
  panelNumber?: number
  removeBackground?: boolean
  customFontSize?: number
  selectedAvatarId?: string
  onUpdatePanel?: (updates: Partial<PanelPreviewProps>) => void
}

export function PanelPreview({
  text,
  emotion,
  backgroundColor,
  avatarPosition,
  panelNumber = 1,
  removeBackground = false,
  customFontSize,
  selectedAvatarId,
  onUpdatePanel
}: PanelPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const avatarImageRef = useRef<HTMLImageElement | null>(null)

  // Alle verfügbaren Avatare laden
  const [availableAvatars, setAvailableAvatars] = useState(() => getAvatars())
  const [currentAvatarIndex, setCurrentAvatarIndex] = useState(0)

  // Avatar laden - Priorität: selectedAvatarId > emotion
  useEffect(() => {
    // Avatare neu laden (falls zwischenzeitlich welche hinzugefügt wurden)
    setAvailableAvatars(getAvatars())

    if (!emotion && !selectedAvatarId) {
      // Kein Avatar gewünscht
      avatarImageRef.current = null
      renderPanel()
      return
    }

    let avatar = null

    // 1. Priorität: Manuell ausgewählter Avatar
    if (selectedAvatarId) {
      avatar = availableAvatars.find(a => a.id === selectedAvatarId)
    }

    // 2. Fallback: Avatar basierend auf Emotion
    if (!avatar && emotion) {
      avatar = getAvatarByEmotion(emotion)
    }

    if (avatar) {
      const img = new Image()
      img.onload = () => {
        avatarImageRef.current = img
        renderPanel()
      }
      img.src = avatar.imageData

      // Aktuellen Index setzen (für Navigation)
      const index = availableAvatars.findIndex(a => a.id === avatar.id)
      if (index !== -1) {
        setCurrentAvatarIndex(index)
      }
    } else {
      avatarImageRef.current = null
      renderPanel()
    }
  }, [emotion, selectedAvatarId, availableAvatars])

  // Panel rendern bei Änderungen
  useEffect(() => {
    renderPanel()
  }, [text, backgroundColor, avatarPosition, removeBackground, customFontSize])

  const renderPanel = () => {
    if (!canvasRef.current) return

    try {
      generatePanel({
        text,
        backgroundColor,
        avatarImage: avatarImageRef.current,
        canvas: canvasRef.current,
        avatarPosition,
        panelNumber,
        removeBackground,
        customFontSize
      })
    } catch (error) {
      console.error('Fehler beim Rendern des Panels:', error)
    }
  }

  const handleDownload = () => {
    if (!canvasRef.current) return

    const timestamp = new Date().toISOString().slice(0, 10)
    const filename = `panel-${panelNumber}-${timestamp}.png`
    downloadPanel(canvasRef.current, filename)
  }

  // Avatar-Navigation
  const selectPreviousAvatar = () => {
    if (availableAvatars.length === 0) return

    const newIndex = currentAvatarIndex === 0
      ? availableAvatars.length - 1
      : currentAvatarIndex - 1

    const newAvatar = availableAvatars[newIndex]
    if (onUpdatePanel && newAvatar) {
      onUpdatePanel({ selectedAvatarId: newAvatar.id })
    }
  }

  const selectNextAvatar = () => {
    if (availableAvatars.length === 0) return

    const newIndex = currentAvatarIndex === availableAvatars.length - 1
      ? 0
      : currentAvatarIndex + 1

    const newAvatar = availableAvatars[newIndex]
    if (onUpdatePanel && newAvatar) {
      onUpdatePanel({ selectedAvatarId: newAvatar.id })
    }
  }

  const resetToAutoAvatar = () => {
    if (onUpdatePanel) {
      onUpdatePanel({ selectedAvatarId: undefined })
    }
  }

  return (
    <div className="space-y-4">
      {/* Canvas (skaliert für Vorschau) */}
      <div className="relative bg-muted rounded-lg overflow-hidden">
        <canvas
          ref={canvasRef}
          className="w-full h-auto"
          style={{
            maxWidth: '100%',
            height: 'auto'
          }}
        />

        {/* Panel-Nummer Badge */}
        {panelNumber && (
          <div className="absolute top-4 left-4 bg-black/70 text-white text-sm font-medium px-3 py-1 rounded-full">
            Panel {panelNumber}
          </div>
        )}
      </div>

      {/* Avatar-Auswahl (nur wenn Avatar verwendet wird) */}
      {(emotion || selectedAvatarId) && availableAvatars.length > 0 && (
        <div className="space-y-3">
          <div className="text-sm font-medium text-center">
            Avatar-Auswahl
            {selectedAvatarId && (
              <span className="ml-2 text-xs text-primary">(Manuell ausgewählt)</span>
            )}
          </div>

          {/* Thumbnail-Galerie */}
          <div className="grid grid-cols-6 gap-1.5">
            {availableAvatars.map((avatar, index) => {
              const isSelected = index === currentAvatarIndex
              return (
                <button
                  key={avatar.id}
                  onClick={() => {
                    if (onUpdatePanel) {
                      onUpdatePanel({ selectedAvatarId: avatar.id })
                    }
                  }}
                  className={`
                    relative rounded-md overflow-hidden border transition-all
                    hover:scale-105 hover:shadow-md cursor-pointer
                    ${isSelected
                      ? 'border-primary ring-1 ring-primary'
                      : 'border-muted hover:border-primary/50'
                    }
                  `}
                  title={avatar.emotion}
                >
                  {/* Thumbnail Bild */}
                  <div className="aspect-square bg-muted">
                    <img
                      src={avatar.imageData}
                      alt={avatar.emotion}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Emotion Label - nur bei ausgewähltem */}
                  {isSelected && (
                    <div className="absolute bottom-0 left-0 right-0 px-0.5 py-0.5 text-[8px] font-medium text-center truncate bg-primary text-primary-foreground">
                      {avatar.emotion}
                    </div>
                  )}

                  {/* Ausgewählt-Indikator */}
                  {isSelected && (
                    <div className="absolute top-0.5 right-0.5 w-2 h-2 bg-primary rounded-full border border-white" />
                  )}
                </button>
              )
            })}
          </div>

          {/* Info & Zurücksetzen */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div>
              {availableAvatars.length} Avatar{availableAvatars.length !== 1 ? 'e' : ''} verfügbar
            </div>
            {selectedAvatarId && (
              <Button
                variant="outline"
                size="sm"
                onClick={resetToAutoAvatar}
                className="h-7 text-xs"
              >
                Zurück zu KI-Auswahl
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Download Button */}
      <Button onClick={handleDownload} className="w-full" size="lg">
        <Download className="w-4 h-4 mr-2" />
        Panel {panelNumber} herunterladen
      </Button>

      {/* Info */}
      <div className="text-sm text-muted-foreground text-center">
        {emotion || selectedAvatarId ? (
          <>
            {selectedAvatarId ? 'Avatar manuell gewählt' : `KI-Auswahl: ${emotion}`}
          </>
        ) : (
          'Nur Text (kein Avatar)'
        )}
      </div>
    </div>
  )
}
