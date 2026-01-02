# Avatar Panel Generator 🎨

Eine Web-App zum Erstellen von Instagram-Story-Karussells mit automatischer Avatar-Auswahl basierend auf Text-Emotionen.

![Avatar Panel Generator](https://img.shields.io/badge/React-19.2-blue) ![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue) ![Vite](https://img.shields.io/badge/Vite-7.2-purple)

---

## ✨ Features

### 🎭 Avatar-Verwaltung
- Nutzt hochgeladene Referenzbilder für maximale Konsistenz.
- Speicherung im Browser (LocalStorage/IndexedDB).
- Automatische Skalierung und Optimierung für Instagram (1080x1080px).

### 🤖 KI-gestützte Story-Erstellung
- **Interaktiver Chat**: Entwickle Ideen gemeinsam mit der KI.
- **Storyboard-Vorschau**: Die KI schlägt erst ein JSON-Storyboard (Text + Szenenbeschreibung) im Chat vor.
- **Review & Edit**: Überprüfe die Szenenbeschreibungen auf Englisch, bevor die Bilder generiert werden.
- **Sequentielle Generierung**: Panels werden nacheinander generiert, wobei jedes Panel als Referenz für das nächste dient (Recursive Referencing) für perfekte Konsistenz.
- **Integrierter Text**: Die KI (Imagen 4) zeichnet Sprechblasen und Texte direkt in das Bild.

### 🎨 Flexible Gestaltung
- **Feinblick Praxis Farben**: Warme, therapeutische Farbpalette.
- **Imagen 4 Power**: Hochwertige Comic-Illustrationen mit konsistentem Charakter-Look.
- **Comic-Logik**: Erkennt automatisch, ob Sprechblasen, Gedankenblasen oder Erzählerboxen am besten passen.

### 📥 Export
- Download der Story als ZIP-Archiv.
- Inklusive Metadaten (Prompts) für spätere Reproduzierbarkeit.

---

## 🚀 Setup

### Voraussetzungen
- Node.js 18+
- NPM oder Yarn

### 1. Dependencies installieren

```bash
npm install
```

### 2. API Keys einrichten

Die App nutzt **Google Gemini** und **KIE.AI (Imagen 4)**:

1. Kopiere `.env.example` zu `.env`
2. Füge deine Keys ein:
   - `VITE_GEMINI_API_KEY`: Von Google AI Studio
   - `VITE_KIE_AI_API_KEY`: Von KIE.AI
   - `VITE_IMGBB_API_KEY`: Von ImgBB (für Image Hosting)

### 3. App starten

```bash
npm run dev
```

Öffne **http://localhost:5173/** im Browser.

---

## 📖 Anleitung

### Schritt 1: Chatten & Planen
- Gehe zum Chat-Tab.
- Beschreibe dein Thema (z.B. "Hochsensibilität am Arbeitsplatz").
- Die KI stellt Fragen und hilft dir, die 5-10 Panels zu strukturieren.

### Schritt 2: Storyboard prüfen
- Klicke auf **"Storyboard vorschlagen"**.
- Ein JSON-Block erscheint im Chat mit `text` (Deutsch) und `scene` (Englisch).
- Wenn dir eine Szene nicht gefällt, sag es der KI und klicke erneut auf Vorschlagen.

### Schritt 3: Bilder generieren
- Klicke auf **"Storyboard bestätigen & Bilder generieren"**.
- Die App generiert nun ein Panel nach dem anderen.
- Jedes fertige Bild wird als Referenz für das nächste genutzt, um Kleidung und Gesicht konsistent zu halten.

---

## 🛠️ Technische Details

**Tech Stack:**
- React 19.2 + TypeScript 5.9
- Vite 7.2
- Tailwind CSS + shadcn/ui
- Google Gemini 2.5 Flash (Logik & Prompts)
- KIE.AI Nano Banana Pro / Imagen 4 (Bilder)
- Prompts sind modular in `/prompts/*.txt` ausgelagert.

---

## 🙏 Credits

Entwickelt mit ❤️ für **Praxis Feinblick**

- **UI-Framework**: [shadcn/ui](https://ui.shadcn.com)
- **Logik**: [Google Gemini](https://ai.google.dev)
- **Bilder**: [Imagen 4 via KIE.AI](https://kie.ai)

---

**Viel Spaß beim Erstellen deiner Story-Karussells! 🎨✨**