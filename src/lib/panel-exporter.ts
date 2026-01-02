/**
 * Panel Exporter
 * Exportiert genehmigte Panels als PNG oder ZIP
 */

import { logger } from './logger'

export interface ApprovedPanel {
  id: string
  panelText: string
  avatarBase64: string
  backgroundColor: string
  generatedAt: Date
  imagePrompt: string  // Für Reproduzierbarkeit
}

const CANVAS_SIZE = 1080  // Instagram optimal size (1080x1080)

/**
 * Erstellt ein Canvas mit Panel-Inhalt
 */
async function createPanelCanvas(panel: ApprovedPanel): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas')
  canvas.width = CANVAS_SIZE
  canvas.height = CANVAS_SIZE
  const ctx = canvas.getContext('2d')

  if (!ctx) {
    throw new Error('Canvas context nicht verfügbar')
  }

  // Hintergrundfarbe
  ctx.fillStyle = panel.backgroundColor
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)

  // Avatar-Bild laden und zeichnen
  if (panel.avatarBase64) {
    await new Promise<void>((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        ctx.drawImage(img, 0, 0, CANVAS_SIZE, CANVAS_SIZE)
        resolve()
      }
      img.onerror = reject
      img.src = panel.avatarBase64
    })
  }

  return canvas
}

/**
 * Exportiert ein einzelnes Panel als PNG Blob
 */
export async function exportPanelAsPNG(panel: ApprovedPanel): Promise<Blob> {
  logger.info('Exportiere Panel als PNG', {
    component: 'PanelExporter',
    data: { panelId: panel.id }
  })

  try {
    const canvas = await createPanelCanvas(panel)

    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            logger.info('Panel erfolgreich als PNG exportiert', {
              component: 'PanelExporter',
              data: { panelId: panel.id, size: blob.size }
            })
            resolve(blob)
          } else {
            reject(new Error('PNG Blob konnte nicht erstellt werden'))
          }
        },
        'image/png',
        1.0  // Maximale Qualität
      )
    })
  } catch (error) {
    logger.error('Fehler beim Exportieren als PNG', {
      component: 'PanelExporter',
      data: error
    })
    throw error
  }
}

/**
 * Exportiert alle Panels als ZIP
 */
export async function exportPanelsAsZip(panels: ApprovedPanel[]): Promise<Blob> {
  logger.info('Exportiere Panels als ZIP', {
    component: 'PanelExporter',
    data: { panelCount: panels.length }
  })

  try {
    // Dynamischer Import von JSZip (nur wenn benötigt)
    const JSZip = (await import('jszip')).default

    const zip = new JSZip()

    // Alle Panels als PNG in ZIP hinzufügen
    for (let i = 0; i < panels.length; i++) {
      const panel = panels[i]
      const pngBlob = await exportPanelAsPNG(panel)
      const paddedNumber = String(i + 1).padStart(2, '0')
      zip.file(`panel-${paddedNumber}.png`, pngBlob)
    }

    // Metadaten-Datei hinzufügen
    const metadata = {
      exportedAt: new Date().toISOString(),
      panelCount: panels.length,
      panels: panels.map((p, i) => ({
        index: i + 1,
        filename: `panel-${String(i + 1).padStart(2, '0')}.png`,
        panelText: p.panelText,
        imagePrompt: p.imagePrompt,
        generatedAt: p.generatedAt
      }))
    }

    zip.file('metadata.json', JSON.stringify(metadata, null, 2))

    // ZIP generieren
    const zipBlob = await zip.generateAsync({ type: 'blob' })

    logger.info('ZIP erfolgreich erstellt', {
      component: 'PanelExporter',
      data: { panelCount: panels.length, zipSize: zipBlob.size }
    })

    return zipBlob
  } catch (error) {
    logger.error('Fehler beim Erstellen der ZIP-Datei', {
      component: 'PanelExporter',
      data: error
    })
    throw error
  }
}

/**
 * Lädt Base64-Bild als Blob herunter (für einzelne Avatars)
 */
export function downloadBase64AsImage(base64: string, filename: string): void {
  const link = document.createElement('a')
  link.href = base64
  link.download = filename
  link.click()
}
