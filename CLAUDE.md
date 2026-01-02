# Avatar Panel Generator - Projektdokumentation

## Projektübersicht

Der **Avatar Panel Generator** ist eine React-Anwendung zur Erstellung von Instagram-Story-Panels mit AI-generierten Comic-Avataren. Die App kombiniert:
- **Gemini 2.5 Flash** für Konversation und Panel-Text-Generierung.
- **KIE.AI Nano Banana Pro** (Imagen 4) für character-konsistente Avatar-Generierung.
- **imgbb** für Image-Hosting (URLs für KIE.AI API).

### Hauptfunktionen
1. **Chat-basierte Story-Entwicklung:** Nutzer chattet mit AI, um Inhalte zu entwickeln.
2. **Storyboard-Review:** AI erstellt ein JSON-Storyboard (Text + Szenenbeschreibung) direkt im Chat zur Prüfung.
3. **Sequentielle Generierung:** Panels werden nacheinander generiert. Jedes Bild dient als zusätzliche Referenz für das nächste (Recursive Referencing).
4. **Integrierter Text:** Imagen 4 rendert Sprechblasen und Texte direkt ins Bild (kein Overlay nötig).
5. **Modulare Prompts:** Alle LLM-Prompts liegen als `.txt` Dateien im Ordner `/prompts`.

---

## Tech Stack

### Frontend
- **React 19.2** + **TypeScript**
- **Vite 7.2** (Build-Tool)
- **Tailwind CSS** (Styling)
- **Radix UI** (UI-Komponenten)
- **Lucide React** (Icons)

### AI & APIs
- **Google Gemini 2.5 Flash** (`@google/generative-ai`)
- **KIE.AI Nano Banana Pro** (Imagen 4)
- **imgbb API** (Hosting für Referenzbilder)

---

## Projektarchitektur

### Ordnerstruktur

```
avatar-panel-generator/
├── prompts/                        # LLM Prompt Templates (.txt)
│   ├── system-prompt.txt           # Chat-Persona
│   ├── panel-generation-prompt.txt # Storyboard Architect
│   └── image-generation-prompt.txt # Image Director
├── src/
│   ├── components/
│   │   ├── ChatInterface.tsx       # "Review & Confirm" Workflow
│   │   ├── MainApp.tsx             # View-Management
│   │   └── ...
│   ├── lib/
│   │   ├── chat-helper.ts          # Lädt Prompts via ?raw Import
│   │   ├── story-generator.ts      # Sequentielle Loop-Logik
│   │   ├── kie-ai-image.ts         # API & imgbb-Upload Handling
│   │   └── ...
```

---

## Wichtige Konzepte

### 1. Character Consistency
- **Referenzbilder:** Starten mit dem Profil-Set (7 Bilder).
- **Recursive Referencing:** Panel 1 wird generiert -> URL von Panel 1 wird Referenz für Panel 2 -> ...
- **No Physical Descriptions:** Prompts beschreiben Pose/Szene, überlassen das Aussehen den Bildern (ausgenommen im festen Stil-Anker).

### 2. Workflow: Propose -> Review -> Confirm
1. User klickt "Storyboard vorschlagen".
2. `generatePanelsFromChat` gibt JSON zurück.
3. JSON wird als Assistant-Nachricht in den Chat gepostet.
4. User prüft Text (DE) und Scene (EN).
5. User klickt "Storyboard bestätigen & Bilder generieren".

### 3. Image Prompting
- **Sprache:** Die Anweisungen an Gemini sind Deutsch/Englisch gemischt, der **Output** für den Bild-Generator ist **reines Englisch**.
- **Text-Integration:** Der Prompt weist Imagen 4 explizit an, Sprechblasen oder Narration Boxes für den Panel-Text zu nutzen.

---

## Environment Variables

```bash
VITE_GEMINI_API_KEY=...
VITE_KIE_AI_API_KEY=...
VITE_IMGBB_API_KEY=...
```

---

**Letzte Aktualisierung:** 2026-01-02
**Status:** Imagen 4 Upgrade & Sequentielle Generierung implementiert.