export type AvatarPosition = 'bottom-center' | 'bottom-right' | 'left' | 'right'

export interface PanelOptions {
  text: string
  backgroundColor: string
  avatarImage: HTMLImageElement | null
  canvas: HTMLCanvasElement
  avatarPosition?: AvatarPosition
  panelNumber?: number
  removeBackground?: boolean
  customFontSize?: number // Optional: Überschreibt Auto-Größe
}

const CANVAS_SIZE = 1080 // Instagram Post size
const PADDING = 60 // Ausgewogenes Padding
const AVATAR_SIZE_BOTTOM = 620 // Avatar-Größe für bottom-Positionen (57% der Canvas-Höhe)
const AVATAR_SIZE_SIDE = 750 // Avatar-Größe für left/right Positionen (69% der Canvas-Höhe)
const BASE_FONT_SIZE = 48 // Basis-Schriftgröße (wird auto-angepasst)
const MIN_FONT_SIZE = 28 // Minimale Schriftgröße (flexibler für lange Texte)
const LINE_HEIGHT_RATIO = 1.5 // Verhältnis Font-Size zu Line-Height

export function generatePanel(options: PanelOptions): void {
  const { text, backgroundColor, avatarImage, canvas, avatarPosition = 'bottom-center', panelNumber = 1, removeBackground = false, customFontSize } = options

  // Canvas-Größe setzen
  canvas.width = CANVAS_SIZE
  canvas.height = CANVAS_SIZE

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Canvas context not available')
  }

  // Hintergrund zeichnen
  ctx.fillStyle = backgroundColor
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)

  // Avatar und Text-Bereich basierend auf Position berechnen
  const layout = calculateLayout(avatarPosition, !!avatarImage)

  // Text rendern (mit optionaler custom Font-Größe)
  drawText(ctx, text, layout.textArea, customFontSize)

  // Avatar zeichnen
  if (avatarImage) {
    drawAvatar(ctx, avatarImage, layout.avatarArea, avatarPosition, removeBackground)
  }
}

interface LayoutArea {
  x: number
  y: number
  width: number
  height: number
}

interface Layout {
  textArea: LayoutArea
  avatarArea: LayoutArea
}

function calculateLayout(position: AvatarPosition, hasAvatar: boolean): Layout {
  if (!hasAvatar) {
    // Kein Avatar: gesamter Canvas für Text
    return {
      textArea: {
        x: PADDING,
        y: PADDING,
        width: CANVAS_SIZE - PADDING * 2,
        height: CANVAS_SIZE - PADDING * 2
      },
      avatarArea: { x: 0, y: 0, width: 0, height: 0 }
    }
  }

  switch (position) {
    case 'bottom-center':
      return {
        textArea: {
          x: PADDING,
          y: PADDING,
          width: CANVAS_SIZE - PADDING * 2,
          height: CANVAS_SIZE - AVATAR_SIZE_BOTTOM - PADDING * 3
        },
        avatarArea: {
          x: (CANVAS_SIZE - AVATAR_SIZE_BOTTOM) / 2,
          y: CANVAS_SIZE - AVATAR_SIZE_BOTTOM - PADDING,
          width: AVATAR_SIZE_BOTTOM,
          height: AVATAR_SIZE_BOTTOM
        }
      }

    case 'bottom-right':
      return {
        textArea: {
          x: PADDING,
          y: PADDING,
          width: CANVAS_SIZE - PADDING * 2,
          height: CANVAS_SIZE - AVATAR_SIZE_BOTTOM - PADDING * 3
        },
        avatarArea: {
          x: CANVAS_SIZE - AVATAR_SIZE_BOTTOM - PADDING,
          y: CANVAS_SIZE - AVATAR_SIZE_BOTTOM - PADDING,
          width: AVATAR_SIZE_BOTTOM,
          height: AVATAR_SIZE_BOTTOM
        }
      }

    case 'left':
      return {
        textArea: {
          x: AVATAR_SIZE_SIDE + PADDING * 2,
          y: PADDING,
          width: CANVAS_SIZE - AVATAR_SIZE_SIDE - PADDING * 3,
          height: CANVAS_SIZE - PADDING * 2
        },
        avatarArea: {
          x: PADDING,
          y: (CANVAS_SIZE - AVATAR_SIZE_SIDE) / 2,
          width: AVATAR_SIZE_SIDE,
          height: AVATAR_SIZE_SIDE
        }
      }

    case 'right':
      return {
        textArea: {
          x: PADDING,
          y: PADDING,
          width: CANVAS_SIZE - AVATAR_SIZE_SIDE - PADDING * 3,
          height: CANVAS_SIZE - PADDING * 2
        },
        avatarArea: {
          x: CANVAS_SIZE - AVATAR_SIZE_SIDE - PADDING,
          y: (CANVAS_SIZE - AVATAR_SIZE_SIDE) / 2,
          width: AVATAR_SIZE_SIDE,
          height: AVATAR_SIZE_SIDE
        }
      }
  }
}

