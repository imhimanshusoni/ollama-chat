// Document ingestion helpers for RAG ("Chat with your Documents"): validation,
// text extraction (PDF via pdf.js, plain text/markdown directly), and
// paragraph-aware chunking. Mirrors the shape of imageUtils.ts.

// pdf.js is ~1.5MB, so it's lazy-loaded on first PDF parse rather than pulled
// into the main bundle — most sessions never upload a PDF. The worker is loaded
// as a bundled, hashed static asset via Vite's `?url` import (no CDN, version
// locked to the API).
let pdfjsPromise: Promise<typeof import('pdfjs-dist')> | null = null;
function loadPdfjs(): Promise<typeof import('pdfjs-dist')> {
  if (!pdfjsPromise) {
    pdfjsPromise = (async () => {
      const pdfjsLib = await import('pdfjs-dist');
      const { default: PdfWorkerUrl } = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
      pdfjsLib.GlobalWorkerOptions.workerSrc = PdfWorkerUrl;
      return pdfjsLib;
    })();
  }
  return pdfjsPromise;
}

const MAX_DOC_SIZE = 25 * 1024 * 1024; // 25MB
const ALLOWED_DOC_TYPES = ['application/pdf', 'text/plain', 'text/markdown'];

// Some browsers/OSes don't set a MIME type for .md files — fall back to the
// extension so markdown notes still validate.
function docExt(name: string): string {
  return name.toLowerCase().split('.').pop() ?? '';
}

export function isPdf(file: File): boolean {
  return file.type === 'application/pdf' || docExt(file.name) === 'pdf';
}

// True for the document formats RAG accepts — used by InputArea to route a
// dropped/pasted/selected file to ingestion instead of the image pipeline.
export function isSupportedDoc(file: File): boolean {
  if (ALLOWED_DOC_TYPES.includes(file.type)) return true;
  return ['pdf', 'txt', 'md', 'markdown'].includes(docExt(file.name));
}

export function validateDoc(file: File): { valid: boolean; error?: string } {
  if (!isSupportedDoc(file)) {
    return { valid: false, error: 'Unsupported file. Use PDF, TXT, or Markdown.' };
  }
  if (file.size > MAX_DOC_SIZE) {
    return {
      valid: false,
      error: `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max 25MB.`,
    };
  }
  return { valid: true };
}

// A run of text tagged with the source page (undefined for plain text/markdown).
export interface TextSegment {
  text: string;
  page?: number;
}

/**
 * Extract text from a document as page-tagged segments. PDFs yield one segment
 * per page (so chunks can carry page numbers for citations); .txt/.md yield a
 * single untagged segment.
 */
export async function extractText(file: File): Promise<TextSegment[]> {
  if (isPdf(file)) {
    return extractPdfText(file);
  }
  const text = await file.text();
  return [{ text }];
}

async function extractPdfText(file: File): Promise<TextSegment[]> {
  const pdfjsLib = await loadPdfjs();
  const data = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data });
  const pdf = await loadingTask.promise;
  const segments: TextSegment[] = [];
  try {
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const content = await page.getTextContent();
      const text = content.items
        // TextItem has `str`; TextMarkedContent (structure markers) doesn't.
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ')
        .replace(/[ \t]+/g, ' ')
        .trim();
      if (text) segments.push({ text, page: pageNum });
      // Release page resources as we go for large PDFs.
      page.cleanup();
    }
  } finally {
    // Abort the worker and free the document's resources.
    await loadingTask.destroy();
  }
  return segments;
}

export interface Chunk {
  text: string;
  index: number;
  page?: number;
}

const DEFAULT_CHUNK_SIZE = 1000; // chars (~250 tokens at ~4 chars/token)
const DEFAULT_OVERLAP = 150; // chars carried into the next chunk for continuity

/**
 * Paragraph-aware chunking. Splits each segment on blank lines, packs
 * paragraphs into a chunk until `size` is exceeded, and carries the last
 * ~`overlap` chars into the next chunk so context isn't lost at boundaries. A
 * single paragraph longer than `size` is hard-split. Each chunk keeps the
 * `page` of the segment it came from for citations.
 */
export function chunkText(
  segments: TextSegment[],
  opts?: { size?: number; overlap?: number }
): Chunk[] {
  const size = opts?.size ?? DEFAULT_CHUNK_SIZE;
  const overlap = Math.min(opts?.overlap ?? DEFAULT_OVERLAP, Math.floor(size / 2));
  const chunks: Chunk[] = [];
  let index = 0;

  const push = (text: string, page?: number) => {
    const trimmed = text.trim();
    if (trimmed) chunks.push({ text: trimmed, index: index++, page });
  };

  for (const seg of segments) {
    const paragraphs = seg.text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
    let current = '';

    const flush = () => {
      if (!current.trim()) return;
      push(current, seg.page);
      // Seed the next chunk with the tail of this one for overlap.
      current = overlap > 0 ? current.slice(-overlap) : '';
    };

    for (const para of paragraphs) {
      // A single paragraph larger than the budget: emit any pending content
      // once, then hard-split the oversized paragraph into size-bounded pieces.
      if (para.length > size) {
        if (current.trim()) push(current, seg.page);
        current = '';
        for (let i = 0; i < para.length; i += size - overlap) {
          push(para.slice(i, i + size), seg.page);
        }
        continue;
      }
      if (current && current.length + para.length + 2 > size) {
        flush();
      }
      current = current ? `${current}\n\n${para}` : para;
    }
    // End of a segment (page): flush so a chunk never spans two pages, keeping
    // page citations accurate.
    if (current.trim()) push(current, seg.page);
  }

  return chunks;
}
