# Avatar Panel Generator 🎨

Eine Web-App zum Erstellen von Instagram-Story-Karussells mit automatischer Avatar-Auswahl basierend auf Text-Emotionen.

![Avatar Panel Generator](https://img.shields.io/badge/React-18.3-blue) ![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue) ![Vite](https://img.shields.io/badge/Vite-5.4-purple)

---

## ✨ Features

### 🎭 Avatar-Verwaltung
- Lade verschiedene Avatar-Varianten hoch (Posen & Emotionen)
- Speicherung im Browser (LocalStorage)
- Drag & Drop Upload
- Unterstützte Formate: PNG, JPG, WEBP, GIF (max. 5MB)

### 🤖 KI-gestützte Story-Erstellung
- **Automatischer Modus**: Lange Geschichte → KI teilt auf 1-10 Panels auf
- **Manueller Modus**: Panels einzeln eingeben
- KI wählt automatisch passenden Avatar basierend auf Text-Emotion
- **Ohne Avatar**: Option für reine Text-Panels

### 🎨 Flexible Gestaltung
- **Feinblick Praxis Farben**: Warme, therapeutische Farbpalette
- 8 Voreinstellungen + Custom Color Picker
- 4 Avatar-Positionen (unten zentriert, unten rechts, links, rechts)
- Instagram-optimiertes Format (1080x1080px)
- 1-10 Panels pro Story

### 📥 Export
- Download einzelner Panels als PNG
- Bereit für Instagram-Upload
- Automatische Dateinamen mit Datum

---

## 🚀 Setup

### Voraussetzungen
- Node.js 18+
- NPM oder Yarn

### 1. Dependencies installieren

```bash
npm install
```

### 2. API Key einrichten

Die App nutzt **Claude (Anthropic API)** für KI-Funktionen:

1. Gehe zu: **https://console.anthropic.com/**
2. Erstelle einen Account (kostenlose Credits verfügbar)
3. Generiere einen API Key

Öffne die Datei `.env` und füge deinen Key ein:

```env
VITE_ANTHROPIC_API_KEY=dein-api-key-hier
```

### 3. App starten

```bash
npm run dev
```

Öffne **http://localhost:5173/** im Browser.

---

## 📖 Anleitung

### Schritt 1: Avatare hochladen

1. **Erstelle Avatar-Varianten** mit Gemini (oder einem anderen Tool):
   - Verschiedene **Emotionen**: fröhlich, nachdenklich, neutral, überrascht, etc.
   - Verschiedene **Posen**: stehend, sitzend, gehend, springend, etc.

2. Speichere sie als PNG/JPG

3. In der App:
   - Gehe zu **"1. Avatare verwalten"**
   - Gib für jeden Avatar eine **Emotion/Pose** ein (z.B. "fröhlich", "sitzend")
   - Lade das Bild hoch (Drag & Drop oder Button)

**💡 Tipp:** Je mehr Varianten, desto besser kann die KI den passenden Avatar auswählen!

---

### Schritt 2: Story erstellen

1. Gehe zu **"2. Story erstellen"**

2. **Einstellungen**:
   - **Anzahl Panels**: Wähle 1-10 Panels (Slider)
   - **Hintergrundfarbe**: Wähle aus Feinblick-Farbpalette oder Custom
   - **Avatar verwenden**: Checkbox aktivieren/deaktivieren
   - **Avatar-Position** (falls aktiviert): Unten zentriert, unten rechts, links oder rechts

3. **Modus wählen**:

   **Option A: Automatisch aufteilen**
   - Schreibe deine gesamte Geschichte
   - KI teilt sie automatisch in gewählte Anzahl Panels auf
   - KI wählt automatisch passende Avatare

   **Option B: Manuell eingeben**
   - Gib für jeden Panel einzeln Text ein
   - Du musst nicht alle Felder ausfüllen
   - KI analysiert jeden Text und wählt passenden Avatar

4. Klicke auf **"Story in Panels aufteilen"** oder **"Panels generieren"**

5. **Download**: Jedes Panel einzeln als PNG herunterladen

---

### Schritt 3: Auf Instagram hochladen

1. Öffne Instagram App
2. Erstelle einen neuen Post
3. Wähle **"Mehrere Bilder"** (Karussell-Icon)
4. Lade deine Panels in der richtigen Reihenfolge hoch
5. Fertig! 🎉

---

## 🎨 Feinblick Farbpalette

Die App nutzt die warmen, therapeutischen Farben der Praxis Feinblick:

| Farbe | Hex | Beschreibung |
|-------|-----|--------------|
| Warm White | `#F0EBE3` | Sanftes Weiß |
| Warmer Sand | `#D9CDB8` | Beruhigendes Beige |
| Light Blush | `#EDD7CE` | Zartes Rosa |
| Soft Terracotta | `#C8947C` | Warmes Terrakotta |
| Soft Coral | `#C18674` | Weiches Koralle |
| Blush | `#EAD9D1` | Hauchzartes Rosa |
| Sage Green | `#B5BFA4` | Sanftes Grün |
| Pure White | `#FFFFFF` | Reines Weiß |

---

## 🛠️ Technische Details

**Tech Stack:**
- React 18.3 + TypeScript 5.6
- Vite 5.4 (Build Tool)
- Tailwind CSS + shadcn/ui
- Canvas API (Panel-Generierung)
- Anthropic SDK (KI)
- LocalStorage (Avatar-Speicherung)

**Browser-Kompatibilität:**
- Chrome/Edge (empfohlen)
- Firefox
- Safari (ab Version 15+)

---

## 💡 Tipps für beste Ergebnisse

1. **Avatar-Qualität**: Nutze hochauflösende Bilder (min. 500x500px)
2. **Konsistente Labels**: Verwende klare, eindeutige Emotionen/Posen-Namen
   - ✅ Gut: "fröhlich", "sitzend", "nachdenklich"
   - ❌ Schlecht: "gut drauf", "am chillen"
3. **Text-Länge**: Ca. 15-30 Wörter pro Panel sind ideal für Lesbarkeit
4. **Avatar-Position**:
   - "Unten zentriert" → für stehende/sitzende Posen
   - "Links/Rechts" → für größere Avatare mit mehr Präsenz
5. **Panel-Anzahl**:
   - 1 Panel → Einzelne Aussage oder Zitat
   - 3-5 Panels → Kurze Geschichte oder Tipps
   - 8-10 Panels → Längere Story oder Anleitung

---

## 🐛 Fehlerbehebung

### "Fehler beim Generieren der Panels"
→ Stelle sicher, dass du einen gültigen API Key in der `.env` Datei hast

### "Keine Avatare verfügbar"
→ Lade mindestens einen Avatar hoch, bevor du Panels mit Avatar erstellst
→ Oder deaktiviere die "Avatar verwenden" Checkbox für reine Text-Panels

### Text zu lang / überläuft
→ Halte Panel-Texte bei ca. 15-30 Wörtern für beste Lesbarkeit
→ Bei automatischer Aufteilung: KI passt Text-Länge an

### Avatar wird nicht angezeigt
→ Prüfe, ob das Bild-Format unterstützt wird (PNG, JPG, WEBP, GIF)
→ Prüfe, ob die Datei < 5MB ist
→ Stelle sicher, dass "Avatar verwenden" aktiviert ist

### Panels sehen auf Instagram anders aus
→ Instagram komprimiert Bilder leicht
→ Verwende helle Hintergrundfarben für bessere Lesbarkeit
→ Teste verschiedene Avatar-Positionen

---

## 🚧 Entwicklung

```bash
# Dev-Server starten
npm run dev

# Production Build
npm run build

# Build Preview
npm run preview

# Lint
npm run lint
```

**Projekt-Struktur:**
```
avatar-panel-generator/
├── src/
│   ├── components/       # React Components
│   │   ├── ui/          # shadcn/ui Basis-Komponenten
│   │   ├── AvatarManager.tsx
│   │   ├── StoryCreator.tsx
│   │   ├── PanelPreview.tsx
│   │   └── ColorPicker.tsx
│   ├── lib/             # Utilities & Core Logic
│   │   ├── avatar-storage.ts
│   │   ├── panel-generator.ts
│   │   ├── emotion-detector.ts
│   │   └── utils.ts
│   ├── types/           # TypeScript Definitions
│   ├── App.tsx          # Main App
│   └── main.tsx         # Entry Point
├── .env                 # API Keys (nicht committen!)
└── README.md           # Diese Datei
```

---

## 📝 Lizenz

Dieses Projekt ist für persönlichen Gebrauch erstellt.

---

## 🙏 Credits

Entwickelt mit ❤️ für **Praxis Feinblick**

- **UI-Framework**: [shadcn/ui](https://ui.shadcn.com)
- **Icons**: [Lucide React](https://lucide.dev)
- **KI**: [Claude (Anthropic)](https://anthropic.com)

---

**Viel Spaß beim Erstellen deiner Story-Karussells! 🎨✨**
