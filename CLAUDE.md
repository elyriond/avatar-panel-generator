# Avatar Panel Generator - Projektdokumentation

## Projektübersicht

Der **Avatar Panel Generator** ist eine React-Anwendung zur Erstellung von Instagram-Story-Panels mit AI-generierten Comic-Avataren. Die App kombiniert:
- **Gemini 2.5 Flash** für Konversation und Panel-Text-Generierung
- **KIE.AI Nano Banana Pro** (Imagen 3) für character-konsistente Avatar-Generierung
- **imgbb** für Image-Hosting (URLs für KIE.AI API)

### Hauptfunktionen
1. **Chat-basierte Story-Entwicklung:** Nutzer chattet mit AI, um Inhalte zu entwickeln
2. **Automatische Panel-Text-Generierung:** AI erstellt 5-10 kurze Instagram-Texte
3. **Character-konsistente Avatare:** Referenzbilder werden automatisch geladen und für jedes Panel ein passender Avatar generiert
4. **Export:** Fertige Panels mit Text-Overlays als ZIP herunterladen

### Zielgruppe
Therapeutin (Gestalttherapie, Hochsensibilität) für professionelle Instagram-Inhalte

---

## Tech Stack

### Frontend
- **React 19.2** + **TypeScript**
- **Vite 7.2** (Build-Tool)
- **Tailwind CSS** (Styling)
- **Radix UI** (UI-Komponenten: Tabs)
- **Lucide React** (Icons)
- **Sonner** (Toast-Notifications)

### AI & APIs
- **Google Gemini 2.5 Flash Preview** (`@google/generative-ai`)
  - Chat-Konversation
  - Panel-Text-Generierung
  - Image-Prompt-Generierung
- **KIE.AI Nano Banana Pro** (Imagen 3)
  - Character-konsistente Avatar-Generierung
  - Task-basiertes Polling-System
- **imgbb API**
  - Image-Hosting für Referenzbilder
  - Bereitstellung von URLs für KIE.AI

### Utilities
- **JSZip** (Export als ZIP)
- **React Hook Form + Zod** (Formular-Validierung)
- **Canvas API** (Text-Overlays auf Bildern)

---

## Projektarchitektur

### Ordnerstruktur

```
avatar-panel-generator/
├── public/
│   └── reference-images/          # 7 fixe Referenzbilder (auto-loaded)
│       ├── ref-1.png               # mit schwarzen Sneakern
│       ├── ref-2.png               # mit coolen Schuhen aus Erfurt
│       ├── ref-3.jpg               # entschlossen - grenzsetzend
│       ├── ref-4.png               # Profil rechts
│       ├── ref-5.png               # Profil links
│       ├── ref-6.jpg               # selbstmitgefühl
│       └── ref-7.jpg               # empathisch - Verständnis zeigend
├── src/
│   ├── components/
│   │   ├── MainApp.tsx             # Hauptkomponente, View-Management
│   │   ├── ChatInterface.tsx       # Chat + Story-Generierung
│   │   ├── ChatSessionManager.tsx  # Session-Verwaltung
│   │   ├── CharacterProfileSetup.tsx  # (Wird übersprungen - auto-load)
│   │   ├── StoryPreview.tsx        # Vorschau generierter Panels
│   │   ├── PanelPreview.tsx        # Einzelnes Panel mit Text-Overlay
│   │   ├── OutputGallery.tsx       # Fertige Stories
│   │   └── ui/                     # Radix UI Komponenten
│   ├── lib/
│   │   ├── chat-helper.ts          # Gemini API Wrapper
│   │   ├── kie-ai-image.ts         # KIE.AI API Wrapper
│   │   ├── imgbb-uploader.ts       # imgbb Image-Hosting
│   │   ├── reference-loader.ts     # Auto-Load Referenzbilder
│   │   ├── character-profile.ts    # Character Profile Management
│   │   ├── story-persistence.ts    # LocalStorage für Stories
│   │   ├── chat-persistence.ts     # LocalStorage für Chat-Sessions
│   │   ├── panel-exporter.ts       # ZIP-Export mit Canvas
│   │   ├── logger.ts               # Strukturiertes Logging
│   │   └── utils.ts                # Tailwind merge
│   ├── types/
│   │   └── index.ts                # TypeScript Interfaces
│   ├── App.tsx
│   └── main.tsx
├── .env                            # API Keys (nicht im Git!)
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── tsconfig.json
```

