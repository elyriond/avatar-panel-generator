# Comic-Panel-Generator mit KI-Bildgenerierung - Projektplan (AKTUALISIERT)

**Datum:** 2026-01-02
**Projekt:** Avatar Panel Generator - Comic-Modus
**Status:** Phase 3 abgeschlossen (Imagen 4 Upgrade & Workflow Refinement)

---

## 🚀 Umsetzungs-Status

### ✅ Phase 1: Fundament (ERLEDIGT)
- [x] Gemini 2.5 Flash API Integration
- [x] KIE.AI (Imagen 4) Integration
- [x] Automatischer Referenzbild-Upload via imgbb
- [x] Basis Prompt-Generator

### ✅ Phase 2: Chat & Story (ERLEDIGT)
- [x] Chat-basierte Story-Entwicklung
- [x] JSON-basiertes Storyboard-System
- [x] Trennung von Panel-Text (DE) und Szenenbeschreibung (EN)
- [x] User-Review Schritt im Chat ("Propose -> Confirm")

### ✅ Phase 3: Bildgenerierung & Konsistenz (ERLEDIGT)
- [x] Sequentieller Generierungs-Workflow (Panel by Panel)
- [x] Recursive Referencing (Vorheriges Bild als Referenz für nächstes)
- [x] Text-in-Image Rendering (Sprechblasen via Imagen 4)
- [x] Modulare Prompts in `/prompts`

### ⏳ Phase 4: Review & Polish (IN ARBEIT)
- [ ] KI-Kritik/Analyse des fertigen Comics
- [ ] Manueller Edit einzelner Panels (Regenerate mit anderem Prompt)
- [ ] UI-Optimierung für Mobilgeräte

---

## 📋 Aktuelle Architektur

### Der "Director" Workflow:
1. **Konzeption**: Chat mit `system-prompt.txt`.
2. **Architektur**: `panel-generation-prompt.txt` erstellt JSON mit Text + Scene.
3. **Regie**: `image-generation-prompt.txt` erstellt den finalen Imagen 4 Prompt.
4. **Produktion**: Sequentielle KIE.AI Calls mit wachsender Referenz-Liste.

---

## 💡 Neue Erkenntnisse & Best Practices (2026)

1. **Sequential > Parallel**: Für Character Consistency ist die serielle Generierung (Panel n nutzt n-1 als Bild-Referenz) unschlagbar, auch wenn es länger dauert.
2. **Text-in-Image**: Imagen 4 rendert Text so gut, dass man auf Canvas-Overlays verzichten kann, was einen viel natürlicheren Comic-Look ergibt.
3. **Prompt Modularität**: Die Auslagerung der Prompts in `.txt` Dateien erlaubt schnelles Tuning ohne Code-Änderung.
4. **URL-Passing**: Die KIE.AI API ist stabiler, wenn man imgbb-URLs statt großer Base64-Blobs sendet.

---

## ✅ Nächste Schritte

1. **Panel Editor**: Erlaube dem Nutzer, den `scene` Text im JSON manuell zu überschreiben, bevor er auf "Bestätigen" klickt.
2. **History Management**: Verhindere, dass die Referenzliste für Panel 10 zu groß wird (derzeit Begrenzung auf 8 Bilder implementiert).
3. **Vorschau-Logik**: Eventuell kleine Previews der Szenen-Prompts (Text-only) anzeigen.

---
*Status Update: 2026-01-02*