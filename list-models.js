// Liste alle verfügbaren Gemini Modelle
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';

dotenv.config();

async function listModels() {
  const apiKey = process.env.VITE_GEMINI_API_KEY;

  if (!apiKey) {
    console.error('❌ Kein API Key gefunden!');
    process.exit(1);
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);

    console.log('📋 Verfügbare Gemini Modelle:\n');

    const models = await genAI.listModels();

    if (models.length === 0) {
      console.log('   Keine Modelle gefunden.');
    } else {
      for (const model of models) {
        console.log(`✅ ${model.name}`);
        console.log(`   Display Name: ${model.displayName || 'N/A'}`);
        console.log(`   Description: ${model.description || 'N/A'}`);
        console.log('');
      }
    }

    console.log(`📊 Insgesamt ${models.length} Modelle verfügbar\n`);

  } catch (error) {
    console.error('❌ Fehler:', error.message);
    process.exit(1);
  }
}

listModels();