---

## Wichtige Dateien & Funktionen

### 1. `/src/components/MainApp.tsx`
**Zweck:** Haupt-State-Management und View-Routing

**Wichtige Funktionen:**
- Auto-Erstellung des Character Profiles beim Start
- View-Management: `profile-setup` → `session-select` → `chat` → `story-preview` → `output-gallery`
- Überspringt Character-Setup (auto-load)

**Code-Highlight:**
```typescript
useEffect(() => {
  let profile = getCharacterProfile()

  if (!profile || !isProfileComplete(profile)) {
    profile = createAutoCharacterProfile()  // Auto-load!
    saveCharacterProfile(profile)
  }

  setCharacterProfile(profile)
  setCurrentView('session-select')  // Skip setup
}, [])
```

---

### 2. `/src/lib/reference-loader.ts`
**Zweck:** Automatisches Laden der 7 Referenzbilder

**Wichtige Funktionen:**
- `createAutoCharacterProfile()`: Erstellt Profile mit Referenz-Pfaden (NICHT Base64!)
- Speichert nur Dateinamen in LocalStorage (vermeidet Quota-Fehler)

**Code-Highlight:**
```typescript
const REFERENCE_IMAGE_FILES = [
  'ref-1.png', 'ref-2.png', 'ref-3.jpg',
  'ref-4.png', 'ref-5.png', 'ref-6.jpg', 'ref-7.jpg'
]

export function createAutoCharacterProfile() {
  return {
    id: 'auto-profile',
    name: 'Theresa',
    referenceImagePaths: REFERENCE_IMAGE_FILES,  // Nur Pfade!
    // ...
  }
}
```

---

### 3. `/src/lib/chat-helper.ts`
**Zweck:** Gemini 2.5 Flash API Wrapper

**Wichtige Funktionen:**

#### `startChatSession()`
Startet Chat mit warmem, therapeutischem Ton

#### `sendChatMessage(history, userMessage)`
Chat-Konversation mit Historie

#### `generatePanelsFromChat(history, numPanels)`
Generiert 5-10 kurze Panel-Texte (150-250 Zeichen)

#### `generateImagePrompt(panelText, chatHistory, characterName, visualStyle, atmosphere)`
Generiert detaillierte Image-Prompts für KIE.AI

**WICHTIG - Character Consistency:**
- Beschreibt **KEINE** physischen Merkmale (Alter, Geschlecht, Haare, Kleidung)
- Fokussiert auf: Pose, Emotion, Kamerawinkel, Hintergrund
- Überlässt das Aussehen den Referenzbildern

**Verboten:**
- ❌ "woman", "man", Character-Namen
- ❌ Alter, Haare, Kleidung, Hautfarbe

**Erlaubt:**
- ✅ Pose (sitzt, steht, Arme verschränkt)
- ✅ Emotion (nachdenklich, entspannt)
- ✅ Kamerawinkel (medium shot, close-up)
- ✅ Hintergrund (minimalistisch, warme Farben)

---

### 4. `/src/lib/kie-ai-image.ts`
**Zweck:** KIE.AI Nano Banana Pro API Wrapper

**API-Endpoints:**
- `POST /api/v1/jobs/createTask` - Task erstellen
- `GET /api/v1/jobs/recordInfo?taskId=...` - Task-Status abrufen (Query-Parameter!)

**Wichtige Funktionen:**

#### `extractReferenceImagesFromProfile(profile)`
1. Lädt Bilder aus `/public/reference-images/`
2. Konvertiert zu Base64
3. **Uploaded zu imgbb** (parallel)
4. Gibt URLs zurück (nicht Base64!)

**Warum imgbb?**
- KIE.AI API akzeptiert URLs besser als Base64
- Vermeidet Request-Size-Probleme

#### `generateComicAvatar(options)`
Generiert ein Avatar-Bild mit Character Consistency

