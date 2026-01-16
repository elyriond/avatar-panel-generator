import { useState, useRef, useEffect } from 'react'
import { Check, X, ChevronLeft, ChevronRight, Save, Edit, RefreshCw, Eye, RotateCcw, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { StoryPanel } from '@/lib/story-persistence'
import { logger } from '@/lib/logger'
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY)

interface StoryPreviewProps {
  panels: Omit<StoryPanel, 'id' | 'generatedAt'>[]
  suggestedTitle: string
  onApprove: (title: string, description?: string) => void
  onReject: () => void
  onRequestPanelEdit?: (panelIndex: number, userPrompt: string) => void  // Mit Chat-Feedback
  onRerollPanel?: (panelIndex: number) => void  // Einfach nochmal würfeln, keine Änderung
  onRegenerateAll?: () => void
  originalStoryboard?: Array<{ text: string; scene: string }>  // Das ursprüngliche Storyboard
  onRegenerateFromStoryboard?: () => void  // Callback für "Mit Storyboard neu generieren"
  isRegenerating?: boolean  // Loading-State für Panel-Regenerierung
  instagramCaption?: string  // Auto-generierte Caption
  instagramHashtags?: string  // Auto-generierte Hashtags
  comparisonMode?: {  // Vergleich zwischen alt und neu
    panelIndex: number
    oldPanel: Omit<StoryPanel, 'id' | 'generatedAt'>
    newPanel: Omit<StoryPanel, 'id' | 'generatedAt'>
  }
  onSelectPanel?: (panelIndex: number, useNew: boolean) => void  // User wählt alte oder neue Version
}