function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  area: LayoutArea,
  customFontSize?: number
): void {
  // Warmes Grau wie bei Feinblick (hsl(25 8% 32%) → ca. #4d4540)
  ctx.fillStyle = '#4d4540'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.letterSpacing = '0.3px'

  // AUTO-ANPASSUNG: Finde passende Schriftgröße (oder nutze custom)
  let fontSize = customFontSize || BASE_FONT_SIZE
  let lineHeight = fontSize * LINE_HEIGHT_RATIO
  let lines: string[] = []
  let fits = false

  // Versuche Schriftgrößen, bis Text passt (skip wenn custom)
  while (fontSize >= MIN_FONT_SIZE && !fits && !customFontSize) {
    lineHeight = fontSize * LINE_HEIGHT_RATIO
    // Lato-ähnliche Schrift (mit System-Fallbacks)
    ctx.font = `500 ${fontSize}px "Lato", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`

    // Wortumbruch berechnen
    const words = text.split(' ')
    lines = []
    let currentLine = ''

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word
      const metrics = ctx.measureText(testLine)

      if (metrics.width > area.width - 60 && currentLine) { // 60px Sicherheitsabstand (mehr Platz)
        lines.push(currentLine)
        currentLine = word
      } else {
        currentLine = testLine
      }
    }

    if (currentLine) {
      lines.push(currentLine)
    }

    // Prüfe ob alles passt
    const totalTextHeight = lines.length * lineHeight
    fits = totalTextHeight <= area.height - 60 // 60px Sicherheitsabstand (mehr Platz)

    if (!fits) {
      fontSize -= 2 // Schrift verkleinern
    }
  }

  // Text zentriert vertikal im verfügbaren Bereich
  const totalTextHeight = lines.length * lineHeight
  const startY = area.y + (area.height - totalTextHeight) / 2

  // Zeilen zeichnen
  lines.forEach((line, index) => {
    const lineY = startY + index * lineHeight
    ctx.fillText(line, area.x + area.width / 2, lineY, area.width - 60)
  })
}

/**
 * Entfernt weiße/helle Hintergründe aus einem Bild und macht sie transparent
 */
function removeWhiteBackground(image: HTMLImageElement): HTMLCanvasElement {
  // Temporäres Canvas für Bildverarbeitung
  const tempCanvas = document.createElement('canvas')
  tempCanvas.width = image.width
  tempCanvas.height = image.height

  const tempCtx = tempCanvas.getContext('2d')
  if (!tempCtx) {
    throw new Error('Cannot create temporary canvas context')
  }

  // Originalbild zeichnen
  tempCtx.drawImage(image, 0, 0)

  // Pixel-Daten holen
  const imageData = tempCtx.getImageData(0, 0, image.width, image.height)
  const data = imageData.data

  // Schwellenwert für "weiß" (je höher, desto mehr wird entfernt)
  // 220 bedeutet: RGB-Werte über 220 werden als "weiß" erkannt
  // Niedriger = mehr wird entfernt (aggressiver)
  const whiteThreshold = 220

  // Durch alle Pixel gehen (4 Werte pro Pixel: R, G, B, A)
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]     // Rot
    const g = data[i + 1] // Grün
    const b = data[i + 2] // Blau
    const a = data[i + 3] // Alpha (Transparenz)

    // Wenn alle RGB-Werte über dem Schwellenwert liegen → weiß
    if (r > whiteThreshold && g > whiteThreshold && b > whiteThreshold) {
      data[i + 3] = 0 // Alpha auf 0 setzen (komplett transparent)
    }
  }

  // Verarbeitete Pixel zurück ins Canvas schreiben
  tempCtx.putImageData(imageData, 0, 0)

  return tempCanvas
}

function drawAvatar(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  area: LayoutArea,
  position: AvatarPosition,
  removeBackground: boolean = false
): void {
  ctx.save()

  // Hintergrund entfernen, wenn gewünscht
  let processedImage: HTMLImageElement | HTMLCanvasElement = image

  if (removeBackground) {
    processedImage = removeWhiteBackground(image)
  }

  // NEUE SKALIERUNG: Alle Avatare auf gleiche Höhe skalieren
  // So sind alle Avatare gleich groß, unabhängig vom Original-Seitenverhältnis
  const scale = area.height / processedImage.height
  const scaledWidth = processedImage.width * scale
  const scaledHeight = processedImage.height * scale

  // Horizontal zentrieren (Breite kann variieren)
  let offsetX = (area.width - scaledWidth) / 2
  let offsetY = 0

  // Für bottom-Positionen: Avatar am Boden ausrichten
  // Für side-Positionen: Vertikal zentrieren
  if (position === 'bottom-center' || position === 'bottom-right') {
    // Avatar am unteren Rand (alle gleich groß, Füße am Boden)
    offsetY = area.height - scaledHeight
  } else {
    // Für left/right: vertikal zentrieren
    offsetY = (area.height - scaledHeight) / 2
  }

  ctx.drawImage(processedImage, area.x + offsetX, area.y + offsetY, scaledWidth, scaledHeight)

  ctx.restore()
}

export function downloadPanel(
  canvas: HTMLCanvasElement,
  filename: string = 'panel.png'
): void {
  canvas.toBlob(
    (blob) => {
      if (!blob) {
        console.error('Could not create blob')
        return
      }

      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      link.click()

      // Cleanup
      URL.revokeObjectURL(url)
    },
    'image/png'
  )
}