**Request-Format:**
```json
{
  "model": "nano-banana-pro",
  "task_type": "image_generation",
  "input": {
    "prompt": "Comic-style illustration. Medium shot, person sitting...",
    "image_input": [
      "https://i.ibb.co/xxx/reference-1.jpg",
      "https://i.ibb.co/yyy/reference-2.jpg",
      // ... bis zu 7 URLs
    ],
    "aspect_ratio": "1:1",
    "resolution": "1K",
    "output_format": "jpg",
    "quality": 80,
    "negative_prompt": "realistic photo, photograph, 3d render..."
  }
}
```

**Response-Format (createTask):**
```json
{
  "code": 200,
  "msg": "success",
  "data": {
    "taskId": "abc123...",
    "recordId": "abc123..."
  }
}
```

#### `getTaskStatus(taskId)`
Polling-basiertes Abrufen des Task-Status

**Response-Format (recordInfo):**
```json
{
  "code": 200,
  "msg": "success",
  "data": {
    "taskId": "abc123...",
    "model": "nano-banana-pro",
    "state": "waiting" | "queuing" | "generating" | "success" | "failed",
    "resultJson": "{\"resultUrls\":[\"https://...\"]}",
    "failCode": null,
    "failMsg": null,
    "completeTime": 1234567890
  }
}
```

**State-Mapping:**
- `waiting` / `queuing` → `pending`
- `generating` → `processing`
- `success` → `completed`
- `failed` → `failed`

#### `pollTaskUntilComplete(taskId, maxWaitTime)`
Pollt alle 2 Sekunden bis Task fertig (max 2 Minuten)

---

### 5. `/src/lib/imgbb-uploader.ts`
**Zweck:** Image-Hosting via imgbb API

**Wichtige Funktionen:**

#### `uploadImageToImgbb(base64Image, name)`
Uploaded ein einzelnes Bild zu imgbb

**Request-Format:**
```typescript
const formData = new FormData()
formData.append('key', IMGBB_API_KEY)
formData.append('image', base64Data)  // Ohne Data URI Prefix!
formData.append('name', name)
```

**Response:**
```json
{
  "success": true,
  "data": {
    "url": "https://i.ibb.co/xxx/image.jpg"
  }
}
```

#### `uploadImagesToImgbb(base64Images)`
Parallel-Upload mehrerer Bilder via `Promise.all()`

---

### 6. `/src/lib/story-persistence.ts`
**Zweck:** LocalStorage für generierte Stories

**Datenstruktur:**
```typescript
interface StoryPanel {
  id: string
  panelText: string
  imageUrl: string       // KIE.AI generiertes Avatar
  imagePrompt: string
  timestamp: Date
}

interface Story {
  id: string
  sessionId: string
  panels: StoryPanel[]
  createdAt: Date
  title?: string
}
```

---

### 7. `/src/components/ChatInterface.tsx`
**Zweck:** Chat-UI + Story-Generierung

**Story-Generierungs-Workflow:**
1. User klickt "Story generieren"
2. `generatePanelsFromChat()` → 5 Panel-Texte
3. `generateImagePrompt()` → 5 Image-Prompts (parallel)
4. `generateComicAvatar()` → 5 Avatare (parallel)
5. Navigation zu `story-preview`

**Progress-Tracking:**
```typescript
interface StoryProgress {
  currentPanel: number
  totalPanels: number
  status: 'generating_prompts' | 'generating_avatars' | 'completed' | 'failed'
  message: string
  generatedPanels: number
}
```

---

### 8. `/src/components/PanelPreview.tsx`
**Zweck:** Vorschau einzelner Panels mit Text-Overlay

**Features:**
- Canvas-basierte Text-Rendering
- Anpassbare Schriftgröße, Farbe, Position
- Live-Vorschau
- Export als Base64 oder Download

**Text-Overlay-Logik:**
```typescript
const drawTextOnCanvas = (canvas, imageUrl, text, fontSize, color, position) => {
  const ctx = canvas.getContext('2d')
  const img = new Image()
  img.src = imageUrl

  img.onload = () => {
    canvas.width = img.width
    canvas.height = img.height
    ctx.drawImage(img, 0, 0)

    // Text mit Outline für bessere Lesbarkeit
    ctx.font = `bold ${fontSize}px Arial`
    ctx.textAlign = 'center'
    ctx.strokeStyle = 'black'
    ctx.lineWidth = 3
    ctx.strokeText(text, x, y)
    ctx.fillStyle = color
    ctx.fillText(text, x, y)
  }
}
```

