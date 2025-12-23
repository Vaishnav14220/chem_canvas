import { generateMultiSpeakerAudio } from '@/services/geminiService';

function toSpeechText(input: string) {
  let text = input.replace(/\r\n/g, '\n');
  text = text.replace(/```[\s\S]*?```/g, ' ');
  text = text.replace(/!\[[^\]]*?\]\([^)]+?\)/g, ' ');
  text = text.replace(/\[([^\]]+?)\]\([^)]+?\)/g, '$1');
  text = text.replace(/`([^`]+?)`/g, '$1');
  text = text.replace(/^\s{0,3}#{1,6}\s+/gm, '');
  text = text.replace(/^\s*[-*+]\s+/gm, '');
  text = text.replace(/^\s*\d+\.\s+/gm, '');
  text = text.replace(/\*\*([^*]+?)\*\*/g, '$1');
  text = text.replace(/\*([^*]+?)\*/g, '$1');
  text = text.replace(/__([^_]+?)__/g, '$1');
  text = text.replace(/_([^_]+?)_/g, '$1');
  text = text.replace(/\[(\d+)\]/g, '');
  text = text.replace(/\n{2,}/g, '\n').replace(/\n/g, '. ');
  return text.replace(/\s+/g, ' ').trim();
}

export async function generateAudioOverview(params: {
  text: string;
  mode: 'narration' | 'podcast';
  language?: 'en' | 'hi' | 'de' | 'it';
}): Promise<ArrayBuffer> {
  const clean = toSpeechText(params.text).slice(0, 6000);
  if (!clean) throw new Error('Nothing to narrate');

  const languageHint =
    params.language && params.language !== 'en'
      ? `\n\nImportant: Speak in ${params.language === 'hi' ? 'Hindi' : params.language === 'de' ? 'German' : 'Italian'}.`
      : '';

  if (params.mode === 'podcast') {
    const script = `TTS the following conversation between Host and Guest.${languageHint}\nHost: Let's discuss this topic.\nGuest: ${clean}\nHost: Great, summarize the key takeaways.\nGuest: ${clean.slice(0, 800)}`;
    return await generateMultiSpeakerAudio(script, [
      { name: 'Host', voiceName: 'Kore' },
      { name: 'Guest', voiceName: 'Puck' },
    ]);
  }

  const script = `TTS the following narration.${languageHint}\nSpeaker: ${clean}`;
  return await generateMultiSpeakerAudio(script, [{ name: 'Speaker', voiceName: 'Kore' }]);
}
