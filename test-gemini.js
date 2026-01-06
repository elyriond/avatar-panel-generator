// Einfacher Test für Gemini API Key
// Führe aus mit: node test-gemini.js

import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';

// Lade .env Datei mit Override
dotenv.config({ override: true });

async function testGeminiAPI() {
  console.log('🔍 Teste Gemini API Key...\n');

  // 1. Prüfe ob API Key vorhanden ist
  const apiKey = process.env.VITE_GEMINI_API_KEY;

  if (!apiKey) {
    console.error('❌ FEHLER: Kein API Key gefunden!');
    console.error('   Stelle sicher, dass VITE_GEMINI_API_KEY in der .env Datei gesetzt ist.');
    process.exit(1);
  }

  console.log('✅ API Key gefunden:', apiKey.substring(0, 10) + '...');
  console.log('   (Länge:', apiKey.length, 'Zeichen)\n');

  // 2. Versuche eine einfache Anfrage
  try {
    console.log('📡 Sende Test-Anfrage an Gemini API...');

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-preview-09-2025' });

    const prompt = 'Antworte nur mit dem Wort "funktioniert"';
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    console.log('✅ API Anfrage erfolgreich!');
    console.log('   Antwort von Gemini:', text.trim());
    console.log('\n🎉 Der API Key funktioniert perfekt!\n');

  } catch (error) {
    console.error('\n❌ API Anfrage fehlgeschlagen!');
    console.error('   Fehlertyp:', error.constructor.name);
    console.error('   Fehlermeldung:', error.message);

    if (error.message.includes('API_KEY_INVALID')) {
      console.error('\n💡 LÖSUNG: Der API Key ist ungültig.');
      console.error('   Erstelle einen neuen Key hier: https://aistudio.google.com/apikey');
    } else if (error.message.includes('PERMISSION_DENIED')) {
      console.error('\n💡 LÖSUNG: Der API Key hat keine Berechtigung für Gemini API.');
      console.error('   Aktiviere die Gemini API in deinem Google Cloud Projekt.');
    } else if (error.message.includes('QUOTA_EXCEEDED')) {
      console.error('\n💡 LÖSUNG: Das API Quota ist aufgebraucht.');
      console.error('   Warte oder erhöhe dein Limit.');
    }

    console.error('\n📋 Vollständiger Fehler:', error);
    process.exit(1);
  }
}

// Test ausführen
testGeminiAPI();
