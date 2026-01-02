import { Check, X, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { logger } from '@/lib/logger'

interface PanelApprovalInterfaceProps {
  panelText: string
  generatedAvatarBase64: string | null
  backgroundColor?: string
  isGenerating: boolean
  onApprove: () => void
  onReject: () => void
  onRegenerate: () => void
}

export function PanelApprovalInterface({
  panelText,
  generatedAvatarBase64,
  backgroundColor = '#e8dfd0',
  isGenerating,
  onApprove,
  onReject,
  onRegenerate
}: PanelApprovalInterfaceProps) {

  const handleApprove = () => {
    logger.userAction('PanelApprovalInterface', 'approve_panel', {
      panelTextLength: panelText.length,
      hasAvatar: !!generatedAvatarBase64
    })
    onApprove()
  }

  const handleReject = () => {
    logger.userAction('PanelApprovalInterface', 'reject_panel', {
      panelTextLength: panelText.length
    })
    onReject()
  }

  const handleRegenerate = () => {
    logger.userAction('PanelApprovalInterface', 'regenerate_avatar', {
      panelTextLength: panelText.length
    })
    onRegenerate()
  }

  return (
    <Card className="max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Panel Vorschau & Genehmigung
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Beurteile das generierte Panel. Du kannst es annehmen, ablehnen oder den Avatar neu generieren.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Panel Vorschau */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Panel Vorschau:</label>
          <div
            className="relative border-2 rounded-lg overflow-hidden shadow-lg"
            style={{
              backgroundColor,
              aspectRatio: '1 / 1',
              minHeight: '400px',
              maxWidth: '500px',
              margin: '0 auto'
            }}
          >
            {/* Avatar Hintergrund */}
            {isGenerating ? (
              <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                <div className="text-center space-y-3">
                  <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-sm font-medium">Generiere Avatar...</p>
                  <p className="text-xs text-muted-foreground">Das kann 10-20 Sekunden dauern</p>
                </div>
              </div>
            ) : generatedAvatarBase64 ? (
              <img
                src={generatedAvatarBase64}
                alt="Generierter Avatar"
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-muted/50">
                <p className="text-sm text-muted-foreground">Kein Avatar generiert</p>
              </div>
            )}

            {/* Panel-Text Overlay */}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-6">
              <p className="text-white text-lg font-medium leading-relaxed text-center">
                {panelText}
              </p>
            </div>
          </div>
        </div>

        {/* Informationen */}
        <div className="text-sm text-muted-foreground space-y-1">
          <div className="flex justify-between">
            <span>Panel-Text Länge:</span>
            <span className="font-medium">{panelText.length} Zeichen</span>
          </div>
          <div className="flex justify-between">
            <span>Avatar-Status:</span>
            <span className="font-medium">
              {isGenerating ? 'Wird generiert...' : generatedAvatarBase64 ? 'Generiert ✓' : 'Fehlt'}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            onClick={handleReject}
            variant="outline"
            disabled={isGenerating}
            className="flex-1"
            size="lg"
          >
            <X className="w-4 h-4 mr-2" />
            Ablehnen
          </Button>

          <Button
            onClick={handleRegenerate}
            variant="outline"
            disabled={isGenerating || !generatedAvatarBase64}
            className="flex-1"
            size="lg"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isGenerating ? 'animate-spin' : ''}`} />
            Avatar neu generieren
          </Button>

          <Button
            onClick={handleApprove}
            variant="default"
            disabled={isGenerating || !generatedAvatarBase64}
            className="flex-1"
            size="lg"
          >
            <Check className="w-4 h-4 mr-2" />
            Annehmen & zu Sammlung hinzufügen
          </Button>
        </div>

        {/* Hinweise */}
        <div className="bg-muted/50 rounded-lg p-4 space-y-2">
          <p className="text-sm font-medium">💡 Hinweise:</p>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
            <li><strong>Annehmen:</strong> Panel wird zur Output-Sammlung hinzugefügt</li>
            <li><strong>Ablehnen:</strong> Panel wird verworfen, zurück zum Chat</li>
            <li><strong>Neu generieren:</strong> Behält den Text, generiert nur neuen Avatar</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}
