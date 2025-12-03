
import { GoogleGenAI } from '@google/genai';

const apiKey = process.env.GEMINI_API_KEY || 'YOUR_API_KEY';
const genAI = new GoogleGenAI({ apiKey });

async function listModels() {
    try {
        const response = await genAI.models.list();
        console.log('Available Models:');
        for (const model of response.models) {
            console.log(`- ${model.name}`);
            console.log(`  Supported Generation Methods: ${model.supportedGenerationMethods}`);
            console.log(`  Input Token Limit: ${model.inputTokenLimit}`);
            console.log(`  Output Token Limit: ${model.outputTokenLimit}`);
        }
    } catch (error) {
        console.error('Error listing models:', error);
    }
}

listModels();
