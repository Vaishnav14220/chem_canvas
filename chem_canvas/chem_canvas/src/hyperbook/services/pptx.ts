import type { Slide, Source } from '../lib/types';
import { DEFAULT_GEMINI_TEXT_MODEL, geminiGenerateJson } from './geminiText';
import { getGeminiApiKey } from './keys';

type SlideAcademic = {
  explanation?: string;
  keyTakeaways?: string[];
  speakerNotes?: string;
  references?: number[];
  figureCaption?: string;
};

type PickedSource = { index: number; title: string; uri?: string; text: string };

function pickSources(sources: Source[], maxCharsPerSource = 4000, maxSources = 6): PickedSource[] {
  const picked = (Array.isArray(sources) ? sources : [])
    .filter((s) => s?.status === 'success' && (s.text || s.content))
    .slice(0, maxSources);

  return picked.map((s, idx) => ({
    index: idx + 1,
    title: String(s.title ?? s.url ?? `Source ${idx + 1}`),
    uri: s.url,
    text: String(s.text || s.content || '').slice(0, maxCharsPerSource),
  }));
}

function buildContentFromPickedSources(picked: PickedSource[]) {
  const payload = picked
    .map((s) => `[Source ${s.index}] ${s.title}${s.uri ? ` - ${s.uri}` : ''}\n${s.text}`)
    .join('\n\n');
  if (!payload) throw new Error('No source text available for PPTX generation.');
  return payload;
}

async function geminiGenerateSlideImages(apiKey: string, imagePrompts: string[]) {
  const model = 'gemini-3-pro-image-preview';
  const results: Array<{ mimeType: string; base64: string }> = [];

  const concurrency = 2;
  let index = 0;
  const worker = async () => {
    while (index < imagePrompts.length) {
      const current = index;
      index += 1;
      const prompt = imagePrompts[current];

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            responseModalities: ['IMAGE'],
            imageConfig: { aspectRatio: '16:9', imageSize: '1K' },
          },
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data: any = await res.json();
      const parts: Array<any> = data.candidates?.[0]?.content?.parts ?? [];
      const partWithImage = parts.find((p) => p?.inlineData?.data);
      const base64 = partWithImage?.inlineData?.data as string | undefined;
      const mimeType = (partWithImage?.inlineData?.mimeType as string | undefined) || 'image/png';
      if (!base64) throw new Error('No image data returned from image model.');
      results[current] = { mimeType, base64 };
    }
  };

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return results;
}

function bulletLines(bullets: string[]) {
  return bullets.filter(Boolean).join('\n');
}

function shortRefs(refs: number[] | undefined): string {
  const uniq = Array.from(new Set((refs || []).filter((n) => Number.isFinite(n) && n > 0))).slice(0, 4);
  if (uniq.length === 0) return '';
  return uniq.map((n) => `[${n}]`).join(' ');
}

