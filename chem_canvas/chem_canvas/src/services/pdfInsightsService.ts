import { generateTextContent, extractJsonBlock } from './geminiService';

export interface PdfInsightsResult {
  summary: string;
  keyTopics: string[];
  essentialConcepts: string[];
  videoQueries: string[];
}

export const analyzePdfTextWithGemini = async (
  documentName: string,
  rawText: string
): Promise<PdfInsightsResult> => {
  const excerpt = rawText.slice(0, 18000);

  const prompt = [
    'You analyze technical PDF content for chemistry students.',
    'Return ONLY JSON with this exact shape:',
    '{',
    '  "summary": "2-3 sentence student-friendly overview",',
    '  "keyTopics": ["topic1", "topic2", "..."],',
    '  "essentialConcepts": ["short bullet concept", "..."],',
    '  "videoQueries": ["search phrase 1", "..."]',
    '}',
    'Rules:',
    '- keyTopics must list 5-7 concise topics.',
    '- essentialConcepts must highlight concrete takeaways (max 5).',
    '- videoQueries should be 3-4 short phrases that would surface high quality explanatory YouTube videos.',
    '- Do not include markdown fences, commentary, or any other text.',
    '',
    `Document name: ${documentName}`,
    'Extracted text sample:',
    excerpt
  ].join('\n');

  const response = await generateTextContent(prompt);
  const jsonPayload = extractJsonBlock(response);

  try {
    const parsed = JSON.parse(jsonPayload);
    return {
      summary: parsed?.summary ?? '',
      keyTopics: Array.isArray(parsed?.keyTopics) ? parsed.keyTopics.filter(Boolean) : [],
      essentialConcepts: Array.isArray(parsed?.essentialConcepts) ? parsed.essentialConcepts.filter(Boolean) : [],
      videoQueries: Array.isArray(parsed?.videoQueries) ? parsed.videoQueries.filter(Boolean) : []
    };
  } catch (error) {
    console.error('Failed to parse PDF insights response:', error, jsonPayload);
    throw new Error('Gemini could not summarize the PDF content.');
  }
};
