import { useEffect, useMemo, useRef, useState } from 'react';
import { DrawIoEmbed } from 'react-drawio';
import type { DrawIoEmbedRef } from 'react-drawio';
import type { ImperativePanelHandle } from 'react-resizable-panels';
import {
  ChevronLeft,
  Cloud,
  Download,
  FileText,
  History,
  Image as ImageIcon,
  Loader2,
  Moon,
  PanelRightClose,
  PanelRightOpen,
  Palette,
  Sparkles,
  Sun,
  Trash2
} from 'lucide-react';
import pako from 'pako';

import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from './ui/resizable';
import { generateImagen4Images, streamTextContent } from '../services/geminiService';
import { streamGroqContent } from '../services/groqService';
import { extractTextFromDocument, isImageFile, isPdfFile, isPlainTextDocument } from '../utils/documentTextExtractor';
import { ModelSelector } from './GeminiLive/ModelSelector';
import { GeminiModelId, getDefaultModelId, getModelProvider } from '../types/modelTypes';
import { AspectRatio, ImageSize } from '../types/studium';

const DRAWIO_BASE_URL = import.meta.env.VITE_DRAWIO_BASE_URL || 'https://embed.diagrams.net';
const STORAGE_DRAWIO_UI_KEY = 'drawio-theme';
const STORAGE_DARK_MODE_KEY = 'next-ai-draw-io-dark-mode';
export const STORAGE_DIAGRAM_XML_KEY = 'next-ai-draw-io-diagram-xml';
const STORAGE_MESSAGES_KEY = 'next-ai-draw-io-messages';
const STORAGE_XML_SNAPSHOTS_KEY = 'next-ai-draw-io-xml-snapshots';
const STORAGE_STYLED_KEY = 'next-ai-draw-io-styled';
const STORAGE_IMAGE_MODE_KEY = 'next-ai-draw-io-image-mode';

const MAX_ACTIVE_REQUESTS = 3;
const WORKFLOW_IMAGE_CONCURRENCY = 3;

const ACADEMIC_IMAGE_STYLE_PREFIX = `Academic scientific illustration style:
- clean, textbook-like 2D figure (NOT cinematic, NOT glossy 3D)
- neutral lighting, minimal shadows, plain light background
- muted color palette, no neon/glow, no lens flare
- simple shapes and clear composition
- absolutely NO text/words/letters/numbers/watermarks/logos in the image`;

export type DrawIOChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: number;
  thought?: string;
  imageDataUrl?: string;
  imageOptions?: string[];
  imagePrompt?: string;
  workflowSteps?: WorkflowStep[];
};

type XmlSnapshot = { createdAt: number; prompt: string; xml: string };

type DrawIOWorkspaceProps = { onBack: () => void };

type WorkflowStep = {
  id: string;
  title: string;
  description: string;
  imagePrompt: string;
  status: 'queued' | 'generating' | 'ready' | 'error';
  imageDataUrl?: string;
  error?: string;
};

type VertexBounds = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  style: string;
  valueText: string;
};

function extractDiagramXmlFromXmlSvg(xmlSvgDataUrl: string): string | null {
  try {
    const base64 = xmlSvgDataUrl.includes(',') ? xmlSvgDataUrl.split(',')[1] : xmlSvgDataUrl;
    if (!base64) return null;

    const svgString = atob(base64);
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(svgString, 'image/svg+xml');
    const svgElement = svgDoc.querySelector('svg');
    if (!svgElement) return null;

    const encodedContent = svgElement.getAttribute('content');
    if (!encodedContent) return null;

    const textarea = document.createElement('textarea');
    textarea.innerHTML = encodedContent;
    const xmlContent = textarea.value;

    const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');
    const diagramElement = xmlDoc.querySelector('diagram');
    if (!diagramElement?.textContent) return null;

    const binaryString = atob(diagramElement.textContent);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);

    const decompressedData = pako.inflate(bytes, { windowBits: -15 });
    const decoder = new TextDecoder('utf-8');
    const decodedString = decoder.decode(decompressedData);
    return decodeURIComponent(decodedString);
  } catch (e) {
    console.warn('Failed to extract draw.io XML from xmlsvg', e);
    return null;
  }
}

function normalizeXmlForDrawio(xml: string): string {
  const trimmed = xml.trim();
  if (!trimmed) return trimmed;
  if (trimmed.includes('<mxfile')) return trimmed;
  if (trimmed.includes('<diagram') && trimmed.includes('<mxGraphModel')) {
    return `<mxfile host="app.diagrams.net">${trimmed}</mxfile>`;
  }
  if (trimmed.includes('<mxGraphModel')) {
    return `<mxfile host="app.diagrams.net"><diagram name="Page-1" id="page-1">${trimmed}</diagram></mxfile>`;
  }
  return trimmed;
}

function repairDrawioXml(xml: string): string {
  let repaired = xml;

  // Early exit if no root element
  if (!repaired.includes('<root>')) {
    return repaired;
  }

  // Inject missing root cells
  if (!repaired.includes('id="0"')) {
    repaired = repaired.replace('<root>', '<root><mxCell id="0"/>');
  }
  if (!repaired.includes('id="1"')) {
    repaired = repaired.replace('<mxCell id="0"/>', '<mxCell id="0"/><mxCell id="1" parent="0"/>');
  }

  // Fix incorrect <Geometry> tag (common AI hallucination)
  repaired = repaired.replace(/<Geometry/g, '<mxGeometry');
  repaired = repaired.replace(/<\/Geometry>/g, '</mxGeometry>');

  // Fix unescaped HTML in value attributes (e.g., value="<img ...>")
  // This regex finds value="..." and escapes the inner content if it looks like HTML
  repaired = repaired.replace(/value="([^"]*)"/g, (match, content) => {
    if (content.includes('<') || content.includes('>')) {
      const escaped = content
        .replace(/&/g, '&amp;') // Must escape ampersands first
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
      return `value="${escaped}"`;
    }
    return match;
  });

  // Fix vertex cells missing parent="1"
  repaired = repaired.replace(/<mxCell([^>]*)>/g, (match, attrs) => {
    // Skip if already has a parent attribute
    if (/parent=/.test(attrs)) return match;

    // Only add parent for edge or vertex cells
    if (/edge="1"/.test(attrs) || /vertex="1"/.test(attrs)) {
      if (attrs.trim().endsWith('/')) {
        // Handle self-closing tag: <mxCell ... /> -> <mxCell ... parent="1" />
        return `<mxCell ${attrs.replace(/\/$/, '')} parent="1" />`;
      } else {
        // Handle open tag: <mxCell ...> -> <mxCell ... parent="1">
        return `<mxCell ${attrs} parent="1">`;
      }
    }
    return match;
  });

  // Force reset view offsets and page size to ensure visibility
  // 1. Remove existing attributes to avoid duplicates
  repaired = repaired.replace(/\s+(dx|dy|page|pageWidth|pageHeight)="[^"]*"/g, '');

  // 2. Inject forced values into mxGraphModel
  repaired = repaired.replace('<mxGraphModel', '<mxGraphModel dx="0" dy="0" page="0" pageWidth="5000" pageHeight="5000"');

  console.log('🔧 Repaired XML preview:', repaired.substring(0, 200));

  return repaired;
}

