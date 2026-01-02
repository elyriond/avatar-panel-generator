import { useState, useEffect, useRef } from 'react'
import { Loader2, Sparkles, Trash2, ArrowUp, ArrowDown, Download, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { ColorPicker } from '@/components/ColorPicker'
import { PanelPreview } from '@/components/PanelPreview'
import { ChatInterface } from '@/components/ChatInterface'
import { splitStoryIntoPanels, detectEmotion, type StoryPanel } from '@/lib/emotion-detector'
import type { AvatarPosition } from '@/lib/panel-generator'
import { generatePanel, downloadPanel } from '@/lib/panel-generator'
import { getAvatarByEmotion } from '@/lib/avatar-storage'

type CreationMode = 'auto' | 'manual' | 'chat'

const POSITION_OPTIONS: { value: AvatarPosition; label: string }[] = [
  { value: 'bottom-center', label: 'Unten zentriert' },
  { value: 'bottom-right', label: 'Unten rechts' },
  { value: 'left', label: 'Links' },
  { value: 'right', label: 'Rechts' }
]

const STORAGE_KEY_PANELS = 'avatar-panel-generator-panels'
const STORAGE_KEY_SETTINGS = 'avatar-panel-generator-settings'

interface SavedSettings {
  backgroundColor: string
  avatarPosition: AvatarPosition
  removeAvatarBackground: boolean
  numPanels: number
}

export function StoryCreator() {
  const [mode, setMode] = useState<CreationMode>('auto')
  const [longStory, setLongStory] = useState('')

  // Einstellungen aus LocalStorage laden
  const loadedSettings = (() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_SETTINGS)
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  })()

  const [numPanels, setNumPanels] = useState(loadedSettings?.numPanels || 5)
  const [manualPanels, setManualPanels] = useState<string[]>(Array(5).fill(''))
  const [generatedPanels, setGeneratedPanels] = useState<StoryPanel[]>(() => {
    // Beim Start: Panels aus LocalStorage laden
    try {
      const saved = localStorage.getItem(STORAGE_KEY_PANELS)
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })
  const [isGenerating, setIsGenerating] = useState(false)
  const [backgroundColor, setBackgroundColor] = useState(loadedSettings?.backgroundColor || '#e8dfd0') // Feinblick Warm Sand
  const [avatarPosition, setAvatarPosition] = useState<AvatarPosition>(loadedSettings?.avatarPosition || 'bottom-center')
  const [useAvatar, setUseAvatar] = useState(true)
  const [removeAvatarBackground, setRemoveAvatarBackground] = useState(loadedSettings?.removeAvatarBackground ?? true)
  const [error, setError] = useState<string | null>(null)

  // Multi-Select für Panel-Bearbeitung
  const [selectedPanels, setSelectedPanels] = useState<number[]>([])
  const [showEditControls, setShowEditControls] = useState(false)

  // Edit-Einstellungen für ausgewählte Panels
  const [editBackgroundColor, setEditBackgroundColor] = useState(backgroundColor)
  const [editAvatarPosition, setEditAvatarPosition] = useState<AvatarPosition>(avatarPosition)
  const [editRemoveBackground, setEditRemoveBackground] = useState(removeAvatarBackground)
  const [editCustomFontSize, setEditCustomFontSize] = useState<number | undefined>(undefined)

  // Panels UND Einstellungen in LocalStorage speichern
  useEffect(() => {
    if (generatedPanels.length > 0) {
      // Panels speichern
      localStorage.setItem(STORAGE_KEY_PANELS, JSON.stringify(generatedPanels))

      // Einstellungen speichern
      const settings: SavedSettings = {
        backgroundColor,
        avatarPosition,
        removeAvatarBackground,
        numPanels
      }
      localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings))
    }
  }, [generatedPanels, backgroundColor, avatarPosition, removeAvatarBackground, numPanels])

  const handleAutoGenerate = async () => {
    if (!longStory.trim()) {
      setError('Bitte gib eine Geschichte ein')
      return
    }

    setIsGenerating(true)
    setError(null)

    try {
      const panels = await splitStoryIntoPanels(longStory, numPanels)

      // Wenn kein Avatar gewünscht, setze alle Emotionen auf leer
      if (!useAvatar) {
        panels.forEach(p => p.emotion = '')
      }

      // NEUE PANELS HINZUFÜGEN statt ersetzen (mit aktuellen Einstellungen)
      setGeneratedPanels(prev => {
        const startNumber = prev.length + 1
        const numberedPanels = panels.map((p, i) => ({
          ...p,
          panelNumber: startNumber + i,
          backgroundColor, // Einstellungen speichern
          avatarPosition,
          removeBackground: removeAvatarBackground
        }))
        return [...prev, ...numberedPanels]
      })
    } catch (err) {
      console.error('Fehler beim Generieren:', err)
      // Zeige die echte Fehlermeldung an
      const errorMessage = err instanceof Error ? err.message : 'Unbekannter Fehler'
      setError(
        `Fehler beim Generieren der Panels: ${errorMessage}`
      )
    } finally {
      setIsGenerating(false)
    }
  }

  const handleManualGenerate = async () => {
    // Validierung: mindestens 1 Panel mit Text
    const filledPanels = manualPanels.filter(p => p.trim().length > 0)

    if (filledPanels.length === 0) {
      setError('Bitte fülle mindestens ein Panel mit Text')
      return
    }

    setIsGenerating(true)
    setError(null)

    try {
      // Für jeden Panel die Emotion erkennen (falls Avatar gewünscht)
      const panelsWithEmotions = await Promise.all(
        manualPanels.map(async (text, index) => {
          if (!text.trim()) return null

          const emotion = useAvatar ? await detectEmotion(text) : ''
          return {
            text: text.trim(),
            emotion,
            panelNumber: index + 1
          }
        })
      )

      const validPanels = panelsWithEmotions.filter((p): p is StoryPanel => p !== null)

      // NEUE PANELS HINZUFÜGEN statt ersetzen (mit aktuellen Einstellungen)
      setGeneratedPanels(prev => {
        const startNumber = prev.length + 1
        const numberedPanels = validPanels.map((p, i) => ({
          ...p,
          panelNumber: startNumber + i,
          backgroundColor, // Einstellungen speichern
          avatarPosition,
          removeBackground: removeAvatarBackground
        }))
        return [...prev, ...numberedPanels]
      })
    } catch (err) {
      console.error('Fehler beim Generieren:', err)
      setError('Fehler beim Analysieren der Texte')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleChatPanelsGenerated = async (panelTexts: string[]) => {
    setIsGenerating(true)
    setError(null)

    try {
      // Für jeden Panel-Text die Emotion erkennen (falls Avatar gewünscht)
      const panelsWithEmotions = await Promise.all(
        panelTexts.map(async (text, index) => {
          const emotion = useAvatar ? await detectEmotion(text) : ''
          return {
            text: text.trim(),
            emotion,
            panelNumber: index + 1
          }
        })
      )

      // NEUE PANELS HINZUFÜGEN statt ersetzen (mit aktuellen Einstellungen)
      setGeneratedPanels(prev => {
        const startNumber = prev.length + 1
        const numberedPanels = panelsWithEmotions.map((p, i) => ({
          ...p,
          panelNumber: startNumber + i,
          backgroundColor, // Einstellungen speichern
          avatarPosition,
          removeBackground: removeAvatarBackground
        }))
        return [...prev, ...numberedPanels]
      })
    } catch (err) {
      console.error('Fehler beim Generieren:', err)
      setError('Fehler beim Analysieren der Panel-Texte')
    } finally {
      setIsGenerating(false)
    }
  }

  // Panel-Anzahl dynamisch anpassen
  const handleNumPanelsChange = (newNum: number) => {
    setNumPanels(newNum)
    setManualPanels(Array(newNum).fill('').map((_, i) => manualPanels[i] || ''))
  }

  const handleManualPanelChange = (index: number, value: string) => {
    const newPanels = [...manualPanels]
    newPanels[index] = value
    setManualPanels(newPanels)
  }

  const clearPanels = () => {
    setGeneratedPanels([])
    localStorage.removeItem(STORAGE_KEY_PANELS)
    localStorage.removeItem(STORAGE_KEY_SETTINGS)
    setError(null)
  }

  const deletePanel = (panelNumber: number) => {
    setGeneratedPanels(prev => prev.filter(p => p.panelNumber !== panelNumber))
  }

  const movePanelUp = (index: number) => {
    if (index === 0) return // Erstes Panel kann nicht nach oben
    setGeneratedPanels(prev => {
      const newPanels = [...prev]
      // Tausche mit dem Panel darüber
      ;[newPanels[index - 1], newPanels[index]] = [newPanels[index], newPanels[index - 1]]
      return newPanels
    })
  }

  const movePanelDown = (index: number) => {
    if (index === generatedPanels.length - 1) return // Letztes Panel kann nicht nach unten
    setGeneratedPanels(prev => {
      const newPanels = [...prev]
      // Tausche mit dem Panel darunter
      ;[newPanels[index], newPanels[index + 1]] = [newPanels[index + 1], newPanels[index]]
      return newPanels
    })
  }

  // Multi-Select Funktionen
  const togglePanelSelection = (panelNumber: number) => {
    setSelectedPanels(prev => {
      if (prev.includes(panelNumber)) {
        return prev.filter(n => n !== panelNumber)
      } else {
        return [...prev, panelNumber]
      }
    })
  }

  const selectAllPanels = () => {
    setSelectedPanels(generatedPanels.map(p => p.panelNumber))
  }

  const deselectAllPanels = () => {
    setSelectedPanels([])
  }

  // Einstellungen auf ausgewählte Panels anwenden
  const applySettingsToSelected = () => {
    if (selectedPanels.length === 0) return

    setGeneratedPanels(prev =>
      prev.map(panel => {
        if (selectedPanels.includes(panel.panelNumber)) {
          return {
            ...panel,
            backgroundColor: editBackgroundColor,
            avatarPosition: editAvatarPosition,
            removeBackground: editRemoveBackground,
            customFontSize: editCustomFontSize
          }
        }
        return panel
      })
    )

    // Erfolgsmeldung und Auswahl zurücksetzen
    setSelectedPanels([])
    setShowEditControls(false)
  }

  // Alle Panels herunterladen
  const downloadAllPanels = async () => {
    if (generatedPanels.length === 0) return

    // Erstelle ein temporäres Canvas für jedes Panel
    const tempCanvas = document.createElement('canvas')
    const timestamp = new Date().toISOString().slice(0, 10)

    for (let i = 0; i < generatedPanels.length; i++) {
      const panel = generatedPanels[i]

      // Avatar laden wenn vorhanden
      let avatarImage: HTMLImageElement | null = null

      if (panel.selectedAvatarId) {
        // Manuell ausgewählter Avatar
        const avatars = await import('@/lib/avatar-storage').then(m => m.getAvatars())
        const avatar = avatars.find(a => a.id === panel.selectedAvatarId)
        if (avatar) {
          avatarImage = new Image()
          avatarImage.src = avatar.imageData
          await new Promise(resolve => { avatarImage!.onload = resolve })
        }
      } else if (panel.emotion) {
        // Avatar basierend auf Emotion
        const avatar = getAvatarByEmotion(panel.emotion)
        if (avatar) {
          avatarImage = new Image()
          avatarImage.src = avatar.imageData
          await new Promise(resolve => { avatarImage!.onload = resolve })
        }
      }

      // Panel generieren
      generatePanel({
        text: panel.text,
        backgroundColor: panel.backgroundColor || backgroundColor,
        avatarImage,
        canvas: tempCanvas,
        avatarPosition: panel.avatarPosition || avatarPosition,
        panelNumber: panel.panelNumber,
        removeBackground: panel.removeBackground ?? removeAvatarBackground,
        customFontSize: panel.customFontSize
      })

      // Kleine Verzögerung zwischen Downloads
      await new Promise(resolve => setTimeout(resolve, 300))

      // Panel herunterladen
      const filename = `panel-${panel.panelNumber}-${timestamp}.png`
      downloadPanel(tempCanvas, filename)
    }
  }

  return (
    <div className="space-y-6">
      {/* Modus-Auswahl */}
      <div className="grid grid-cols-3 gap-2">
        <Button
          variant={mode === 'chat' ? 'default' : 'outline'}
          onClick={() => {
            setMode('chat')
            setError(null)
          }}
        >
          <MessageSquare className="w-4 h-4 mr-2" />
          Chat
        </Button>
        <Button
          variant={mode === 'auto' ? 'default' : 'outline'}
          onClick={() => {
            setMode('auto')
            setError(null)
          }}
        >
          <Sparkles className="w-4 h-4 mr-2" />
          Auto
        </Button>
        <Button
          variant={mode === 'manual' ? 'default' : 'outline'}
          onClick={() => {
            setMode('manual')
            setError(null)
          }}
        >
          Manuell
        </Button>
      </div>

      {/* Einstellungen */}
      <div className="space-y-4">
        {/* Panel-Anzahl */}
        <div>
          <Label htmlFor="numPanels">Anzahl Panels</Label>
          <div className="flex items-center gap-4 mt-2">
            <input
              id="numPanels"
              type="range"
              min="1"
              max="10"
              value={numPanels}
              onChange={(e) => handleNumPanelsChange(parseInt(e.target.value))}
              className="flex-1"
            />
            <span className="text-sm font-medium w-8 text-center">{numPanels}</span>
          </div>
        </div>

        <ColorPicker value={backgroundColor} onChange={setBackgroundColor} />

        {/* Avatar-Optionen */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <input
              id="useAvatar"
              type="checkbox"
              checked={useAvatar}
              onChange={(e) => setUseAvatar(e.target.checked)}
              className="w-4 h-4 cursor-pointer"
            />
            <Label htmlFor="useAvatar" className="cursor-pointer">
              Avatar verwenden
            </Label>
          </div>

          {useAvatar && (
            <>
              <div className="flex items-center gap-2 ml-6">
                <input
                  id="removeBackground"
                  type="checkbox"
                  checked={removeAvatarBackground}
                  onChange={(e) => {
                    setRemoveAvatarBackground(e.target.checked)
                    console.log('Hintergrund entfernen:', e.target.checked)
                  }}
                  className="w-4 h-4 cursor-pointer"
                />
                <Label htmlFor="removeBackground" className="cursor-pointer text-sm">
                  Hintergrund vom Avatar entfernen
                  <span className="ml-2 text-xs text-muted-foreground">
                    ({removeAvatarBackground ? 'AN' : 'AUS'})
                  </span>
                </Label>
              </div>

              <div>
                <Label>Avatar-Position</Label>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {POSITION_OPTIONS.map((option) => (
                    <Button
                      key={option.value}
                      variant={avatarPosition === option.value ? 'default' : 'outline'}
                      onClick={() => setAvatarPosition(option.value)}
                      size="sm"
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Eingabe-Bereich */}
      {mode === 'chat' ? (
        <div className="space-y-4">
          <div>
            <Label>KI-Chat: Entwickle deine Geschichte im Gespräch</Label>
            <p className="text-sm text-muted-foreground mt-2 mb-4">
              Chatte mit der KI über deine Ideen. Sie hilft dir, deine Gedanken zu strukturieren und formuliert am Ende {numPanels} Panel-Texte für dich.
            </p>
          </div>

          <ChatInterface
            numPanels={numPanels}
            onPanelsGenerated={handleChatPanelsGenerated}
          />
        </div>
      ) : mode === 'auto' ? (
        <div className="space-y-4">
          <div>
            <Label htmlFor="story">Deine Geschichte</Label>
            <Textarea
              id="story"
              placeholder="Schreibe deine Geschichte hier... Sie wird automatisch auf 5 Panels aufgeteilt."
              value={longStory}
              onChange={(e) => setLongStory(e.target.value)}
              rows={8}
              className="mt-2"
            />
          </div>

          <Button
            onClick={handleAutoGenerate}
            disabled={isGenerating || !longStory.trim()}
            className="w-full"
            size="lg"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generiere Panels...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Story in Panels aufteilen
              </>
            )}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            Gib für jeden Panel den Text ein. Du musst nicht alle 5 ausfüllen.
          </div>

          {manualPanels.map((text, index) => (
            <div key={index}>
              <Label htmlFor={`panel-${index}`}>Panel {index + 1}</Label>
              <Textarea
                id={`panel-${index}`}
                placeholder={`Text für Panel ${index + 1}...`}
                value={text}
                onChange={(e) => handleManualPanelChange(index, e.target.value)}
                rows={3}
                className="mt-2"
              />
            </div>
          ))}

          <Button
            onClick={handleManualGenerate}
            disabled={isGenerating}
            className="w-full"
            size="lg"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Analysiere Texte...
              </>
            ) : (
              'Panels generieren'
            )}
          </Button>
        </div>
      )}

      {/* Fehler-Anzeige */}
      {error && (
        <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-md text-sm">
          {error}
        </div>
      )}

      {/* Generierte Panels */}
      {generatedPanels.length > 0 && (
        <div className="space-y-6 pt-6 border-t">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold mb-2">
                Deine Story ({generatedPanels.length} Panels)
              </h3>
              <p className="text-sm text-muted-foreground">
                Panels bleiben gespeichert, auch wenn du Tabs wechselst
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="default"
                size="sm"
                onClick={downloadAllPanels}
              >
                <Download className="w-4 h-4 mr-2" />
                Alle herunterladen
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={clearPanels}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Alle löschen
              </Button>
            </div>
          </div>

          {/* Multi-Select Kontrollen */}
          <div className="flex gap-2 flex-wrap items-center">
            <Button
              variant="outline"
              size="sm"
              onClick={selectAllPanels}
            >
              Alle auswählen
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={deselectAllPanels}
              disabled={selectedPanels.length === 0}
            >
              Auswahl aufheben
            </Button>
            {selectedPanels.length > 0 && (
              <Button
                variant="default"
                size="sm"
                onClick={() => setShowEditControls(!showEditControls)}
              >
                {showEditControls ? 'Bearbeitung schließen' : `${selectedPanels.length} Panel(s) bearbeiten`}
              </Button>
            )}
          </div>

          {/* Edit-Kontrollen (wenn Panels ausgewählt sind) */}
          {showEditControls && selectedPanels.length > 0 && (
            <Card className="bg-secondary/50">
              <CardContent className="p-6 space-y-4">
                <h4 className="font-semibold">Einstellungen für {selectedPanels.length} Panel(s)</h4>

                {/* Hintergrundfarbe */}
                <div>
                  <Label>Hintergrundfarbe</Label>
                  <ColorPicker value={editBackgroundColor} onChange={setEditBackgroundColor} />
                </div>

                {/* Avatar-Position */}
                <div>
                  <Label>Avatar-Position</Label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {POSITION_OPTIONS.map((option) => (
                      <Button
                        key={option.value}
                        variant={editAvatarPosition === option.value ? 'default' : 'outline'}
                        onClick={() => setEditAvatarPosition(option.value)}
                        size="sm"
                      >
                        {option.label}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Hintergrund entfernen */}
                <div className="flex items-center gap-2">
                  <input
                    id="editRemoveBackground"
                    type="checkbox"
                    checked={editRemoveBackground}
                    onChange={(e) => setEditRemoveBackground(e.target.checked)}
                    className="w-4 h-4 cursor-pointer"
                  />
                  <Label htmlFor="editRemoveBackground" className="cursor-pointer">
                    Hintergrund vom Avatar entfernen
                  </Label>
                </div>

                {/* Schriftgröße */}
                <div>
                  <Label htmlFor="editFontSize">
                    Schriftgröße {editCustomFontSize ? `(${editCustomFontSize}px)` : '(Automatisch)'}
                  </Label>
                  <div className="flex items-center gap-4 mt-2">
                    <input
                      id="editFontSize"
                      type="range"
                      min="28"
                      max="56"
                      value={editCustomFontSize || 48}
                      onChange={(e) => setEditCustomFontSize(parseInt(e.target.value))}
                      className="flex-1"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditCustomFontSize(undefined)}
                    >
                      Auto
                    </Button>
                  </div>
                </div>

                {/* Anwenden Button */}
                <Button
                  onClick={applySettingsToSelected}
                  className="w-full"
                  size="lg"
                >
                  Einstellungen auf {selectedPanels.length} Panel(s) anwenden
                </Button>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {generatedPanels.sort((a, b) => a.panelNumber - b.panelNumber).map((panel, index) => (
              <Card key={panel.panelNumber} className={`relative ${selectedPanels.includes(panel.panelNumber) ? 'ring-2 ring-primary' : ''}`}>
                <CardContent className="p-6">
                  {/* Checkbox für Multi-Select */}
                  <div className="absolute top-2 left-2 z-10">
                    <input
                      type="checkbox"
                      checked={selectedPanels.includes(panel.panelNumber)}
                      onChange={() => togglePanelSelection(panel.panelNumber)}
                      className="w-5 h-5 cursor-pointer"
                      title="Panel auswählen"
                    />
                  </div>

                  {/* Panel Aktionen */}
                  <div className="absolute top-2 right-2 flex gap-2 z-10">
                    {/* Nach oben verschieben */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => movePanelUp(index)}
                      disabled={index === 0}
                      title="Nach oben verschieben"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </Button>

                    {/* Nach unten verschieben */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => movePanelDown(index)}
                      disabled={index === generatedPanels.length - 1}
                      title="Nach unten verschieben"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </Button>

                    {/* Löschen */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deletePanel(panel.panelNumber)}
                      className="text-destructive hover:text-destructive"
                      title="Panel löschen"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>

                  <PanelPreview
                    text={panel.text}
                    emotion={panel.emotion}
                    backgroundColor={panel.backgroundColor || backgroundColor}
                    avatarPosition={panel.avatarPosition || avatarPosition}
                    panelNumber={panel.panelNumber}
                    removeBackground={panel.removeBackground ?? removeAvatarBackground}
                    customFontSize={panel.customFontSize}
                    selectedAvatarId={panel.selectedAvatarId}
                    onUpdatePanel={(updates) => {
                      setGeneratedPanels(prev =>
                        prev.map(p =>
                          p.panelNumber === panel.panelNumber
                            ? { ...p, ...updates }
                            : p
                        )
                      )
                    }}
                  />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