export async function downloadPptx(params: { title: string; slides: Slide[]; sources: Source[] }) {
  const apiKey = await getGeminiApiKey();
  if (!apiKey) throw new Error('Gemini API key is missing');
  if (!params.slides.length) throw new Error('Slides are required to build a PPTX.');

  const pickedSources = pickSources(params.sources);
  const sourceContent = buildContentFromPickedSources(pickedSources);

  // Academic slide enrichment
  let academicSlides: SlideAcademic[] = [];
  try {
    const prompt = [
      'You are an academic presentation writer.',
      'Given the slide titles/bullets and the source content, enrich each slide with explanation and presenter notes.',
      '',
      'Requirements:',
      '- Keep a scholarly/academic tone (clear definitions, assumptions, limitations).',
      "- Do NOT invent facts that aren't supported by the sources.",
      '- Provide 2-4 sentence explanation per slide for the audience (on-slide).',
      '- Provide 4-8 sentence speaker notes per slide (presenter notes).',
      '- Provide 2-4 key takeaways per slide (short phrases).',
      '- Provide references as an array of source numbers, choosing from the provided sources (e.g., [1,3]).',
      '- If a slide is conceptual and no single source applies, choose the closest sources and include 1-2 references.',
      '',
      'Return ONLY valid JSON matching exactly:',
      '{',
      '  "slides": [',
      '    {',
      '      "explanation": "string",',
      '      "keyTakeaways": ["string"],',
      '      "speakerNotes": "string",',
      '      "references": [1],',
      '      "figureCaption": "string"',
      '    }',
      '  ]',
      '}',
      '',
      'SLIDES:',
      JSON.stringify(params.slides),
      '',
      'SOURCES:',
      sourceContent,
    ].join('\n');

    const json = await geminiGenerateJson<{ slides: SlideAcademic[] }>({
      model: DEFAULT_GEMINI_TEXT_MODEL,
      prompt,
      maxOutputTokens: 4000,
    });
    academicSlides = Array.isArray(json?.slides) ? json.slides : [];
  } catch (e) {
    console.warn('[HyperbookLM] Academic slide expansion failed:', e);
    academicSlides = [];
  }

  const promptForImagePrompts = [
    'You are creating a professional PowerPoint deck.',
    'Given the slide titles and bullets, generate a background/illustration prompt for each slide.',
    'Use ONLY the provided source content for factual grounding.',
    '',
    'Rules for image prompts:',
    '- Each prompt must produce a 16:9 image suitable for a slide (clean, modern, minimal, high contrast).',
    '- Do NOT include any text, letters, numbers, or watermarks in the image.',
    '- Prefer academic diagrams/illustrations/icons/abstract visuals over photorealism unless clearly needed.',
    '- Keep consistent style across all slides.',
    '- If the slide is technical, prefer schematic diagrams or conceptual visuals (no equations as text).',
    '',
    'Return ONLY valid JSON in this exact shape:',
    '{ "imagePrompts": ["prompt for slide 1", "prompt for slide 2", "..."] }',
    '',
    'SLIDES:',
    JSON.stringify(params.slides),
    '',
    'SOURCES:',
    sourceContent,
  ].join('\n');

  const imagePromptJson = await geminiGenerateJson<{ imagePrompts: string[] }>({
    model: DEFAULT_GEMINI_TEXT_MODEL,
    prompt: promptForImagePrompts,
    maxOutputTokens: 2000,
  });
  const imagePromptsRaw = Array.isArray(imagePromptJson?.imagePrompts) ? imagePromptJson.imagePrompts : [];
  const imagePrompts =
    imagePromptsRaw.length === params.slides.length
      ? imagePromptsRaw.map(String)
      : params.slides.map((s) => `Create a clean, modern 16:9 slide illustration for the topic: "${s.title}". No text. Minimal.`);

  const images = await geminiGenerateSlideImages(apiKey, imagePrompts);

  const { default: PptxGenJS } = await import('pptxgenjs');
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = 'HyperbookLM';
  pptx.company = 'HyperbookLM';
  pptx.subject = 'Generated presentation';
  pptx.title = params.title.trim() || 'Presentation';

  const first = pptx.addSlide();
  first.background = { color: '0B1220' };
  first.addText(pptx.title, {
    x: 0.9,
    y: 2.4,
    w: 11.6,
    h: 1.2,
    fontFace: 'Aptos Display',
    fontSize: 44,
    bold: true,
    color: 'FFFFFF',
  });
  first.addText('Generated with Gemini + HyperbookLM', {
    x: 0.9,
    y: 3.6,
    w: 11.6,
    h: 0.5,
    fontFace: 'Aptos',
    fontSize: 16,
    color: 'B6C2D9',
  });

  params.slides.forEach((s, i) => {
    const slide = pptx.addSlide();
    slide.background = { color: 'FFFFFF' };

    const img = images[i];
    if (img?.base64) {
      slide.addImage({
        data: `data:${img.mimeType};base64,${img.base64}`,
        x: 8.15,
        y: 1.2,
        w: 4.95,
        h: 4.25,
      });
    }

    slide.addText(String(s.title || `Slide ${i + 1}`), {
      x: 0.7,
      y: 0.55,
      w: 7.25,
      h: 0.8,
      fontFace: 'Aptos Display',
      fontSize: 30,
      bold: true,
      color: '0B1220',
    });

    slide.addText(bulletLines(Array.isArray(s.bullets) ? s.bullets : []), {
      x: 0.8,
      y: 1.35,
      w: 7.15,
      h: 2.75,
      fontFace: 'Aptos',
      fontSize: 18,
      color: '111827',
      bullet: { indent: 18 },
      lineSpacingMultiple: 1.15,
      paraSpaceAfter: 10,
    });

    const academic = academicSlides[i] || {};
    const explanation = typeof academic.explanation === 'string' ? academic.explanation.trim() : '';
    const keyTakeaways = Array.isArray(academic.keyTakeaways) ? academic.keyTakeaways.map(String).filter(Boolean).slice(0, 4) : [];
    const refs = Array.isArray(academic.references) ? academic.references.map(Number).filter((n) => Number.isFinite(n) && n > 0) : [];

    slide.addShape(pptx.ShapeType.roundRect, {
      x: 0.75,
      y: 4.25,
      w: 7.2,
      h: 2.25,
      fill: { color: 'F9FAFB' },
      line: { color: 'E5E7EB', width: 1 },
    });

    slide.addText('Explanation', {
      x: 0.95,
      y: 4.35,
      w: 6.9,
      h: 0.3,
      fontFace: 'Aptos Display',
      fontSize: 14,
      bold: true,
      color: '111827',
    });

    if (explanation) {
      slide.addText(explanation, {
        x: 0.95,
        y: 4.7,
        w: 6.9,
        h: 0.85,
        fontFace: 'Aptos',
        fontSize: 12,
        color: '111827',
        lineSpacingMultiple: 1.15,
      });
    }

    if (keyTakeaways.length > 0) {
      slide.addText('Key takeaways:', {
        x: 0.95,
        y: 5.55,
        w: 6.9,
        h: 0.3,
        fontFace: 'Aptos Display',
        fontSize: 12,
        bold: true,
        color: '111827',
      });
      slide.addText(bulletLines(keyTakeaways), {
        x: 1.05,
        y: 5.85,
        w: 6.8,
        h: 0.6,
        fontFace: 'Aptos',
        fontSize: 11,
        color: '111827',
        bullet: { indent: 14 },
        lineSpacingMultiple: 1.1,
        paraSpaceAfter: 6,
      });
    }

    const caption = typeof academic.figureCaption === 'string' ? academic.figureCaption.trim() : '';
    if (caption) {
      slide.addText(`Figure: ${caption}`, {
        x: 8.15,
        y: 5.5,
        w: 4.95,
        h: 0.5,
        fontFace: 'Aptos',
        fontSize: 10,
        italic: true,
        color: '374151',
      });
    }

    const refsText = shortRefs(refs);
    slide.addText(`${refsText}${refsText ? '  •  ' : ''}Slide ${i + 1} / ${params.slides.length}`, {
      x: 0.8,
      y: 7.05,
      w: 7.15,
      h: 0.3,
      fontFace: 'Aptos',
      fontSize: 11,
      color: '6B7280',
    });

    slide.addShape(pptx.ShapeType.line, {
      x: 8.05,
      y: 1.2,
      w: 0,
      h: 4.25,
      line: { color: 'E5E7EB', width: 1 },
    });

    const speakerNotes = typeof academic.speakerNotes === 'string' ? academic.speakerNotes.trim() : '';
    if (speakerNotes) {
      const notesRefs =
        refs.length > 0
          ? `\n\nReferences: ${refs
              .slice(0, 6)
              .map((n) => {
                const src = pickedSources.find((s2) => s2.index === n);
                if (!src) return `[${n}]`;
                return `[${n}] ${src.title}${src.uri ? ` - ${src.uri}` : ''}`;
              })
              .join('\n')}`
          : '';
      slide.addNotes(`${speakerNotes}${notesRefs}`);
    }
  });

  const refsSlide = pptx.addSlide();
  refsSlide.background = { color: 'FFFFFF' };
  refsSlide.addText('References', {
    x: 0.7,
    y: 0.6,
    w: 12.0,
    h: 0.8,
    fontFace: 'Aptos Display',
    fontSize: 32,
    bold: true,
    color: '0B1220',
  });

  const refsLines = pickedSources.map((s) => {
    const uri = s.uri ? ` - ${s.uri}` : '';
    return `[${s.index}] ${s.title}${uri}`;
  });
  refsSlide.addText(bulletLines(refsLines), {
    x: 0.9,
    y: 1.6,
    w: 12.0,
    h: 5.8,
    fontFace: 'Aptos',
    fontSize: 16,
    color: '111827',
    bullet: { indent: 18 },
    lineSpacingMultiple: 1.15,
    paraSpaceAfter: 8,
  });

  const safeName = pptx.title.replace(/[^a-z0-9-_ ]/gi, '').slice(0, 60) || 'presentation';
  // Browser-friendly download (PptxGenJS provides this in browser builds)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (pptx as any).writeFile({ fileName: `${safeName}.pptx` });
}