function extractMxfileFromModelOutput(text: string): string | null {
  const raw = text.trim();
  if (!raw) return null;

  const start = raw.indexOf('<mxfile');
  if (start >= 0) {
    const end = raw.indexOf('</mxfile>', start);
    let extracted = '';
    if (end >= 0) {
      extracted = normalizeXmlForDrawio(raw.slice(start, end + '</mxfile>'.length));
    } else {
      extracted = normalizeXmlForDrawio(raw.slice(start));
    }
    return repairDrawioXml(extracted);
  }

  const fence = raw.match(/```(?:xml)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) {
    // Recursive call to handle nested fences or cleanup
    const inner = extractMxfileFromModelOutput(fence[1]);
    if (inner) return inner;
    return repairDrawioXml(normalizeXmlForDrawio(fence[1]));
  }

  if (raw.includes('<mxGraphModel') || raw.includes('<diagram')) {
    return repairDrawioXml(normalizeXmlForDrawio(raw));
  }
  return null;
}

function getEmptyDiagramXml(): string {
  return `<mxfile host="app.diagrams.net"><diagram name="Page-1" id="page-1"><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/></root></mxGraphModel></diagram></mxfile>`;
}

function getImagePromptFromInput(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(?:\/(?:img|image)\s+|image:\s*)([\s\S]+)/i);
  const prompt = match?.[1]?.trim();
  return prompt ? prompt : null;
}

function buildDataUrl(mimeType: string, base64: string): string {
  const cleanMime = mimeType?.trim() || 'image/png';
  return `data:${cleanMime};base64,${base64}`;
}

function wrapImageAsAnimatedSvgDataUri(params: { mimeType: string; imageBase64: string }): string {
  const embedded = buildDataUrl(params.mimeType, params.imageBase64);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512" preserveAspectRatio="xMidYMid meet">
  <g>
    <animateTransform attributeName="transform" type="translate" dur="1.6s" repeatCount="indefinite" values="0 0; 0 -10; 0 0"/>
    <image href="${embedded}" x="0" y="0" width="512" height="512" preserveAspectRatio="xMidYMid slice"/>
  </g>
</svg>`;

  // Important: no semicolons in the outer data URI (style strings use ';' as delimiter).
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function insertImageIntoMxfile(params: {
  mxfileXml: string;
  imageDataUrl: string;
  label?: string;
  position?: { x: number; y: number };
  size?: { width: number; height: number };
  linkFromCellId?: string;
}): string {
  const fallback = normalizeXmlForDrawio(params.mxfileXml || getEmptyDiagramXml());
  try {
    const parser = new DOMParser();
    let doc = parser.parseFromString(fallback, 'text/xml');
    if (doc.querySelector('parsererror')) {
      doc = parser.parseFromString(getEmptyDiagramXml(), 'text/xml');
    }

    const root = doc.querySelector('mxfile diagram mxGraphModel root');
    if (!root) return fallback;

    let maxX = 40;
    let maxY = 40;
    root.querySelectorAll('mxCell[vertex="1"]').forEach((cell) => {
      const geom = cell.querySelector('mxGeometry');
      if (!geom) return;
      const x = Number(geom.getAttribute('x') ?? 0);
      const y = Number(geom.getAttribute('y') ?? 0);
      const w = Number(geom.getAttribute('width') ?? 0);
      const h = Number(geom.getAttribute('height') ?? 0);
      if (Number.isFinite(x) && Number.isFinite(w)) maxX = Math.max(maxX, x + w);
      if (Number.isFinite(y) && Number.isFinite(h)) maxY = Math.max(maxY, y + h);
    });

    const width = params.size?.width ?? 340;
    const height = params.size?.height ?? 255;
    const x = Math.round(params.position?.x ?? maxX + 40);
    const y = Math.round(params.position?.y ?? Math.max(40, maxY - height));

    const cell = doc.createElement('mxCell');
    const imageId = `img-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    cell.setAttribute('id', imageId);
    cell.setAttribute('vertex', '1');
    cell.setAttribute('parent', '1');

    // Use a semicolon-free data URI (e.g. data:image/svg+xml,...) so mxGraph style parsing doesn't break.
    cell.setAttribute('value', '');
    cell.setAttribute(
      'style',
      `shape=image;image=${params.imageDataUrl};imageAspect=1;aspect=fixed;whiteSpace=wrap;html=1;strokeColor=none;fillColor=none;`
    );

    const geom = doc.createElement('mxGeometry');
    geom.setAttribute('x', String(x));
    geom.setAttribute('y', String(y));
    geom.setAttribute('width', String(width));
    geom.setAttribute('height', String(height));
    geom.setAttribute('as', 'geometry');
    cell.appendChild(geom);
    root.appendChild(cell);

    if (params.linkFromCellId) {
      const edge = doc.createElement('mxCell');
      edge.setAttribute('id', `edge-${Date.now()}-${Math.random().toString(16).slice(2)}`);
      edge.setAttribute('edge', '1');
      edge.setAttribute('parent', '1');
      edge.setAttribute('source', params.linkFromCellId);
      edge.setAttribute('target', imageId);
      edge.setAttribute(
        'style',
        'edgeStyle=orthogonalEdgeStyle;rounded=0;orthogonalLoop=1;jettySize=auto;html=1;dashed=1;strokeColor=#6b7280;endArrow=block;endFill=1;'
      );

      const egeom = doc.createElement('mxGeometry');
      egeom.setAttribute('relative', '1');
      egeom.setAttribute('as', 'geometry');
      edge.appendChild(egeom);
      root.appendChild(edge);
    }

    return normalizeXmlForDrawio(new XMLSerializer().serializeToString(doc));
  } catch (e) {
    console.warn('Failed to insert image into draw.io XML', e);
    return fallback;
  }
}

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function formatFileHint(file: File): string {
  if (isPdfFile(file)) return 'PDF';
  if (isPlainTextDocument(file)) return 'Text';
  if (isImageFile(file)) return 'Image';
  return 'File';
}

function makeMessageId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function extractDiagramLabels(mxfileXml: string): string[] {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(normalizeXmlForDrawio(mxfileXml || ''), 'text/xml');
    const cells = Array.from(doc.querySelectorAll('mxCell[vertex="1"][value]'));
    const labels = cells
      .map((cell) => stripHtml(String(cell.getAttribute('value') ?? '')).trim())
      .filter(Boolean);
    return Array.from(new Set(labels)).slice(0, 80);
  } catch {
    return [];
  }
}

function getLeafVertexBounds(mxfileXml: string): VertexBounds[] {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(normalizeXmlForDrawio(mxfileXml || ''), 'text/xml');

    const childCount = new Map<string, number>();
    doc.querySelectorAll('mxCell[parent]').forEach((cell) => {
      const parent = cell.getAttribute('parent');
      if (!parent) return;
      childCount.set(parent, (childCount.get(parent) ?? 0) + 1);
    });

    const vertices = Array.from(doc.querySelectorAll('mxCell[vertex="1"]'));
    const bounds: VertexBounds[] = [];
    for (const cell of vertices) {
      const id = cell.getAttribute('id') ?? '';
      if (!id) continue;

      // Ignore container/group vertices to avoid false overlap checks.
      if ((childCount.get(id) ?? 0) > 0) continue;

      const geom = cell.querySelector('mxGeometry');
      if (!geom) continue;

      const x = Number(geom.getAttribute('x') ?? NaN);
      const y = Number(geom.getAttribute('y') ?? NaN);
      const w = Number(geom.getAttribute('width') ?? NaN);
      const h = Number(geom.getAttribute('height') ?? NaN);
      if (![x, y, w, h].every(Number.isFinite)) continue;
      if (w <= 0 || h <= 0) continue;

      const style = String(cell.getAttribute('style') ?? '');
      const valueText = stripHtml(String(cell.getAttribute('value') ?? ''));

      bounds.push({ id, x, y, w, h, style, valueText });
    }

    return bounds;
  } catch {
    return [];
  }
}

function isNoteLike(style: string): boolean {
  const s = style.toLowerCase();
  return s.includes('shape=note') || s.includes('note;') || s.includes('shape=callout') || s.includes('callout');
}

function isImageLike(style: string): boolean {
  const s = style.toLowerCase();
  return s.includes('shape=image') || s.includes('image=');
}

function isNoteLikeVertex(v: VertexBounds): boolean {
  if (isNoteLike(v.style)) return true;
  const text = v.valueText || '';
  const longText = text.length >= 80 || text.split(/\n+/).length >= 3 || text.includes(':') || text.includes('•');
  const bigBox = v.w >= 160 && v.h >= 70;
  return longText && bigBox;
}

function rectsOverlap(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function safeParseJsonObject(text: string): any | null {
  const raw = text.trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    // Try to extract a JSON object substring.
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(raw.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function runWithConcurrency<T>(items: T[], limit: number, worker: (item: T, index: number) => Promise<void>): Promise<void> {
  const concurrency = Math.max(1, Math.floor(limit));
  if (items.length === 0) return Promise.resolve();

  let nextIndex = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const index = nextIndex++;
      if (index >= items.length) return;
      await worker(items[index], index);
    }
  });

  return Promise.all(runners).then(() => undefined);
}

function countWorkflowDone(steps: WorkflowStep[]): number {
  return steps.filter((s) => s.status === 'ready' || s.status === 'error').length;
}

function findAnchorCellForStep(params: { mxfileXml: string; stepTitle: string }): VertexBounds | null {
  const title = params.stepTitle.trim().toLowerCase();
  if (!title) return null;

  const vertices = getLeafVertexBounds(params.mxfileXml || '');
  if (!vertices.length) return null;

  const titleTokens = title
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 3);

  const score = (candidate: string): number => {
    const text = candidate.toLowerCase();
    if (!text) return 0;
    let s = 0;
    if (text.includes(title)) s += 8;
    for (const t of titleTokens.slice(0, 6)) {
      if (text.includes(t)) s += t.length >= 5 ? 3 : 2;
    }
    // Penalize very long text blocks (notes) for anchor matching.
    if (candidate.length >= 80) s -= 2;
    return s;
  };

  let best: { v: VertexBounds; s: number } | null = null;
  for (const v of vertices) {
    // Avoid matching to images we've inserted.
    if (isImageLike(v.style)) continue;
    const s = score(v.valueText);
    if (s <= 0) continue;
    if (!best || s > best.s) best = { v, s };
  }

  return best?.v ?? null;
}

function findClosestNoteToAnchor(vertices: VertexBounds[], anchor: VertexBounds): VertexBounds | null {
  const notes = vertices.filter((v) => isNoteLikeVertex(v) && !isImageLike(v.style));
  if (!notes.length) return null;

  const ax = anchor.x + anchor.w / 2;
  const ay = anchor.y + anchor.h / 2;
  let best: { d: number; v: VertexBounds } | null = null;

  for (const n of notes) {
    const nx = n.x + n.w / 2;
    const ny = n.y + n.h / 2;
    const d = Math.hypot(nx - ax, ny - ay);
    if (d > 520) continue;
    if (!best || d < best.d) best = { d, v: n };
  }

  return best?.v ?? null;
}

function computeSmartImagePlacement(params: {
  mxfileXml: string;
  stepTitle: string;
  width: number;
  height: number;
}): { position: { x: number; y: number }; linkFromCellId?: string } {
  const GAP = 32;
  const MARGIN = 18;
  const MIN_XY = 40;

  const vertices = getLeafVertexBounds(params.mxfileXml || '');
  const anchor = findAnchorCellForStep({ mxfileXml: params.mxfileXml, stepTitle: params.stepTitle });
  const noteAnchor = anchor ? findClosestNoteToAnchor(vertices, anchor) : null;
  const base = noteAnchor ?? anchor;

  const obstacles = vertices.filter((v) => v.w > 0 && v.h > 0);
  const inflated = obstacles
    .map((v) => ({ x: v.x - MARGIN, y: v.y - MARGIN, w: v.w + 2 * MARGIN, h: v.h + 2 * MARGIN }))
    .filter((r) => r.w > 0 && r.h > 0);

  const content = vertices.filter((v) => !isImageLike(v.style));
  let minX = MIN_XY;
  let minY = MIN_XY;
  let maxX = MIN_XY;
  let maxY = MIN_XY;
  if (content.length) {
    minX = Math.min(...content.map((v) => v.x));
    minY = Math.min(...content.map((v) => v.y));
    maxX = Math.max(...content.map((v) => v.x + v.w));
    maxY = Math.max(...content.map((v) => v.y + v.h));
  }

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  const candidates: Array<{ x: number; y: number }> = [];
  if (base) {
    const rightX = base.x + base.w + GAP;
    const leftX = base.x - GAP - params.width;
    const topY = base.y - GAP - params.height;
    const bottomY = base.y + base.h + GAP;
    const centerY = base.y + base.h / 2 - params.height / 2;
    const centerX = base.x + base.w / 2 - params.width / 2;

    candidates.push(
      // Prefer keeping image close to note (if present) or anchor.
      { x: rightX, y: base.y },
      { x: rightX, y: centerY },
      { x: rightX, y: bottomY - params.height },
      { x: base.x, y: bottomY },
      { x: centerX, y: bottomY },
      { x: leftX, y: base.y },
      { x: leftX, y: centerY },
      { x: base.x, y: topY },
      { x: centerX, y: topY }
    );
  }

  // Fallback positions: near the diagram center and near the right edge (but bounded).
  candidates.push({ x: centerX + GAP, y: centerY - params.height / 2 });
  candidates.push({ x: centerX - params.width - GAP, y: centerY - params.height / 2 });
  candidates.push({ x: maxX + GAP, y: clampNumber(maxY - params.height, MIN_XY, maxY + 120) });

  const maxOutside = 140;
  const baseCx = base ? base.x + base.w / 2 : centerX;
  const baseCy = base ? base.y + base.h / 2 : centerY;

  const candidateScore = (rect: { x: number; y: number; w: number; h: number }) => {
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h / 2;
    let s = 0;

    // Prefer candidates that stay within/near the current content bounding box (avoid off-screen drift).
    if (rect.x > maxX + maxOutside) s += 1_000_000 + (rect.x - (maxX + maxOutside)) * 50;
    if (rect.x < minX - maxOutside) s += 1_000_000 + ((minX - maxOutside) - rect.x) * 50;
    if (rect.y > maxY + maxOutside) s += 1_000_000 + (rect.y - (maxY + maxOutside)) * 30;
    if (rect.y < minY - maxOutside) s += 1_000_000 + ((minY - maxOutside) - rect.y) * 30;

    // Prefer closeness to the base (note/anchor) and also to overall diagram center.
    s += Math.hypot(cx - baseCx, cy - baseCy) * 1.2;
    s += Math.hypot(cx - centerX, cy - centerY) * 0.6;

    // Slightly prefer being to the left/right of the base rather than above (keeps notes readable).
    const verticalPenalty = Math.abs(cy - baseCy);
    const horizontalPenalty = Math.abs(cx - baseCx);
    s += verticalPenalty > horizontalPenalty ? 80 : 0;

    return s;
  };

  let best: { rect: { x: number; y: number; w: number; h: number }; score: number } | null = null;
  for (const c of candidates) {
    const rect = {
      x: Math.round(Math.max(MIN_XY, c.x)),
      y: Math.round(Math.max(MIN_XY, c.y)),
      w: params.width,
      h: params.height
    };
    const overlaps = inflated.some((r) => rectsOverlap(rect, r));
    if (overlaps) continue;
    const score = candidateScore(rect);
    if (!best || score < best.score) best = { rect, score };
  }

  if (best) {
    return {
      position: { x: best.rect.x, y: best.rect.y },
      linkFromCellId: anchor?.id
    };
  }

  return {
    position: { x: Math.round(maxX + GAP), y: Math.round(Math.max(MIN_XY, clampNumber(centerY - params.height / 2, MIN_XY, maxY))) },
    linkFromCellId: anchor?.id
  };
}

function computeSmartImageSize(anchor: VertexBounds | null, aspect: { w: number; h: number }): { width: number; height: number } {
  const baseWidth = anchor ? Math.round(anchor.w * 1.5) : 340;
  const width = clampNumber(baseWidth, 240, 380);
  const height = Math.round((width * aspect.h) / aspect.w);
  return { width, height };
}

export default function DrawIOWorkspace({ onBack }: DrawIOWorkspaceProps) {
  const drawioRef = useRef<DrawIoEmbedRef | null>(null);
  const chatPanelRef = useRef<ImperativePanelHandle>(null);
  const exportResolverRef = useRef<((xml: string) => void) | null>(null);
  const pendingLoadXmlRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const diagramMutationQueueRef = useRef<Promise<void>>(Promise.resolve());
  const [isMobile, setIsMobile] = useState(false);
  const [isChatVisible, setIsChatVisible] = useState(true);
  const [drawioUi, setDrawioUi] = useState<'min' | 'sketch'>('min');
  const [darkMode, setDarkMode] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isDrawioReady, setIsDrawioReady] = useState(false);
  const hasLoadedDiagramRef = useRef(false);
  const [messages, setMessages] = useState<DrawIOChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [inFlightCount, setInFlightCount] = useState(0);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [styledMode, setStyledMode] = useState(false);
  const [imageMode, setImageMode] = useState(false);
  const [snapshots, setSnapshots] = useState<XmlSnapshot[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [confirmResetOpen, setConfirmResetOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState<GeminiModelId>(getDefaultModelId());
  const isBusy = inFlightCount > 0;

  useEffect(() => {
    const savedUi = localStorage.getItem(STORAGE_DRAWIO_UI_KEY);
    if (savedUi === 'min' || savedUi === 'sketch') setDrawioUi(savedUi);

    const savedDarkMode = localStorage.getItem(STORAGE_DARK_MODE_KEY);
    if (savedDarkMode !== null) {
      const isDark = savedDarkMode === 'true';
      setDarkMode(isDark);
      document.documentElement.classList.toggle('dark', isDark);
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setDarkMode(prefersDark);
      document.documentElement.classList.toggle('dark', prefersDark);
    }

    const savedStyled = localStorage.getItem(STORAGE_STYLED_KEY);
    if (savedStyled != null) setStyledMode(savedStyled === 'true');

    const savedImageMode = localStorage.getItem(STORAGE_IMAGE_MODE_KEY);
    if (savedImageMode != null) setImageMode(savedImageMode === 'true');

    try {
      const storedMessages = localStorage.getItem(STORAGE_MESSAGES_KEY);
      if (storedMessages) {
        const parsed = JSON.parse(storedMessages) as Array<Partial<DrawIOChatMessage>>;
        if (Array.isArray(parsed)) {
          setMessages(
            parsed
              .filter((msg) => msg && (msg.role === 'user' || msg.role === 'assistant'))
              .map((msg) => ({
                id: msg.id ?? makeMessageId(),
                role: msg.role as 'user' | 'assistant',
                content: String(msg.content ?? ''),
                createdAt: typeof msg.createdAt === 'number' ? msg.createdAt : Date.now(),
                thought: typeof msg.thought === 'string' ? msg.thought : undefined,
                imageDataUrl: typeof msg.imageDataUrl === 'string' ? msg.imageDataUrl : undefined,
                imagePrompt: typeof msg.imagePrompt === 'string' ? msg.imagePrompt : undefined
              }))
          );
        }
      }
    } catch (e) {
      console.warn('Failed to restore draw.io chat messages', e);
    }

    try {
      const storedSnapshots = localStorage.getItem(STORAGE_XML_SNAPSHOTS_KEY);
      if (storedSnapshots) {
        const parsed = JSON.parse(storedSnapshots) as XmlSnapshot[];
        if (Array.isArray(parsed)) setSnapshots(parsed);
      }
    } catch (e) {
      console.warn('Failed to restore draw.io history', e);
    }

    setIsLoaded(true);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const safeMessages = messages.slice(-200).map((msg) => ({
          ...msg,
          // Avoid blowing up localStorage with large data URLs.
          imageDataUrl: msg.imageDataUrl && msg.imageDataUrl.length < 5000 ? msg.imageDataUrl : undefined,
          imageOptions: undefined,
          imagePrompt: msg.imagePrompt,
          workflowSteps: undefined
        }));
        localStorage.setItem(STORAGE_MESSAGES_KEY, JSON.stringify(safeMessages));
      } catch {
        // ignore storage errors
      }
    }, 300);
    return () => clearTimeout(t);
  }, [messages]);

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_XML_SNAPSHOTS_KEY, JSON.stringify(snapshots.slice(-50)));
      } catch {
        // ignore
      }
    }, 300);
    return () => clearTimeout(t);
  }, [snapshots]);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const toggleChatPanel = () => {
    const panel = chatPanelRef.current;
    if (!panel) return;
    if (panel.isCollapsed()) {
      panel.expand();
      setIsChatVisible(true);
    } else {
      panel.collapse();
      setIsChatVisible(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'b') {
        event.preventDefault();
        toggleChatPanel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const saveDiagramToStorage = async () => {
    try {
      const xml = await new Promise<string>((resolve, reject) => {
        const instance = drawioRef.current;
        if (!instance) return resolve('');

        exportResolverRef.current = resolve;
        const timeout = setTimeout(() => {
          exportResolverRef.current = null;
          reject(new Error('Export timeout'));
        }, 2500);

        // Wrap resolver to ensure timeout cleared.
        const originalResolver = exportResolverRef.current;
        exportResolverRef.current = (exportedXml) => {
          clearTimeout(timeout);
          originalResolver?.(exportedXml);
        };

        instance.exportDiagram({ format: 'xmlsvg' });
      });
      if (xml && xml.length > 20) {
        localStorage.setItem(STORAGE_DIAGRAM_XML_KEY, normalizeXmlForDrawio(xml));
      }
    } catch (e) {
      console.warn('Failed to save draw.io diagram before UI change', e);
    }
  };

  const exportCurrentDiagramXml = async (): Promise<string> => {
    const instance = drawioRef.current;
    if (!instance) return '';

    return await new Promise<string>((resolve, reject) => {
      exportResolverRef.current = resolve;
      const timeout = setTimeout(() => {
        exportResolverRef.current = null;
        reject(new Error('Export timeout'));
      }, 6000);

      const original = exportResolverRef.current;
      exportResolverRef.current = (xml) => {
        clearTimeout(timeout);
        original?.(xml);
      };

      instance.exportDiagram({ format: 'xmlsvg' });
    });
  };

  const loadDiagramXml = (xml: string) => {
    const normalized = normalizeXmlForDrawio(xml);
    try {
      localStorage.setItem(STORAGE_DIAGRAM_XML_KEY, normalized);
    } catch {
      // ignore
    }

    if (!drawioRef.current) {
      console.warn('⚠️ drawioRef is null - cannot load diagram');
      pendingLoadXmlRef.current = normalized;
      return;
    }

    try {
      console.log('🔄 Resetting view before loading...');
      // loading empty first forces a clear - sometimes React DrawIO needs a state bump
      drawioRef.current.load({ xml: getEmptyDiagramXml() });

      setTimeout(() => {
        if (!drawioRef.current) return;
        try {
          console.log('🚀 Loading XML into draw.io embed...', normalized.substring(0, 50));
          drawioRef.current.load({ xml: normalized });
          console.log('✅ load() called successfully');
        } catch (e) {
          console.error('❌ Failed to load diagram into draw.io (delayed)', e);
        }
      }, 50);

    } catch (e) {
      console.error('❌ Failed to load diagram into draw.io', e);
    }
  };

  const handleDarkModeChange = async () => {
    await saveDiagramToStorage();
    const next = !darkMode;
    setDarkMode(next);
    localStorage.setItem(STORAGE_DARK_MODE_KEY, String(next));
    document.documentElement.classList.toggle('dark', next);
    setIsDrawioReady(false);
    hasLoadedDiagramRef.current = false;
  };

  const handleDrawioUiChange = async () => {
    await saveDiagramToStorage();
    const next = drawioUi === 'min' ? 'sketch' : 'min';
    localStorage.setItem(STORAGE_DRAWIO_UI_KEY, next);
    setDrawioUi(next);
    setIsDrawioReady(false);
    hasLoadedDiagramRef.current = false;
  };

  const onDrawioLoad = () => {
    setIsDrawioReady(true);
  };

  const onDrawioExport = (data: any) => {
    const resolver = exportResolverRef.current;
    if (!resolver) return;
    exportResolverRef.current = null;

    const raw = String(data?.data ?? '');
    const extracted = raw ? extractDiagramXmlFromXmlSvg(raw) : null;
    resolver(normalizeXmlForDrawio(extracted ?? ''));
  };

  useEffect(() => {
    if (!isDrawioReady) return;
    if (hasLoadedDiagramRef.current) return;
    hasLoadedDiagramRef.current = true;

    const savedXml = localStorage.getItem(STORAGE_DIAGRAM_XML_KEY);
    if (savedXml && drawioRef.current) {
      try {
        drawioRef.current.load({ xml: normalizeXmlForDrawio(savedXml) });
      } catch (e) {
        console.warn('Failed to restore draw.io diagram from storage', e);
      }
    }

    if (pendingLoadXmlRef.current && drawioRef.current) {
      try {
        drawioRef.current.load({ xml: pendingLoadXmlRef.current });
        pendingLoadXmlRef.current = null;
      } catch (e) {
        console.warn('Failed to load pending diagram', e);
      }
    }
  }, [isDrawioReady]);

  const quickExamples = useMemo(
    () => [
      {
        id: 'paper',
        title: 'Paper to Diagram',
        badge: 'NEW',
        description: 'Upload .pdf, .txt, .md, .json, .csv, .py, .js, .ts and more',
        icon: FileText,
        action: () => {
          setInput('Create a clear diagram that summarizes the uploaded document.');
          fileInputRef.current?.click();
        }
      },
      {
        id: 'animated',
        title: 'Animated Diagram',
        description: 'Draw a transformer architecture with animated connectors',
        icon: Sparkles,
        action: () => {
          setInput('Draw a transformer architecture diagram with animated connectors.');
        }
      },
      {
        id: 'aws',
        title: 'AWS Architecture',
        description: 'Create a cloud architecture diagram with AWS icons',
        icon: Cloud,
        action: () => {
          setInput('Create an AWS cloud architecture diagram for a web app (ALB -> compute -> database) with clear boundaries.');
        }
      },
      {
        id: 'replicate',
        title: 'Replicate Flowchart',
        description: 'Upload and replicate an existing flowchart',
        icon: ImageIcon,
        action: () => {
          setInput('Replicate this flowchart as a draw.io diagram. Keep layout and labels.');
          fileInputRef.current?.click();
        }
      },
      {
        id: 'imagen',
        title: 'Generate Image',
        description: 'Generate an image (Imagen 4) and place it on the canvas',
        icon: ImageIcon,
        action: () => {
          setImageMode(true);
          localStorage.setItem(STORAGE_IMAGE_MODE_KEY, 'true');
          setInput('Generate academic-style scientific illustration images for each step (no text in images).');
        }
      },
      {
        id: 'creative',
        title: 'Creative Drawing',
        description: 'Draw something fun and creative',
        icon: Sparkles,
        action: () => {
          setInput('Create a fun, creative doodle-style diagram with a title and a few playful elements.');
        }
      }
    ],
    []
  );

  const handleFilesSelected = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setAttachedFiles((prev) => [...prev, ...Array.from(files)].slice(0, 8));
  };

  const removeFile = (index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const buildDiagramPrompt = (params: { userPrompt: string; currentXml: string; documentText?: string; styled: boolean }) => {
    const styleSpec = params.styled
      ? `
VISUAL STYLE (Styled Mode):
- Use a modern, professional look with rounded rectangles (rounded=1;arcSize=20)
- Apply subtle shadows (shadow=1) to main elements
- Use a consistent color palette:
  • Primary containers: fillColor=#E1F5FE;strokeColor=#01579B (blue)
  • Secondary elements: fillColor=#FFF3E0;strokeColor=#E65100 (orange)
  • Success/positive: fillColor=#E8F5E9;strokeColor=#2E7D32 (green)
  • Warning/caution: fillColor=#FFF8E1;strokeColor=#F9A825 (yellow)
  • Neutral: fillColor=#FAFAFA;strokeColor=#616161 (grey)
- Use readable typography (fontSize=12 for labels, fontSize=14 for headers)
- Add gentle gradients for important containers (gradient=1;gradientColor=#FFFFFF)`
      : `
VISUAL STYLE (Minimal Mode):
- Keep it clean and simple with basic shapes
- Use light colors: fillColor=#FFFFFF;strokeColor=#333333
- Minimal styling, no shadows or gradients
- fontSize=11 for consistent readability`;

    return `You are an expert draw.io diagram generator that creates professional, publication-quality diagrams.

═══════════════════════════════════════════════════════════════════
CRITICAL OUTPUT REQUIREMENTS
═══════════════════════════════════════════════════════════════════
1. Output ONLY valid draw.io XML - no markdown, no explanations, no comments
2. Return a single <mxfile>...</mxfile> document
3. Use UNCOMPRESSED mxGraphModel (no base64-encoded diagram content)
4. Always include: <mxCell id="0"/> and <mxCell id="1" parent="0"/> in root
5. Every cell needs a unique numeric id (starting from 2)

═══════════════════════════════════════════════════════════════════
DIAGRAM BEST PRACTICES
═══════════════════════════════════════════════════════════════════

LAYOUT GUIDELINES:
- Use a logical flow direction (top-to-bottom, left-to-right)
- Maintain consistent spacing between elements (minimum 40px)
- Align elements on a grid (x and y divisible by 20)
- Group related elements visually with whitespace
- Keep the diagram balanced and centered
- Standard shape sizes: width=120-160, height=60-80 for boxes

SHAPE SELECTION BY DIAGRAM TYPE:
• Flowcharts: rounded rectangles, diamonds for decisions, ovals for start/end
• Process diagrams: rectangles with icons, arrows showing flow
• Architecture: layered containers, dashed boundaries for systems
• Mind maps: central node with branching hierarchy
• Org charts: rectangles with swimlanes
• Data flow: cylinders for databases, parallelograms for I/O
• Network: cloud shapes, server icons, device symbols

CONNECTION BEST PRACTICES:
- Use edgeStyle=orthogonalEdgeStyle for clean right-angle connectors
- Add jettySize=auto for proper connector spacing
- Use endArrow=classic or endArrow=block for clear direction
- Add labels to edges when they represent actions/transitions
- Avoid overlapping connectors

HIERARCHY & GROUPING:
- Use swimlanes (shape=swimlane) for categorization
- Use groups (container shapes with child cells) for related items
- Add clear titles to containers
- Consider collapsible sections for complex diagrams
${styleSpec}

═══════════════════════════════════════════════════════════════════
TASK
═══════════════════════════════════════════════════════════════════
${params.currentXml && params.currentXml.includes('<mxCell')
        ? 'EDIT MODE: Modify the existing diagram below based on the user request. Preserve existing structure where appropriate and return the COMPLETE updated diagram.'
        : 'CREATE MODE: Generate a new diagram from scratch based on the user request.'}

USER REQUEST:
${params.userPrompt}
${params.documentText ? `
SOURCE DOCUMENT CONTENT:
${params.documentText}
` : ''}
${params.currentXml && params.currentXml.includes('<mxCell') ? `
CURRENT DIAGRAM XML:
${params.currentXml}` : ''}

Generate a professional, well-structured diagram now:`;
  };

  const buildGroqPrompt = (basePrompt: string) => {
    return `${basePrompt}

═══════════════════════════════════════════════════════════════════
QWEN/GROQ SPECIFIC INSTRUCTIONS
═══════════════════════════════════════════════════════════════════
You are Qwen, a highly intelligent reasoning model. You MUST follow these strict XML syntax rules:

1. **Thinking Process**: Start with a <think>...</think> block to plan the diagram structure, layout, and connections.
2. **Tag correctness**: 
   - NEVER use <Geometry>. You MUST use <mxGeometry> with x, y, width, height, as="geometry".
   - NEVER use <Point>. You MUST use <mxPoint>.
   - NEVER use <Array>. You MUST use <Array as="points">.
3. **Parent Attribute**: Every <mxCell> (except the two roots) MUST have parent="1".
   - INCORRECT: <mxCell id="2" value="..." ...>
   - CORRECT:   <mxCell id="2" parent="1" value="..." ...>
4. **View Offsets**: Ensure <mxGraphModel> has dx="0" dy="0" and pageScale="1".
5. **Output Format**: 
   - Output the <think> block first.
   - Immediately follow with the raw XML string starting with <mxfile>.
   - Do NOT wrap the XML in markdown (\`\`\`xml ... \`\`\`).
   - Do NOT add any concluding text.

Generate the diagram now.`;
  };

  const queueDiagramMutation = async <T,>(fn: () => Promise<T>): Promise<T> => {
    const next = diagramMutationQueueRef.current.then(fn);
    diagramMutationQueueRef.current = next.then(
      () => undefined,
      () => undefined
    );
    return next;
  };

  const insertImageFromChat = async (dataUri: string, label: string, diagramXmlForAnchoring?: string) => {
    return queueDiagramMutation(async () => {
      try {
        const baseXml = (await exportCurrentDiagramXml().catch(() => '')) || '';
        const anchorXml = diagramXmlForAnchoring || baseXml;
        const anchorCell = findAnchorCellForStep({ mxfileXml: anchorXml, stepTitle: label });
        const size = computeSmartImageSize(anchorCell, { w: 4, h: 3 });
        const placement = computeSmartImagePlacement({
          mxfileXml: baseXml,
          stepTitle: label,
          width: size.width,
          height: size.height
        });
        const updatedXml = insertImageIntoMxfile({
          mxfileXml: baseXml || getEmptyDiagramXml(),
          imageDataUrl: dataUri,
          position: placement.position,
          size,
          linkFromCellId: placement.linkFromCellId
        });
        loadDiagramXml(updatedXml);
        setSnapshots((prev) => [...prev, { createdAt: Date.now(), prompt: `Image: ${label}`, xml: updatedXml }].slice(-25));
      } catch (e) {
        console.warn('Failed to insert image into diagram', e);
      }
    });
  };

  const generateWorkflowSteps = async (prompt: string, diagramXml: string): Promise<Array<Omit<WorkflowStep, 'status'>>> => {
    const labels = extractDiagramLabels(diagramXml);
    const guidance = labels.length
      ? `Existing diagram labels (use these for step names when relevant):\n- ${labels.slice(0, 40).join('\n- ')}\n`
      : '';

    const instruction = `Return ONLY JSON.\n\nTask: Break the user's workflow into 3-7 sequential steps.\nFor each step, output:\n- id (short slug)\n- title (very short)\n- description (1 sentence)\n- imagePrompt (a detailed prompt for an academic scientific illustration of ONLY that step)\n\nJSON format:\n{\"steps\":[{\"id\":\"...\",\"title\":\"...\",\"description\":\"...\",\"imagePrompt\":\"...\"}]}\n\nImage style requirements (IMPORTANT):\n${ACADEMIC_IMAGE_STYLE_PREFIX}\n\nConstraints:\n- Each image must focus on a single step (not the full process).\n- Keep consistent academic style across steps.\n\n${guidance}\nUSER_WORKFLOW:\n${prompt}`;

    const text = await streamTextContent(instruction, () => { }, { model: 'gemini-3-pro-preview', thinking: 'low', timeout: 120000 });
    const parsed = safeParseJsonObject(text);
    const steps = Array.isArray(parsed?.steps) ? parsed.steps : [];
    return steps
      .filter((s: any) => s && typeof s.title === 'string' && typeof s.imagePrompt === 'string')
      .slice(0, 7)
      .map((s: any, idx: number) => ({
        id: typeof s.id === 'string' && s.id.trim() ? s.id.trim() : `step-${idx + 1}`,
        title: String(s.title).trim().slice(0, 64),
        description: String(s.description ?? '').trim().slice(0, 160),
        imagePrompt: String(s.imagePrompt).trim()
      }));
  };

  const updateAssistantMessage = (assistantId: string, updater: (msg: DrawIOChatMessage) => DrawIOChatMessage) => {
    setMessages((prev) => prev.map((msg) => (msg.id === assistantId ? updater(msg) : msg)));
  };

  const updateWorkflowStep = (params: {
    assistantId: string;
    stepId: string;
    prefix: string;
    patch: Partial<WorkflowStep>;
    alsoSetPreviewImage?: string;
  }) => {
    updateAssistantMessage(params.assistantId, (msg) => {
      const current = (msg.workflowSteps || []) as WorkflowStep[];
      const updatedSteps = current.map((s) => (s.id === params.stepId ? { ...s, ...params.patch } : s));
      const total = updatedSteps.length;
      const done = countWorkflowDone(updatedSteps);
      return {
        ...msg,
        content: total ? `${params.prefix} (${done}/${total})` : msg.content,
        workflowSteps: updatedSteps,
        imageDataUrl: params.alsoSetPreviewImage ?? msg.imageDataUrl
      };
    });
  };

  const generate2kImageForStep = async (step: WorkflowStep): Promise<string> => {
    const academicPrompt = `${ACADEMIC_IMAGE_STYLE_PREFIX}\n\nStep to illustrate:\n${step.imagePrompt}`;

    const results = await generateImagen4Images(academicPrompt, {
      numberOfImages: 1,
      aspectRatio: AspectRatio.LANDSCAPE_4_3,
      imageSize: ImageSize.K2,
      outputMimeType: 'image/jpeg',
      outputCompressionQuality: 85,
      personGeneration: 'allow_adult'
    });

    if (!results.length) throw new Error('No image returned');

    return wrapImageAsAnimatedSvgDataUri({
      mimeType: results[0].mimeType,
      imageBase64: results[0].imageBytesBase64
    });
  };

  const handleSend = async () => {
    if (inFlightCount >= MAX_ACTIVE_REQUESTS) return;

    const inputSnapshot = input;
    const filesSnapshot = attachedFiles.slice();
    const trimmed = inputSnapshot.trim();
    if (!trimmed && filesSnapshot.length === 0) return;

    const imagePrompt = getImagePromptFromInput(inputSnapshot);
    const explicitImageOnly = Boolean(imagePrompt) && filesSnapshot.length === 0;

    setInFlightCount((c) => c + 1);
    const userMessage = trimmed || (filesSnapshot.length ? `Create a diagram from ${filesSnapshot.length} uploaded file(s).` : '');
    const userMessageId = makeMessageId();
    const assistantMessageId = makeMessageId();
    setMessages((prev) => [
      ...prev,
      { id: userMessageId, role: 'user', content: userMessage, createdAt: Date.now() },
      {
        id: assistantMessageId,
        role: 'assistant',
        content: explicitImageOnly ? 'Generating step images...' : 'Thinking...',
        createdAt: Date.now(),
        thought: explicitImageOnly ? undefined : ''
      }
    ]);
    setInput('');
    setAttachedFiles([]);

    try {
      if (explicitImageOnly) {
        const prompt = (imagePrompt || userMessage).replace(/\bGenerate\s+Image\b/gi, '').trim() || userMessage;
        const currentXml = await exportCurrentDiagramXml().catch(() => '');
        const stepsBase = await generateWorkflowSteps(prompt, currentXml || '');
        const steps: WorkflowStep[] = stepsBase.map((s) => ({ ...s, status: 'queued' }));

        updateAssistantMessage(assistantMessageId, (msg) => ({
          ...msg,
          content: `Generating 2K images for ${steps.length} steps... (0/${steps.length})`,
          imagePrompt: prompt,
          workflowSteps: steps
        }));

        await runWithConcurrency(steps, WORKFLOW_IMAGE_CONCURRENCY, async (step) => {
          updateWorkflowStep({
            assistantId: assistantMessageId,
            stepId: step.id,
            prefix: `Generating 2K images for ${steps.length} steps...`,
            patch: { status: 'generating', error: undefined }
          });

          try {
            const img = await generate2kImageForStep(step);
            updateWorkflowStep({
              assistantId: assistantMessageId,
              stepId: step.id,
              prefix: `Generating 2K images for ${steps.length} steps...`,
              patch: { status: 'ready', imageDataUrl: img },
              alsoSetPreviewImage: img
            });

            if (imageMode) {
              await insertImageFromChat(img, step.title, currentXml || '');
            }
          } catch (e: any) {
            updateWorkflowStep({
              assistantId: assistantMessageId,
              stepId: step.id,
              prefix: `Generating 2K images for ${steps.length} steps...`,
              patch: { status: 'error', error: String(e?.message || e || 'failed') }
            });
          }
        });

        updateAssistantMessage(assistantMessageId, (msg) => ({
          ...msg,
          content: imageMode ? 'Inserted step images into the canvas.' : 'Step images are ready. Click any step to insert.'
        }));
        return;
      }

      const currentXml = await exportCurrentDiagramXml().catch(() => '');
      const normalizedCurrentXml = normalizeXmlForDrawio(currentXml);

      const hasImage = filesSnapshot.some((f) => isImageFile(f));
      const nonImageFiles = filesSnapshot.filter((f) => !isImageFile(f));

      let documentText = '';
      if (nonImageFiles.length > 0) {
        const pieces: string[] = [];
        for (const file of nonImageFiles) {
          try {
            const extracted = await extractTextFromDocument(file);
            const snippet = (extracted.text || '').slice(0, 12000);
            pieces.push(`[${formatFileHint(file)}: ${file.name}]\\n${snippet}`);
          } catch {
            pieces.push(`[File: ${file.name}] (failed to extract text)`);
          }
        }
        documentText = pieces.join('\\n\\n');
      }

      const prompt = buildDiagramPrompt({
        userPrompt: userMessage,
        currentXml: normalizedCurrentXml,
        documentText,
        styled: styledMode
      });

      const imageFile = hasImage ? filesSnapshot.find((f) => isImageFile(f))! : null;
      const inlineData = imageFile
        ? { mimeType: imageFile.type || 'image/png', data: await fileToBase64(imageFile) }
        : undefined;

      let collectedThought = '';
      const onThought = (thoughtChunk: string) => {
        if (!thoughtChunk) return;
        collectedThought = (collectedThought + thoughtChunk).slice(-20000);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? { ...msg, thought: collectedThought }
              : msg
          )
        );
      };

      let modelOutput = '';

      if (getModelProvider(selectedModel) === 'groq') {
        const basePrompt = buildDiagramPrompt({
          userPrompt: userMessage,
          currentXml: currentXml || '',
          documentText,
          styled: styledMode
        });

        const groqPrompt = buildGroqPrompt(basePrompt);

        let isThinking = false;

        modelOutput = await streamGroqContent(
          groqPrompt,
          (chunk) => {
            // Basic parsing for streaming thoughts (robustness can be improved)
            if (chunk.includes('<think>')) {
              isThinking = true;
              const parts = chunk.split('<think>');
              if (parts[1]) onThought(parts[1]);
            } else if (chunk.includes('</think>')) {
              isThinking = false;
              const parts = chunk.split('</think>');
              if (parts[0]) onThought(parts[0]);
            } else if (isThinking) {
              onThought(chunk);
            }
          },
          {
            model: selectedModel.replace('groq/', ''), // Remove prefix for API
            temperature: 0.6,
            maxTokens: 40960,
            reasoningEffort: 'default',
            reasoningFormat: 'raw'
          }
        );

        console.log('--- Raw Groq Output ---');
        console.log(modelOutput);

        // Strip thinking tags from final output for XML parsing
        modelOutput = modelOutput.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

        console.log('--- Stripped Groq Output ---');
        console.log(modelOutput);
      } else {
        // Standard Gemini path
        // We only need the final text to parse XML, but we still stream to capture thought parts.
        modelOutput = await streamTextContent(
          prompt,
          () => { },
          {
            model: selectedModel,
            thinking: selectedModel.startsWith('gemini-3') ? 'high' : true,
            onThought,
            inlineData,
            timeout: 240000
          }
        );
      }

      const xml = extractMxfileFromModelOutput(modelOutput);
      if (!xml) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessageId
              ? {
                ...msg,
                content: 'I could not produce valid draw.io XML. Try rephrasing the request or uploading a clearer file/image.'
              }
              : msg
          )
        );
        return;
      }

      loadDiagramXml(xml);
      setSnapshots((prev) => [...prev, { createdAt: Date.now(), prompt: userMessage, xml }].slice(-50));
      updateAssistantMessage(assistantMessageId, (msg) => ({ ...msg, content: 'Updated the diagram in the editor.' }));

      if (imageMode) {
        const stepsBase = await generateWorkflowSteps(userMessage, xml);
        const steps: WorkflowStep[] = stepsBase.map((s) => ({ ...s, status: 'queued' }));

        updateAssistantMessage(assistantMessageId, (msg) => ({
          ...msg,
          content: `Updated the diagram. Generating 2K step images... (0/${steps.length})`,
          workflowSteps: steps
        }));

        await runWithConcurrency(steps, WORKFLOW_IMAGE_CONCURRENCY, async (step) => {
          updateWorkflowStep({
            assistantId: assistantMessageId,
            stepId: step.id,
            prefix: `Updated the diagram. Generating 2K step images...`,
            patch: { status: 'generating', error: undefined }
          });

          try {
            const img = await generate2kImageForStep(step);
            updateWorkflowStep({
              assistantId: assistantMessageId,
              stepId: step.id,
              prefix: `Updated the diagram. Generating 2K step images...`,
              patch: { status: 'ready', imageDataUrl: img },
              alsoSetPreviewImage: img
            });

            await insertImageFromChat(img, step.title, xml);
          } catch (e: any) {
            updateWorkflowStep({
              assistantId: assistantMessageId,
              stepId: step.id,
              prefix: `Updated the diagram. Generating 2K step images...`,
              patch: { status: 'error', error: String(e?.message || e || 'failed') }
            });
          }
        });

        updateAssistantMessage(assistantMessageId, (msg) => ({
          ...msg,
          content: 'Updated the diagram and inserted step images into the canvas.'
        }));
      }
    } catch (e: any) {
      console.error('Draw.io AI generation failed', e);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMessageId
            ? {
              ...msg,
              content: `Sorry, something went wrong while generating the diagram. ${e?.message ? `(${e.message})` : ''}`
            }
            : msg
        )
      );
    } finally {
      setInFlightCount((c) => Math.max(0, c - 1));
    }
  };

  const handleDownload = async () => {
    try {
      const xml = await exportCurrentDiagramXml();
      const normalized = normalizeXmlForDrawio(xml);
      const blob = new Blob([normalized], { type: 'application/xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'diagram.drawio';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.warn('Failed to download diagram', e);
    }
  };

  const handleReset = () => {
    setMessages([]);
    setSnapshots([]);
    setAttachedFiles([]);
    setInput('');
    loadDiagramXml(getEmptyDiagramXml());
    try {
      localStorage.removeItem(STORAGE_MESSAGES_KEY);
      localStorage.removeItem(STORAGE_XML_SNAPSHOTS_KEY);
    } catch {
      // ignore
    }
  };

  const restoreSnapshot = (snapshot: XmlSnapshot) => {
    loadDiagramXml(snapshot.xml);
    setHistoryOpen(false);
  };

  return (
    <div className="flex flex-1 w-full h-full bg-background relative overflow-hidden">
      <ResizablePanelGroup
        id="drawio-workspace"
        key={isMobile ? 'mobile' : 'desktop'}
        direction={isMobile ? 'vertical' : 'horizontal'}
        className="h-full min-h-0"
      >
        <ResizablePanel id="drawio-panel" defaultSize={isMobile ? 55 : 67} minSize={20}>
          <div className={`h-full min-h-0 relative ${isMobile ? 'p-1' : 'p-2'}`}>
            <div className="h-full min-h-0 rounded-xl overflow-hidden shadow-lg border border-border/30 bg-background flex flex-col">
              <div className="h-12 flex items-center justify-between px-3 border-b border-border/40 bg-background/90">
                <div className="flex items-center gap-2">
                  <button
                    onClick={onBack}
                    className="inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-foreground hover:bg-muted transition-colors"
                    title="Back to Mind Map"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Back
                  </button>
                  <div className="h-5 w-px bg-border" />
                  <span className="text-sm font-semibold text-foreground">Draw.io Workspace</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleDrawioUiChange}
                    className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm text-foreground hover:bg-muted transition-colors"
                    title="Toggle Draw.io UI (min/sketch)"
                  >
                    <Palette className="w-4 h-4" />
                    {drawioUi === 'min' ? 'Min' : 'Sketch'}
                  </button>
                  <button
                    onClick={handleDarkModeChange}
                    className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm text-foreground hover:bg-muted transition-colors"
                    title="Toggle dark mode"
                  >
                    {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                    {darkMode ? 'Light' : 'Dark'}
                  </button>
                </div>
              </div>

              <div className="flex-1 min-h-0">
                {isLoaded ? (
                  <DrawIoEmbed
                    key={`${drawioUi}-${darkMode}`}
                    ref={drawioRef}
                    onExport={onDrawioExport}
                    onLoad={onDrawioLoad}
                    baseUrl={DRAWIO_BASE_URL}
                    urlParameters={{
                      ui: drawioUi,
                      spin: true,
                      libraries: false,
                      saveAndExit: false,
                      noExitBtn: true,
                      dark: darkMode
                    }}
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center bg-background">
                    <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
                  </div>
                )}
              </div>
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel
          id="chat-panel"
          ref={chatPanelRef}
          defaultSize={isMobile ? 45 : 33}
          minSize={isMobile ? 20 : 15}
          maxSize={isMobile ? 80 : 50}
          collapsible={!isMobile}
          collapsedSize={isMobile ? 0 : 3}
          onCollapse={() => setIsChatVisible(false)}
          onExpand={() => setIsChatVisible(true)}
        >
          <div className={`h-full min-h-0 ${isMobile ? 'p-1' : 'py-2.5 pr-2.5'}`}>
            <div className="h-full min-h-0 rounded-xl overflow-hidden border border-slate-700/50 shadow-2xl bg-[#171717] flex flex-col backdrop-blur-sm">
              <div className="h-12 border-b border-slate-700/50 flex items-center justify-between px-5 bg-[#1a1a1a] backdrop-blur-sm">
                <div className="flex items-center gap-2.5">
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                  <span className="text-sm font-semibold text-slate-100 tracking-tight">AI Assistant</span>
                </div>
                {!isMobile ? (
                  <button
                    onClick={toggleChatPanel}
                    className="inline-flex items-center justify-center rounded-lg px-2 py-1.5 text-slate-400 hover:bg-slate-700/50 hover:text-slate-100 transition-all duration-200"
                    title="Toggle chat panel (Ctrl/Cmd+B)"
                  >
                    {isChatVisible ? (
                      <PanelRightClose className="w-4 h-4" />
                    ) : (
                      <PanelRightOpen className="w-4 h-4" />
                    )}
                  </button>
                ) : null}
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto bg-[#171717] scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
                {messages.length === 0 ? (
                  <div className="px-5 py-7 space-y-5">
                    {/* Welcome Section */}
                    <div className="text-center space-y-1.5 pt-1 pb-1">
                      <h3 className="text-lg font-bold text-slate-100 tracking-tight">Create diagrams with AI</h3>
                      <p className="text-sm text-slate-400 leading-relaxed max-w-sm mx-auto px-2">
                        Describe what you want to create or upload an image to replicate
                      </p>
                    </div>

                    {/* Quick Examples Section */}
                    <div className="space-y-3.5">
                      <div className="flex items-center gap-2.5 px-1">
                        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-700/60 to-transparent" />
                        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider px-1">Quick Examples</p>
                        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-700/60 to-transparent" />
                      </div>
                      
                      <div className="grid gap-2">
                        {quickExamples.map((example) => {
                          const Icon = example.icon;
                          return (
                            <button
                              key={example.id}
                              type="button"
                              onClick={example.action}
                              className="group w-full text-left relative overflow-hidden rounded-lg border border-slate-700/50 bg-[#1f1f1f] hover:bg-[#252525] hover:border-primary/40 hover:shadow-md hover:shadow-primary/5 transition-all duration-200 px-3.5 py-3"
                            >
                              <div className="absolute inset-0 bg-gradient-to-r from-primary/0 via-primary/5 to-primary/0 opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                              <div className="relative flex items-start gap-3">
                                <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-slate-700/50 to-slate-800/50 border border-slate-600/30 flex items-center justify-center group-hover:border-primary/30 group-hover:bg-primary/10 transition-all duration-200 flex-shrink-0 mt-0.5">
                                  <Icon className="h-4 w-4 text-slate-300 group-hover:text-primary transition-colors duration-200" />
                                </div>
                                <div className="flex-1 min-w-0 pt-0.5">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-sm font-semibold text-slate-100 group-hover:text-primary transition-colors duration-200 leading-tight">{example.title}</span>
                                    {(example as any).badge ? (
                                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md bg-primary/15 text-primary border border-primary/25 whitespace-nowrap">
                                        {(example as any).badge}
                                      </span>
                                    ) : null}
                                  </div>
                                  <p className="text-xs text-slate-400 leading-relaxed group-hover:text-slate-300 transition-colors duration-200">{example.description}</p>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                      
                      <div className="pt-1.5">
                        <p className="text-[10px] text-slate-500 text-center font-medium leading-tight">
                          Examples are cached for instant response
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="px-4 py-4 space-y-3">
                    {messages.map((msg, idx) => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[85%] rounded-lg px-3.5 py-2.5 ${msg.role === 'user'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-[#1f1f1f] text-slate-100 border border-slate-700/50'
                            }`}
                        >
                          <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                          {msg.role === 'assistant' && msg.imageDataUrl ? (
                            <img
                              src={msg.imageDataUrl}
                              alt="Generated"
                              className="mt-2 max-w-full rounded-md border border-border/50 bg-background"
                              loading="lazy"
                            />
                          ) : null}
                          {msg.role === 'assistant' && msg.workflowSteps && msg.workflowSteps.length ? (
                            <div className="mt-3 space-y-2">
                              {msg.workflowSteps.map((step) => (
                                <div key={step.id} className="rounded-lg border border-border/50 bg-background/40 p-3">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2">
                                        <div className="text-sm font-semibold text-foreground truncate">{step.title}</div>
                                        <div className="text-[10px] rounded-full px-2 py-0.5 border border-border/60 text-muted-foreground">
                                          {step.status}
                                        </div>
                                      </div>
                                      {step.description ? (
                                        <div className="text-xs text-muted-foreground mt-1">{step.description}</div>
                                      ) : null}
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <button
                                        type="button"
                                        className="text-xs rounded-md px-2 py-1 border border-border hover:bg-muted disabled:opacity-50"
                                        disabled={!step.imageDataUrl}
                                        onClick={() => {
                                          if (!step.imageDataUrl) return;
                                          insertImageFromChat(step.imageDataUrl, step.title);
                                        }}
                                      >
                                        Insert
                                      </button>
                                      <button
                                        type="button"
                                        className="text-xs rounded-md px-2 py-1 border border-border hover:bg-muted"
                                        onClick={async () => {
                                          updateAssistantMessage(msg.id, (m) => ({
                                            ...m,
                                            workflowSteps: (m.workflowSteps || []).map((s) =>
                                              s.id === step.id ? { ...s, status: 'generating', error: undefined } : s
                                            )
                                          }));
                                          try {
                                            const newImg = await generate2kImageForStep(step);
                                            updateAssistantMessage(msg.id, (m) => ({
                                              ...m,
                                              workflowSteps: (m.workflowSteps || []).map((s) =>
                                                s.id === step.id ? { ...s, status: 'ready', imageDataUrl: newImg } : s
                                              ),
                                              imageDataUrl: newImg
                                            }));
                                          } catch (e: any) {
                                            updateAssistantMessage(msg.id, (m) => ({
                                              ...m,
                                              workflowSteps: (m.workflowSteps || []).map((s) =>
                                                s.id === step.id ? { ...s, status: 'error', error: String(e?.message || e || 'failed') } : s
                                              )
                                            }));
                                          }
                                        }}
                                      >
                                        Regenerate
                                      </button>
                                    </div>
                                  </div>
                                  {step.imageDataUrl ? (
                                    <button
                                      type="button"
                                      onClick={() => insertImageFromChat(step.imageDataUrl!, step.title)}
                                      className="mt-2 block w-full rounded-md overflow-hidden border border-border/50 hover:border-primary/40 transition-colors"
                                      title="Insert into canvas"
                                    >
                                      <img src={step.imageDataUrl} alt={step.title} className="block w-full h-auto" loading="lazy" />
                                    </button>
                                  ) : step.status === 'error' ? (
                                    <div className="mt-2 text-xs text-destructive">{step.error || 'Failed to generate image'}</div>
                                  ) : step.status === 'generating' ? (
                                    <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                      Generating...
                                    </div>
                                  ) : null}
                                </div>
                              ))}
                            </div>
                          ) : null}
                          {msg.role === 'assistant' && msg.imageOptions && msg.imageOptions.length > 1 ? (
                            <div className="mt-2 grid grid-cols-2 gap-2">
                              {msg.imageOptions.slice(0, 4).map((opt, i) => (
                                <button
                                  key={`${msg.id}-img-${i}`}
                                  type="button"
                                  onClick={() => insertImageFromChat(opt, msg.imagePrompt || 'Generated image')}
                                  className="rounded-md overflow-hidden border border-border/50 hover:border-primary/40 transition-colors bg-background"
                                  title="Insert this image into the canvas"
                                >
                                  <img src={opt} alt={`Option ${i + 1}`} className="block w-full h-auto" loading="lazy" />
                                </button>
                              ))}
                            </div>
                          ) : null}
                          {msg.role === 'assistant' && msg.thought ? (
                            <details className="mt-2 rounded-md border border-border/50 bg-background/40">
                              <summary className="cursor-pointer select-none px-3 py-2 text-xs font-semibold text-muted-foreground">
                                Thinking
                              </summary>
                              <pre className="max-h-56 overflow-auto px-3 pb-3 text-xs whitespace-pre-wrap text-muted-foreground">
                                {msg.thought}
                              </pre>
                            </details>
                          ) : null}
                        </div>
                      </div>
                    ))}
                    {isBusy ? (
                      <div className="flex justify-start">
                        <div className="bg-muted rounded-lg px-4 py-2">
                          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>

              <footer className="px-4 py-3.5 border-t border-slate-700/50 bg-[#1a1a1a] backdrop-blur-sm">
                <form
                  className="w-full"
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSend();
                  }}
                >
                  <div className="relative rounded-xl border border-slate-700/50 bg-[#1f1f1f] shadow-sm focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/50 transition-all">
                    {attachedFiles.length ? (
                      <div className="px-3 pt-2.5 pb-2 flex flex-wrap gap-1.5">
                        {attachedFiles.map((file, idx) => (
                          <button
                            key={`${file.name}-${idx}`}
                            type="button"
                            onClick={() => removeFile(idx)}
                            className="inline-flex items-center gap-1.5 rounded-full border border-slate-600/50 bg-slate-700/50 px-2.5 py-1 text-xs text-slate-200 hover:bg-slate-700/70 transition-colors"
                            title="Remove file"
                          >
                            <span className="max-w-[180px] truncate">{file.name}</span>
                            <span className="text-[10px] text-slate-400">{formatFileHint(file)}</span>
                            <span className="text-slate-400 hover:text-slate-200">×</span>
                          </button>
                        ))}
                      </div>
                    ) : null}

                    <textarea
                      className="w-full min-h-[56px] max-h-[200px] resize-none border-0 bg-[#212121] px-4 py-3 text-sm text-slate-100 outline-none placeholder:text-slate-500/70"
                      placeholder="Describe your diagram or upload a file..."
                      aria-label="Chat input"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                      rows={2}
                    />

                    <div className="flex items-center justify-between px-3 py-2.5 border-t border-slate-700/50">
                      <div className="flex items-center gap-1.5">
                        {/* Model Selector */}
                        <ModelSelector
                          selectedModel={selectedModel}
                          onModelChange={setSelectedModel}
                          disabled={isBusy}
                          compact={true}
                        />

                        <div className="w-px h-6 bg-slate-700/50 mx-0.5" />

                        <button
                          type="button"
                          className="inline-flex items-center justify-center h-7 w-7 rounded-md text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200"
                          title="New chat / clear"
                          onClick={() => setConfirmResetOpen(true)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>

                        <button
                          type="button"
                          role="switch"
                          aria-checked={styledMode}
                          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 transition-all duration-200"
                          onClick={() => {
                            const next = !styledMode;
                            setStyledMode(next);
                            localStorage.setItem(STORAGE_STYLED_KEY, String(next));
                          }}
                        >
                          <span
                            className={`inline-flex h-[1.1rem] w-7 items-center rounded-full border transition-all duration-200 ${styledMode 
                              ? 'bg-primary border-primary/50 shadow-sm shadow-primary/20' 
                              : 'bg-slate-700/60 border-slate-600/50'
                            }`}
                          >
                            <span
                              className={`h-3 w-3 rounded-full transition-all duration-200 ${styledMode 
                                ? 'bg-white translate-x-[calc(100%+2px)] shadow-sm' 
                                : 'bg-slate-500 translate-x-0.5'
                              }`}
                            />
                          </span>
                          <span className="font-medium">Styled</span>
                        </button>

                        <button
                          type="button"
                          role="switch"
                          aria-checked={imageMode}
                          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-700/50 transition-all duration-200"
                          onClick={() => {
                            const next = !imageMode;
                            setImageMode(next);
                            localStorage.setItem(STORAGE_IMAGE_MODE_KEY, String(next));
                          }}
                          title="When enabled, Send generates images (Imagen 4) and inserts them into the canvas"
                        >
                          <span
                            className={`inline-flex h-[1.1rem] w-7 items-center rounded-full border transition-all duration-200 ${imageMode 
                              ? 'bg-primary border-primary/50 shadow-sm shadow-primary/20' 
                              : 'bg-slate-700/60 border-slate-600/50'
                            }`}
                          >
                            <span
                              className={`h-3 w-3 rounded-full transition-all duration-200 ${imageMode 
                                ? 'bg-white translate-x-[calc(100%+2px)] shadow-sm' 
                                : 'bg-slate-500 translate-x-0.5'
                              }`}
                            />
                          </span>
                          <span className="font-medium">Image</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          className="inline-flex items-center justify-center h-7 w-7 rounded-md text-slate-400 hover:text-slate-100 hover:bg-slate-700/50 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200"
                          title="History"
                          disabled={snapshots.length === 0}
                          onClick={() => setHistoryOpen(true)}
                        >
                          <History className="h-3.5 w-3.5" />
                        </button>

                        <button
                          type="button"
                          className="inline-flex items-center justify-center h-7 w-7 rounded-md text-slate-400 hover:text-slate-100 hover:bg-slate-700/50 transition-all duration-200"
                          title="Download .drawio"
                          onClick={handleDownload}
                        >
                          <Download className="h-3.5 w-3.5" />
                        </button>

                        <button
                          type="button"
                          className="inline-flex items-center justify-center h-7 w-7 rounded-md text-slate-400 hover:text-slate-100 hover:bg-slate-700/50 transition-all duration-200"
                          title="Upload image or file"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <ImageIcon className="h-3.5 w-3.5" />
                        </button>

                        <input
                          ref={fileInputRef}
                          type="file"
                          className="hidden"
                          accept="image/*,.pdf,application/pdf,text/*,.md,.markdown,.json,.csv,.xml,.yaml,.yml,.toml,.py,.js,.ts"
                          multiple
                          onChange={(e) => handleFilesSelected(e.target.files)}
                        />

                        <div className="w-px h-6 bg-slate-700/50 mx-1" />

                        <button
                          type="submit"
                          aria-label="Send message"
                          disabled={inFlightCount >= MAX_ACTIVE_REQUESTS || (!input.trim() && attachedFiles.length === 0)}
                          className="inline-flex items-center justify-center h-8 px-4 rounded-lg font-semibold text-sm bg-primary text-white hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm shadow-primary/20 hover:shadow-md hover:shadow-primary/30"
                        >
                          {isBusy ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : null}
                          Send
                        </button>
                      </div>
                    </div>
                  </div>
                </form>
              </footer>
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>

      {historyOpen ? (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setHistoryOpen(false)} />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="w-full max-w-lg max-h-[80vh] overflow-auto rounded-xl border border-border bg-background p-4 shadow-lg">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-foreground">History</h3>
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setHistoryOpen(false)}
                >
                  Close
                </button>
              </div>
              <div className="space-y-2">
                {snapshots
                  .slice()
                  .reverse()
                  .map((s, idx) => (
                    <button
                      key={`${s.createdAt}-${idx}`}
                      type="button"
                      className="w-full text-left rounded-lg border border-border bg-card/30 hover:bg-card/60 transition-colors px-3 py-2"
                      onClick={() => restoreSnapshot(s)}
                      title="Restore this diagram"
                    >
                      <div className="text-xs text-muted-foreground">{new Date(s.createdAt).toLocaleString()}</div>
                      <div className="text-sm text-foreground truncate">{s.prompt}</div>
                    </button>
                  ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {confirmResetOpen ? (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setConfirmResetOpen(false)} />
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-xl border border-border bg-background p-5 shadow-lg">
              <h3 className="text-sm font-semibold text-foreground">Start a new chat?</h3>
              <p className="text-sm text-muted-foreground mt-1">
                This clears the sidebar conversation and resets the diagram.
              </p>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  className="px-3 py-2 text-sm rounded-lg border border-border hover:bg-muted"
                  onClick={() => setConfirmResetOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="px-3 py-2 text-sm rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => {
                    setConfirmResetOpen(false);
                    handleReset();
                  }}
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