export function StoryPreview({
  panels,
  suggestedTitle,
  onApprove,
  onReject,
  onRequestPanelEdit,
  onRerollPanel,
  onRegenerateAll,
  originalStoryboard,
  onRegenerateFromStoryboard,
  isRegenerating,
  instagramCaption,
  instagramHashtags,
  comparisonMode,
  onSelectPanel
}: StoryPreviewProps) {
  const [currentPanelIndex, setCurrentPanelIndex] = useState(0)
  const [title, setTitle] = useState(suggestedTitle)
  const [description, setDescription] = useState('')
  const [showMetadata, setShowMetadata] = useState(false)
  const [showPromptsModal, setShowPromptsModal] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [editingPanelIndex, setEditingPanelIndex] = useState<number | null>(null)
  const [editPrompt, setEditPrompt] = useState('')

  // Mini-Chat States
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'assistant', content: string }>>([])
  const [chatInput, setChatInput] = useState('')
  const [isChatLoading, setIsChatLoading] = useState(false)
  const [showPromptReview, setShowPromptReview] = useState(false)
  const [generatedPrompt, setGeneratedPrompt] = useState('')

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

  const handleOpenEditDialog = (panelIndex: number) => {
    logger.userAction('StoryPreview', 'open_edit_dialog', { panelIndex })
    setEditingPanelIndex(panelIndex)
    setEditPrompt('')
    setChatMessages([
      {
        role: 'assistant',
        content: `Hallo! Ich helfe dir, dieses Panel zu verbessern.\n\n✨ Das aktuelle Panel-Bild + deine Referenzbilder sind bereits im System - ich habe alles was ich brauche!\n\nDu kannst mir sagen:\n• Text-Änderungen (z.B. "Ersetze 'blank' durch 'leer'")\n• Bild-Anpassungen (z.B. "Mach es heller", "Fröhlicherer Gesichtsausdruck", "Avatar soll exakter aussehen")\n\nWas möchtest du ändern?`
      }
    ])
    setChatInput('')
    setShowPromptReview(false)
    setGeneratedPrompt('')
    setShowEditDialog(true)
  }

  const handleSendChatMessage = async () => {
    if (!chatInput.trim() || editingPanelIndex === null) return

    const userMessage = chatInput.trim()
    setChatInput('')
    setIsChatLoading(true)

    // User-Nachricht hinzufügen
    setChatMessages(prev => [...prev, { role: 'user', content: userMessage }])

    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-preview-09-2025' })

      const panel = panels[editingPanelIndex]
      const systemPrompt = `Du bist ein Experte für Comic-Panel-Verbesserung. Der User möchte Änderungen an einem Panel vornehmen.

AKTUELLES PANEL:
Text: "${panel.panelText}"
Bild-Beschreibung: "${panel.sceneDescription || 'Comic panel illustration'}"

WICHTIG - TECHNISCHER KONTEXT:
- Dies ist IMAGE-TO-IMAGE Editing mit Imagen 4
- Das AKTUELLE PANEL-BILD wird automatisch als HAUPT-REFERENZ mitgeschickt
- Die CHARACTER-REFERENZBILDER (7 Profilbilder) werden automatisch mitgeschickt
- Du musst NICHT nach Referenzbildern fragen - sie sind bereits im System!
- Der Bild-Generator hat VOLLE Kenntnis des aktuellen Avatars

WIE DER PROZESS FUNKTIONIERT:
1. User sagt dir die Änderungswünsche
2. Du verstehst die Wünsche und fragst nach wenn nötig
3. Am Ende generierst du einen englischen Imagen-Prompt
4. Der Prompt beginnt IMMER mit: "Keep same composition and style as input image."
5. Dann beschreibst du NUR die Änderungen

DEINE AUFGABE:
- Verstehe die Änderungswünsche des Users (Text-Änderungen ODER Bild-Anpassungen ODER beides)
- Stelle Rückfragen wenn etwas unklar ist
- Hilf beim Präzisieren der Wünsche
- **NIEMALS nach Referenzbildern fragen** - die sind schon da!
- Wenn User sagt "Avatar soll wie Referenzbild aussehen" → Das ist bereits der Fall, frage nach spezifischen Änderungen
- Sei freundlich, natürlich und unterstützend

Antworte kurz und klar auf Deutsch.`

      const chatHistory = chatMessages.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }]
      }))

      const chat = model.startChat({
        history: [
          { role: 'user', parts: [{ text: systemPrompt }] },
          { role: 'model', parts: [{ text: 'Verstanden. Ich helfe beim Verbessern des Panels.' }] },
          ...chatHistory
        ]
      })

      const result = await chat.sendMessage(userMessage)
      const assistantResponse = result.response.text()

      setChatMessages(prev => [...prev, { role: 'assistant', content: assistantResponse }])

    } catch (error) {
      console.error('Chat-Fehler:', error)
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Entschuldigung, da ist ein Fehler aufgetreten. Bitte versuche es erneut.'
      }])
    } finally {
      setIsChatLoading(false)
    }
  }

  const handleGeneratePrompt = async () => {
    if (editingPanelIndex === null) return

    setIsChatLoading(true)

    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-preview-09-2025' })

      const panel = panels[editingPanelIndex]
      const conversationText = chatMessages
        .map(msg => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
        .join('\n\n')

      const promptGenerationPrompt = `Basierend auf dieser Konversation über Panel-Verbesserungen, erstelle einen präzisen englischen Prompt für Imagen 4.

AKTUELLES PANEL:
Text: "${panel.panelText}"
Scene: "${panel.sceneDescription || 'Comic panel illustration'}"

KONVERSATION:
${conversationText}

WICHTIG - TECHNISCHER KONTEXT:
- Das AKTUELLE PANEL-BILD wird als Haupt-Referenz mitgeschickt (image_input)
- Zusätzlich werden 7 CHARACTER-REFERENZBILDER automatisch mitgeschickt
- Der Bild-Generator kennt bereits das Aussehen des Characters perfekt
- Der Prompt soll das Bild MODIFIZIEREN, nicht komplett neu erstellen
- Beginne mit: "Keep same composition and style as input image."
- Dann beschreibe NUR die gewünschten Änderungen
- Wenn User "Avatar soll wie Referenz aussehen" sagt → Das ist BEREITS der Fall durch die Referenzbilder, fokussiere auf spezifische Anpassungen
- Sei präzise und technisch
- Englisch!

BEISPIEL:
"Keep same composition and style as input image. Change text from 'blank' to 'leer'. Make background 30% brighter, increase luminosity. Maintain character consistency and pose."

GENERIERTER PROMPT (nur der Prompt, keine Erklärungen):`

      const result = await model.generateContent(promptGenerationPrompt)
      const prompt = result.response.text().trim()

      setGeneratedPrompt(prompt)
      setShowPromptReview(true)

    } catch (error) {
      console.error('Prompt-Generierung-Fehler:', error)
      alert('Fehler beim Generieren des Prompts. Bitte versuche es erneut.')
    } finally {
      setIsChatLoading(false)
    }
  }

  const handleSubmitEdit = async () => {
    if (editingPanelIndex !== null && generatedPrompt.trim() && onRequestPanelEdit) {
      logger.userAction('StoryPreview', 'submit_panel_edit', {
        panelIndex: editingPanelIndex,
        promptLength: generatedPrompt.length
      })
      // Rufe Regenerierung auf mit dem generierten/editierten Prompt
      await onRequestPanelEdit(editingPanelIndex, generatedPrompt)
      // Wenn fertig, schließe Dialog
      setShowEditDialog(false)
      setShowPromptReview(false)
      setGeneratedPrompt('')
      setChatMessages([])
      setEditingPanelIndex(null)
    }
  }

  const chatMessagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    chatMessagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  // Keyboard Navigation: Pfeiltasten für Panel-Navigation + ESC für Comparison Close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ESC schließt Comparison Dialog (behält alte Version)
      if (e.key === 'Escape' && comparisonMode && onSelectPanel) {
        e.preventDefault()
        onSelectPanel(comparisonMode.panelIndex, false)
        return
      }

      // Nur wenn kein Input/Textarea fokussiert ist
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        handlePrevious()
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        handleNext()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentPanelIndex, totalPanels, comparisonMode, onSelectPanel])

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

          {/* Edit & Reroll Buttons für aktuelles Panel - Prominent! */}
          {(onRequestPanelEdit || onRerollPanel) && (
            <div className="p-4 border-t bg-primary/5 space-y-3">
              <div className="grid grid-cols-1 gap-3">
                {/* Reroll Button - Primäre Option */}
                {onRerollPanel && (
                  <Button
                    onClick={() => onRerollPanel(currentPanelIndex)}
                    variant="default"
                    size="lg"
                    className="w-full text-base font-semibold"
                    disabled={isRegenerating}
                  >
                    <RefreshCw className="w-5 h-5 mr-2" />
                    🎲 Neu würfeln (bessere Character Consistency)
                  </Button>
                )}

                {/* Edit Button - Sekundäre Option */}
                {onRequestPanelEdit && (
                  <Button
                    onClick={() => handleOpenEditDialog(currentPanelIndex)}
                    variant="outline"
                    size="lg"
                    className="w-full text-base font-semibold"
                    disabled={isRegenerating}
                  >
                    <Edit className="w-5 h-5 mr-2" />
                    ✏️ Mit Feedback überarbeiten
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-2 text-center">
                {onRerollPanel && onRequestPanelEdit
                  ? '🎲 = Nochmal versuchen, bessere Ähnlichkeit • ✏️ = Änderungen kommunizieren'
                  : 'Nur dieses Panel wird neu generiert'
                }
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Thumbnail Strip */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {panels.map((panel, index) => (
          <div key={index} className="relative flex-shrink-0">
            <button
              onClick={() => setCurrentPanelIndex(index)}
              className={`relative w-20 h-20 rounded border-2 overflow-hidden transition-all ${
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
            {/* Reroll & Edit Buttons für Thumbnail */}
            <div className="absolute -top-2 -right-2 flex gap-1">
              {onRerollPanel && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onRerollPanel(index)
                  }}
                  className="bg-green-600 text-white rounded-full p-2 shadow-lg hover:bg-green-700 hover:scale-110 transition-all border-2 border-white"
                  title={`Panel ${index + 1} neu würfeln`}
                  disabled={isRegenerating}
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              )}
              {onRequestPanelEdit && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleOpenEditDialog(index)
                  }}
                  className="bg-primary text-primary-foreground rounded-full p-2 shadow-lg hover:bg-primary-strong hover:scale-110 transition-all border-2 border-white"
                  title={`Panel ${index + 1} überarbeiten`}
                  disabled={isRegenerating}
                >
                  <Edit className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Instagram Post Vorbereitung */}
      {(instagramCaption || instagramHashtags) && (
        <Card className="border-2 border-green-300 bg-green-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-800">
              <span className="text-xl">📱</span>
              Instagram Post vorbereitet
            </CardTitle>
            <p className="text-sm text-green-700">
              Caption und Hashtags wurden automatisch generiert - einfach kopieren & in Instagram einfügen!
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {instagramCaption && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm font-semibold text-green-800">Caption:</Label>
                  <Button
                    onClick={() => {
                      navigator.clipboard.writeText(instagramCaption)
                      logger.userAction('StoryPreview', 'copy_instagram_caption')
                    }}
                    variant="outline"
                    size="sm"
                    className="border-green-300 hover:bg-green-100"
                  >
                    📋 Caption kopieren
                  </Button>
                </div>
                <Textarea
                  value={instagramCaption}
                  readOnly
                  rows={4}
                  className="bg-white border-green-200 text-sm"
                />
              </div>
            )}

            {instagramHashtags && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-sm font-semibold text-green-800">Hashtags:</Label>
                  <Button
                    onClick={() => {
                      navigator.clipboard.writeText(instagramHashtags)
                      logger.userAction('StoryPreview', 'copy_instagram_hashtags')
                    }}
                    variant="outline"
                    size="sm"
                    className="border-green-300 hover:bg-green-100"
                  >
                    📋 Hashtags kopieren
                  </Button>
                </div>
                <Textarea
                  value={instagramHashtags}
                  readOnly
                  rows={3}
                  className="bg-white border-green-200 text-xs font-mono"
                />
              </div>
            )}

            {/* Alles kopieren Button */}
            {instagramCaption && instagramHashtags && (
              <Button
                onClick={() => {
                  const fullPost = `${instagramCaption}\n\n${instagramHashtags}`
                  navigator.clipboard.writeText(fullPost)
                  logger.userAction('StoryPreview', 'copy_full_instagram_post')
                }}
                variant="default"
                size="lg"
                className="w-full bg-green-600 hover:bg-green-700"
              >
                📱 Kompletten Post kopieren (Caption + Hashtags)
              </Button>
            )}

            <p className="text-xs text-green-700 text-center">
              💡 Tipp: Du kannst Caption und Hashtags auch nachträglich in der Galerie kopieren!
            </p>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex flex-col gap-3">
        {/* Prompts anzeigen Button */}
        <Button
          onClick={() => setShowPromptsModal(true)}
          variant="outline"
          size="lg"
          className="w-full border-2 border-blue-300 hover:border-blue-500 hover:bg-blue-50"
        >
          <Eye className="w-5 h-5 mr-2" />
          📋 Prompts & Scenes anzeigen
        </Button>

        {/* Regenerate mit Storyboard Button - nur wenn originalStoryboard vorhanden */}
        {originalStoryboard && onRegenerateFromStoryboard && (
          <Button
            onClick={() => {
              logger.userAction('StoryPreview', 'regenerate_from_storyboard')
              onRegenerateFromStoryboard()
            }}
            variant="outline"
            size="lg"
            className="w-full border-2 border-green-300 hover:border-green-500 hover:bg-green-50"
          >
            <RotateCcw className="w-5 h-5 mr-2" />
            ♻️ Mit diesem Storyboard neu generieren
          </Button>
        )}

        {/* Regenerate Button - Prominent wenn verfügbar */}
        {onRegenerateAll && (
          <Button
            onClick={() => {
              logger.userAction('StoryPreview', 'regenerate_all_panels')
              onRegenerateAll()
            }}
            variant="outline"
            size="lg"
            className="w-full border-2 border-primary/30 hover:border-primary hover:bg-primary/5"
          >
            <RefreshCw className="w-5 h-5 mr-2" />
            🔄 Komplette Story neu generieren
          </Button>
        )}

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
      </div>

      {/* Info Box */}
      <div className="bg-muted/50 rounded-lg p-4 space-y-2">
        <p className="text-sm font-medium">💡 Story-Verwaltung:</p>
        <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
          <li><strong>📋 Prompts anzeigen:</strong> Zeige die Scene Descriptions und Image Prompts</li>
          {originalStoryboard && <li><strong>♻️ Mit Storyboard neu:</strong> Generiere Story mit denselben Texten/Scenes neu</li>}
          <li><strong>🎲 Panel neu würfeln:</strong> Nochmal versuchen mit verbesserter Character Consistency</li>
          <li><strong>✏️ Panel mit Feedback bearbeiten:</strong> Änderungswünsche per Chat kommunizieren (z.B. "heller", "fröhlicher")</li>
          <li><strong>🔄 Komplette Story neu:</strong> Alle Panels werden mit denselben Texten neu generiert</li>
          <li><strong>💾 Speichern:</strong> Story wird in deiner Galerie gespeichert</li>
          <li><strong>❌ Verwerfen:</strong> Story löschen und zurück zum Chat</li>
        </ul>
      </div>

      {/* Edit Dialog */}
      {showEditDialog && editingPanelIndex !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !isRegenerating && setShowEditDialog(false)}>
          <div className="bg-background rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="sticky top-0 bg-background border-b p-6 flex items-center justify-between">
              <h2 className="text-2xl font-semibold">✏️ Panel {editingPanelIndex + 1} bearbeiten</h2>
              <Button onClick={() => !isRegenerating && setShowEditDialog(false)} variant="ghost" size="sm" disabled={isRegenerating}>
                <X className="w-5 h-5" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
                {/* Left: Panel Preview */}
                <div>
                  <Label className="text-sm font-semibold text-muted-foreground mb-2">Aktuelles Panel:</Label>
                  <div className="relative rounded-lg overflow-hidden border-2 border-muted sticky top-0">
                    <img
                      src={panels[editingPanelIndex].avatarBase64}
                      alt={`Panel ${editingPanelIndex + 1}`}
                      className="w-full h-auto"
                    />
                  </div>
                </div>

                {/* Right: Chat or Prompt Review */}
                <div className="flex flex-col h-full">
                  {!showPromptReview ? (
                    /* Chat-Modus */
                    <>
                      <Label className="text-sm font-semibold text-muted-foreground mb-2">💬 KI-Berater:</Label>

                      {/* Chat Messages */}
                      <div className="flex-1 border rounded-lg p-4 mb-4 overflow-y-auto bg-muted/20 space-y-3" style={{ minHeight: '300px', maxHeight: '400px' }}>
                        {chatMessages.map((msg, idx) => (
                          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[80%] px-4 py-2 rounded-lg ${
                              msg.role === 'user'
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-background border'
                            }`}>
                              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                            </div>
                          </div>
                        ))}
                        {isChatLoading && (
                          <div className="flex justify-start">
                            <div className="bg-background border px-4 py-2 rounded-lg flex items-center gap-2">
                              <div className="animate-spin rounded-full h-3 w-3 border-2 border-primary border-t-transparent" />
                              <span className="text-sm text-muted-foreground">Denkt nach...</span>
                            </div>
                          </div>
                        )}
                        <div ref={chatMessagesEndRef} />
                      </div>

                      {/* Chat Input */}
                      <div className="flex gap-2 mb-4">
                        <Input
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault()
                              handleSendChatMessage()
                            }
                          }}
                          placeholder="z.B. 'Ersetze das Wort blank durch leer' oder 'Mach es heller'"
                          disabled={isChatLoading || isRegenerating}
                          className="flex-1"
                        />
                        <Button
                          onClick={handleSendChatMessage}
                          disabled={!chatInput.trim() || isChatLoading || isRegenerating}
                          size="icon"
                        >
                          <Send className="w-4 h-4" />
                        </Button>
                      </div>

                      {/* Generate Prompt Button */}
                      <Button
                        onClick={handleGeneratePrompt}
                        disabled={chatMessages.length < 3 || isChatLoading || isRegenerating}
                        className="w-full"
                        size="lg"
                      >
                        <Eye className="w-5 h-5 mr-2" />
                        ✨ Prompt generieren & reviewen
                      </Button>
                    </>
                  ) : (
                    /* Prompt-Review-Modus */
                    <>
                      <Label className="text-sm font-semibold text-muted-foreground mb-2">✨ Generierter Prompt:</Label>
                      <p className="text-xs text-muted-foreground mb-3">
                        Du kannst den Prompt jetzt noch anpassen, bevor das Panel regeneriert wird.
                      </p>

                      <Textarea
                        value={generatedPrompt}
                        onChange={(e) => setGeneratedPrompt(e.target.value)}
                        rows={10}
                        className="flex-1 mb-4 font-mono text-sm"
                        placeholder="Der generierte Prompt erscheint hier..."
                      />

                      {/* Actions */}
                      <div className="flex gap-3">
                        <Button
                          onClick={() => setShowPromptReview(false)}
                          variant="outline"
                          className="flex-1"
                          disabled={isRegenerating}
                        >
                          ← Zurück zum Chat
                        </Button>
                        <Button
                          onClick={handleSubmitEdit}
                          disabled={!generatedPrompt.trim() || isRegenerating}
                          className="flex-1"
                        >
                          {isRegenerating ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent mr-2" />
                              Regeneriert...
                            </>
                          ) : (
                            <>
                              <RefreshCw className="w-4 h-4 mr-2" />
                              Panel regenerieren
                            </>
                          )}
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Loading Overlay während Regenerierung */}
            {isRegenerating && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <div className="bg-background rounded-lg p-6 max-w-md">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="animate-spin rounded-full h-6 w-6 border-3 border-primary border-t-transparent" />
                    <span className="text-lg font-semibold">🤖 Regeneriere Panel...</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Das aktuelle Bild wird als Basis verwendet und gemäß deinen Änderungswünschen modifiziert.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Prompts Modal */}
      {showPromptsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowPromptsModal(false)}>
          <div className="bg-background rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-background border-b p-6 flex items-center justify-between">
              <h2 className="text-2xl font-semibold">📋 Prompts & Scene Descriptions</h2>
              <Button onClick={() => setShowPromptsModal(false)} variant="ghost" size="sm">
                <X className="w-5 h-5" />
              </Button>
            </div>

            <div className="overflow-y-auto p-6 space-y-6" style={{ maxHeight: 'calc(90vh - 120px)' }}>
              {panels.map((panel, index) => (
                <Card key={index} className={index === currentPanelIndex ? 'border-2 border-primary' : ''}>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <span className="bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">
                        {index + 1}
                      </span>
                      Panel {index + 1}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Panel Text */}
                    <div>
                      <Label className="text-sm font-semibold text-muted-foreground">🇩🇪 Panel-Text (Deutsch)</Label>
                      <p className="mt-2 p-3 bg-muted rounded-lg text-sm">{panel.panelText}</p>
                    </div>

                    {/* Scene Description */}
                    {panel.sceneDescription && (
                      <div>
                        <Label className="text-sm font-semibold text-muted-foreground">🎬 Scene Description (Englisch)</Label>
                        <p className="mt-2 p-3 bg-blue-50 rounded-lg text-sm font-mono whitespace-pre-wrap">{panel.sceneDescription}</p>
                      </div>
                    )}

                    {/* Original Storyboard Scene (falls vorhanden und anders) */}
                    {originalStoryboard && originalStoryboard[index] && originalStoryboard[index].scene !== panel.sceneDescription && (
                      <div>
                        <Label className="text-sm font-semibold text-amber-600">🎬 Original Scene (vor Bearbeitung)</Label>
                        <p className="mt-2 p-3 bg-amber-50 rounded-lg text-sm font-mono whitespace-pre-wrap">{originalStoryboard[index].scene}</p>
                      </div>
                    )}

                    {/* Image Prompt */}
                    <div>
                      <Label className="text-sm font-semibold text-muted-foreground">🎨 Image Prompt (Technisch)</Label>
                      <pre className="mt-2 p-3 bg-slate-100 rounded-lg text-xs overflow-x-auto">{panel.imagePrompt}</pre>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Comparison Modal - Altes vs Neues Panel */}
      {comparisonMode && onSelectPanel && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4"
          onClick={() => {
            // Klick auf Hintergrund = Alte Version behalten
            onSelectPanel(comparisonMode.panelIndex, false)
          }}
        >
          <div className="bg-background rounded-lg shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="bg-background border-b p-6 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-semibold">🔄 Welche Version möchtest du behalten?</h2>
                <p className="text-sm text-muted-foreground mt-2">
                  Panel {comparisonMode.panelIndex + 1}: Vergleiche die alte und neue Version
                </p>
              </div>
              <Button
                onClick={() => onSelectPanel(comparisonMode.panelIndex, false)}
                variant="ghost"
                size="sm"
                className="text-lg"
              >
                <X className="w-6 h-6" />
              </Button>
            </div>

            {/* Comparison Grid - Scrollable */}
            <div className="grid grid-cols-2 gap-6 p-6 max-h-[60vh] overflow-y-auto">
              {/* ALTE VERSION */}
              <div className="space-y-4">
                <div className="text-center">
                  <h3 className="text-lg font-semibold text-muted-foreground">📜 Alte Version</h3>
                  <p className="text-xs text-muted-foreground">Klicke auf das Bild zum Auswählen</p>
                </div>
                <div
                  className="relative rounded-lg overflow-hidden border-4 border-muted hover:border-muted-foreground transition-all cursor-pointer hover:shadow-xl"
                  onClick={(e) => {
                    e.stopPropagation()
                    onSelectPanel(comparisonMode.panelIndex, false)
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onSelectPanel(comparisonMode.panelIndex, false)
                    }
                  }}
                >
                  <img
                    src={comparisonMode.oldPanel.avatarBase64}
                    alt="Alte Version"
                    className="w-full h-auto"
                  />
                  <div className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-all flex items-center justify-center">
                    <div className="bg-white/90 px-4 py-2 rounded-lg opacity-0 hover:opacity-100 transition-opacity font-semibold">
                      ← Auswählen
                    </div>
                  </div>
                </div>
              </div>

              {/* NEUE VERSION */}
              <div className="space-y-4">
                <div className="text-center">
                  <h3 className="text-lg font-semibold text-primary">✨ Neue Version</h3>
                  <p className="text-xs text-muted-foreground">Klicke auf das Bild zum Auswählen</p>
                </div>
                <div
                  className="relative rounded-lg overflow-hidden border-4 border-primary hover:border-primary-strong transition-all cursor-pointer hover:shadow-xl"
                  onClick={(e) => {
                    e.stopPropagation()
                    onSelectPanel(comparisonMode.panelIndex, true)
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onSelectPanel(comparisonMode.panelIndex, true)
                    }
                  }}
                >
                  <img
                    src={comparisonMode.newPanel.avatarBase64}
                    alt="Neue Version"
                    className="w-full h-auto"
                  />
                  <div className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-all flex items-center justify-center">
                    <div className="bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg opacity-0 hover:opacity-100 transition-opacity font-semibold">
                      Auswählen →
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Info */}
            <div className="border-t p-4 bg-muted/50">
              <p className="text-sm font-semibold text-center mb-2">
                🖱️ Klicke direkt auf ein Bild zum Auswählen | ⌨️ ESC = Alte behalten
              </p>
              <p className="text-xs text-muted-foreground text-center">
                💡 Tipp: Du kannst auch später noch weitere Änderungen vornehmen (Neu würfeln oder mit Feedback bearbeiten)
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