---

### 9. `/src/lib/panel-exporter.ts`
**Zweck:** Export als ZIP-Datei

**Workflow:**
1. Erstelle Canvas für jedes Panel
2. Rendere Bild + Text-Overlay
3. Konvertiere zu Blob (`canvas.toBlob()`)
4. Sammle in JSZip
5. Download als `story-panels.zip`

---

## API-Integrationen

### Gemini 2.5 Flash Preview (09-2025)

**Model:** `gemini-2.5-flash-preview-09-2025`

**Verwendung:**
- Chat-Konversation
- Panel-Text-Generierung (strukturierte Ausgabe)
- Image-Prompt-Generierung (character-agnostisch!)

**Kosten:** ~$0.075 per 1M input tokens, $0.30 per 1M output tokens

---

### KIE.AI Nano Banana Pro (Imagen 3)

**Model:** `nano-banana-pro`

**API Base URL:** `https://api.kie.ai/api/v1/jobs`

**Endpoints:**
- `POST /createTask` - Task erstellen
- `GET /recordInfo?taskId=...` - Task-Status (Query-Parameter!)

**Features:**
- Character Consistency mit bis zu 8 Referenzbildern
- 1K, 2K, 4K Auflösung
- Aspect Ratios: 1:1, 16:9, 9:16, etc.

**Kosten:**
- 1K/2K: $0.09 per Bild
- 4K: $0.12 per Bild

**Wichtig:**
- Akzeptiert URLs (von imgbb) als `image_input`
- Response-Format: `{ code, msg, data: { taskId, state, resultJson } }`
- `state`: waiting → queuing → generating → success/failed

---

### imgbb API

**API Base URL:** `https://api.imgbb.com/1/upload`

**Verwendung:**
- Upload von Referenzbildern
- Bereitstellung von URLs für KIE.AI

**Request:**
- Method: POST (FormData)
- `key`: API Key
- `image`: Base64 (ohne Data URI Prefix!)
- `name`: Dateiname

**Response:**
```json
{
  "success": true,
  "data": {
    "url": "https://i.ibb.co/xxx/image.jpg",
    "display_url": "...",
    "delete_url": "..."
  }
}
```

---

## Environment Variables

**`.env` (nicht im Git!):**

```bash
# Gemini API Key
VITE_GEMINI_API_KEY=your_gemini_key_here

# KIE.AI API Key
VITE_KIE_AI_API_KEY=your_kie_ai_key_here

# imgbb API Key (für Image-Hosting)
VITE_IMGBB_API_KEY=your_imgbb_key_here
```

**Wo bekommt man die Keys?**
- Gemini: https://aistudio.google.com/apikey
- KIE.AI: https://kie.ai/
- imgbb: https://api.imgbb.com/

---

## Workflow: Story-Generierung

### 1. App-Start
```
MainApp → Auto-load Character Profile
       → Referenzbilder-Pfade gespeichert
       → Navigation zu session-select
```

### 2. Chat-Session
```
ChatInterface → User chattet mit Gemini
            → Entwickelt Ideen für Story
            → Klickt "Story generieren" (5 Panels)
```

### 3. Panel-Text-Generierung
```
generatePanelsFromChat(history, 5)
  → Gemini 2.5 Flash
  → 5 kurze Texte (150-250 Zeichen)
  → Format: "1. Text...\n2. Text...\n..."
```

### 4. Image-Prompt-Generierung (Parallel)
```
Promise.all([
  generateImagePrompt(text1, history, ...),
  generateImagePrompt(text2, history, ...),
  ...
])
  → Gemini 2.5 Flash
  → 5 detaillierte Bild-Prompts
  → WICHTIG: Keine Character-Beschreibungen!
  → Nur: Pose, Emotion, Kamerawinkel, Hintergrund
```

