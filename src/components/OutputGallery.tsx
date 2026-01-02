import { useState } from 'react'
import { Download, Trash2, GripVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { logger } from '@/lib/logger'
import { exportPanelsAsZip, exportPanelAsPNG, type ApprovedPanel } from '@/lib/panel-exporter'

interface OutputGalleryProps {
  panels: ApprovedPanel[]
  onRemovePanel: (panelId: string) => void
  onReorderPanels?: (panels: ApprovedPanel[]) => void
}

export function OutputGallery({
  panels,
  onRemovePanel,
  onReorderPanels
}: OutputGalleryProps) {
  const [isExporting, setIsExporting] = useState(false)
  const [exportingSingle, setExportingSingle] = useState<string | null>(null)

  const handleExportAll = async () => {
    if (panels.length === 0) {
      alert('Keine Panels zum Exportieren vorhanden')
      return
    }

    logger.userAction('OutputGallery', 'export_all_panels', {
      panelCount: panels.length
    })

    setIsExporting(true)

    try {
      const zipBlob = await exportPanelsAsZip(panels)

      // Download ZIP
      const url = URL.createObjectURL(zipBlob)
      const link = document.createElement('a')
      link.href = url
      link.download = `instagram-panels-${new Date().toISOString().split('T')[0]}.zip`
      link.click()
      URL.revokeObjectURL(url)

      logger.info('Panels erfolgreich als ZIP exportiert', {
        component: 'OutputGallery',
        data: { panelCount: panels.length }
      })
    } catch (error) {
      logger.error('Fehler beim Exportieren der Panels', {
        component: 'OutputGallery',
        data: error
      })
      alert('Fehler beim Exportieren. Bitte versuche es erneut.')
    } finally {
      setIsExporting(false)
    }
  }

  const handleExportSingle = async (panel: ApprovedPanel) => {
    logger.userAction('OutputGallery', 'export_single_panel', {
      panelId: panel.id
    })

    setExportingSingle(panel.id)

    try {
      const pngBlob = await exportPanelAsPNG(panel)

      // Download PNG
      const url = URL.createObjectURL(pngBlob)
      const link = document.createElement('a')
      link.href = url
      link.download = `panel-${panel.id.slice(0, 8)}.png`
      link.click()
      URL.revokeObjectURL(url)

      logger.info('Panel erfolgreich als PNG exportiert', {
        component: 'OutputGallery',
        data: { panelId: panel.id }
      })
    } catch (error) {
      logger.error('Fehler beim Exportieren des Panels', {
        component: 'OutputGallery',
        data: error
      })
      alert('Fehler beim Exportieren. Bitte versuche es erneut.')
    } finally {
      setExportingSingle(null)
    }
  }

  const handleRemove = (panelId: string) => {
    if (confirm('Möchtest du dieses Panel wirklich aus der Sammlung entfernen?')) {
      logger.userAction('OutputGallery', 'remove_panel', { panelId })
      onRemovePanel(panelId)
    }
  }

  if (panels.length === 0) {
    return (
      <Card className="max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle>Panel-Sammlung</CardTitle>
          <p className="text-sm text-muted-foreground">
            Hier erscheinen deine genehmigten Panels. Aktuell ist die Sammlung leer.
          </p>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-lg mb-2">Keine Panels vorhanden</p>
            <p className="text-sm">
              Generiere Panels im Chat und genehmige sie, um sie hier zu sehen.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="max-w-6xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Panel-Sammlung ({panels.length})</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Verwalte und exportiere deine genehmigten Instagram-Panels
            </p>
          </div>
          <Button
            onClick={handleExportAll}
            disabled={isExporting || panels.length === 0}
            size="lg"
          >
            {isExporting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Exportiere...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Alle als ZIP exportieren
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {panels.map((panel, index) => (
            <div
              key={panel.id}
              className="group relative border-2 rounded-lg overflow-hidden hover:border-primary transition-colors"
            >
              {/* Drag Handle (for future drag & drop) */}
              {onReorderPanels && (
                <div className="absolute top-2 left-2 z-10 bg-black/50 rounded p-1 cursor-move opacity-0 group-hover:opacity-100 transition-opacity">
                  <GripVertical className="w-4 h-4 text-white" />
                </div>
              )}

              {/* Panel Number Badge */}
              <div className="absolute top-2 right-2 z-10 bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold">
                {index + 1}
              </div>

              {/* Panel Preview */}
              <div
                className="relative aspect-square"
                style={{ backgroundColor: panel.backgroundColor }}
              >
                {panel.avatarBase64 && (
                  <img
                    src={panel.avatarBase64}
                    alt={`Panel ${index + 1}`}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                )}

                {/* Text Overlay */}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4">
                  <p className="text-white text-sm font-medium line-clamp-3">
                    {panel.panelText}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 p-2 bg-muted">
                <Button
                  onClick={() => handleExportSingle(panel)}
                  disabled={exportingSingle === panel.id}
                  variant="outline"
                  size="sm"
                  className="flex-1"
                >
                  {exportingSingle === panel.id ? (
                    <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Download className="w-3 h-3 mr-1" />
                      PNG
                    </>
                  )}
                </Button>
                <Button
                  onClick={() => handleRemove(panel.id)}
                  variant="outline"
                  size="sm"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Info Box */}
        <div className="mt-6 bg-muted/50 rounded-lg p-4 space-y-2">
          <p className="text-sm font-medium">📦 Export-Informationen:</p>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
            <li><strong>ZIP-Export:</strong> Alle Panels als nummerierte PNG-Dateien (panel-01.png, panel-02.png, etc.)</li>
            <li><strong>Einzelexport:</strong> Lade einzelne Panels als PNG herunter</li>
            <li><strong>Format:</strong> 1080x1080px, optimiert für Instagram</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}