### 5. Referenzbilder-Upload (einmalig)
```
extractReferenceImagesFromProfile(profile)
  → Lädt 7 Bilder aus /public/reference-images/
  → Base64-Konvertierung
  → Upload zu imgbb (parallel)
  → 7 URLs zurück
```

### 6. Avatar-Generierung (Parallel)
```
Promise.all([
  generateComicAvatar({ prompt: prompt1, referenceImages: urls }),
  generateComicAvatar({ prompt: prompt2, referenceImages: urls }),
  ...
])
  → KIE.AI createTask (5x)
  → Polling (alle 2 Sek)
  → 5 Avatar-URLs zurück
```

### 7. Story-Vorschau
```
StoryPreview → Zeigt 5 Panels
           → Avatar + Text-Overlay
           → Anpassbare Text-Position/Farbe
           → Export als ZIP
```

---

## Known Issues & Solutions

### 1. LocalStorage Quota Exceeded
**Problem:** Base64-Bilder (~5MB) überschreiten LocalStorage-Limit

**Lösung:** ✅ Nur Pfade speichern, lazy-loading

---

### 2. KIE.AI API "image_input file type not supported"
**Problem:** Base64 Data URIs wurden abgelehnt

**Lösung:** ✅ imgbb-Upload, URLs verwenden

---

### 3. KIE.AI API 404 bei getTask
**Problem:** Falscher Endpoint `/getTask/{taskId}` (Path-Parameter)

**Lösung:** ✅ Korrekter Endpoint `/recordInfo?taskId=...` (Query-Parameter)

---

### 4. Task-Status "waiting" als "failed" behandelt
**Problem:** Unbekannte States wurden als "failed" gemappt

**Lösung:** ✅ State-Mapping: `waiting` → `pending`

---

### 5. Avatare sehen nicht wie Reference-Character aus
**Problem:** Image-Prompts beschrieben Character ("woman in 30s, short hair")

**Lösung:** ✅ Prompt-Änderung: KEINE physischen Merkmale, nur Pose/Emotion/Szene

---

## Development

### Setup
```bash
cd /Users/theresagorzalka/avatar-panel-generator
npm install
```

### Environment
```bash
# .env erstellen
cp .env.example .env

# API Keys eintragen
nano .env
```

### Dev Server
```bash
npm run dev
# → http://localhost:5173
```

### Build
```bash
npm run build
# → dist/
```

### Logging
Alle Logs in Browser Console (strukturiert):
- `[DEBUG]` - Detaillierte Informationen
- `[INFO]` - Wichtige Events
- `[ERROR]` - Fehler mit Stack Traces

**Komponenten-Tags:** `[ChatHelper]`, `[KieAiImage]`, `[MainApp]`, etc.

---

## Nächste Schritte / TODOs

### Optimierungen
- [ ] Callback-URL für KIE.AI (statt Polling)
- [ ] Caching von imgbb-URLs (vermeidet Re-Upload)
- [ ] Batch-Upload zu imgbb (derzeit 7x einzeln)

### Features
- [ ] Mehr Shot-Typen (full body, close-up variations)
- [ ] Mehrere Character Profiles
- [ ] Custom Hintergründe/Farben
- [ ] Text-Templates für häufige Themen

### UI/UX
- [ ] Progress-Bar für Avatar-Generierung
- [ ] Retry-Button bei fehlgeschlagenen Tasks
- [ ] Vorschau der Referenzbilder

---

## Kontakt & Dokumentation

**Projekt-Owner:** Theresa Gorzalka (Gestalttherapeutin)

**Für AI Agents:**
- Diese Datei (`CLAUDE.md`) beschreibt den aktuellen Stand
- Alle wichtigen Architektur-Entscheidungen sind dokumentiert
- Bei Änderungen bitte diese Datei aktualisieren!

**Wichtige Erkenntnisse:**
1. Character Consistency funktioniert nur, wenn Image-Prompts KEINE physischen Merkmale beschreiben
2. KIE.AI API bevorzugt URLs über Base64
3. imgbb ist stabil und kostenlos für Image-Hosting
4. Polling ist ineffizient, aber funktional (Callback-URL wäre besser)

---

**Letzte Aktualisierung:** 2025-12-30
**Version:** v0.1.0-alpha
