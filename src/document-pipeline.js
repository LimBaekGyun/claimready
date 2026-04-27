import { createWorker } from 'tesseract.js';
import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

let workerPromise;
let progressListener = null;

export async function extractTextFromFile(file, onProgress) {
  progressListener = onProgress;

  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    return extractFromPdf(file);
  }

  if (file.type.startsWith('image/')) {
    return extractFromImage(file);
  }

  if (file.type.startsWith('text/') || file.name.toLowerCase().endsWith('.txt')) {
    onProgress?.('텍스트 파일을 직접 읽고 있습니다.');
    return {
      text: sanitizeExtractedText(await file.text()),
      pageCount: 1,
      previewUrl: null,
    };
  }

  throw new Error('현재는 이미지, PDF, TXT 파일만 지원합니다.');
}

async function extractFromPdf(file) {
  progressListener?.('PDF 페이지를 읽는 중입니다.');
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await getDocument({ data }).promise;
  const chunks = [];

  for (let pageIndex = 1; pageIndex <= pdf.numPages; pageIndex += 1) {
    progressListener?.(`PDF ${pageIndex}/${pdf.numPages} 페이지를 분석 중입니다.`);
    const page = await pdf.getPage(pageIndex);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item) => item.str).join(' ').trim();

    if (pageText.length >= 30) {
      chunks.push(pageText);
      continue;
    }

    progressListener?.(`PDF ${pageIndex}/${pdf.numPages} 페이지는 스캔본으로 보여 OCR을 시도합니다.`);
    const canvas = await renderPdfPage(page);
    const worker = await getWorker();
    const result = await worker.recognize(canvas);
    chunks.push(result.data.text.trim());
  }

  return {
    text: sanitizeExtractedText(chunks.join('\n')),
    pageCount: pdf.numPages,
    previewUrl: URL.createObjectURL(file),
  };
}

async function extractFromImage(file) {
  progressListener?.('이미지 OCR을 시작합니다.');
  const worker = await getWorker();
  const result = await worker.recognize(file);

  return {
    text: sanitizeExtractedText(result.data.text),
    pageCount: 1,
    previewUrl: URL.createObjectURL(file),
  };
}

async function renderPdfPage(page) {
  const viewport = page.getViewport({ scale: 1.5 });
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  await page.render({ canvasContext: context, viewport }).promise;
  return canvas;
}

async function getWorker() {
  if (!workerPromise) {
    workerPromise = createWorker('kor+eng', 1, {
      logger: (message) => {
        if (!progressListener) {
          return;
        }

        if (message.status === 'recognizing text') {
          progressListener(`OCR 진행률 ${Math.round((message.progress || 0) * 100)}%`);
          return;
        }

        progressListener(`OCR ${message.status}`);
      },
    });
  }

  return workerPromise;
}

function sanitizeExtractedText(text) {
  const source = String(text || '')
    .normalize('NFKC')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[ \t]+/g, ' ');

  const replacements = [
    [/진료비\s*계산서\s*영수증/g, '진료비 계산서 영수증'],
    [/진료비\s*세부\s*내역서/g, '진료비 세부내역서'],
    [/입\s*퇴원\s*확인서/g, '입퇴원확인서'],
    [/질병\s*분류\s*(?:기호|코드)/gi, '질병분류기호'],
    [/상병\s*코드/gi, '상병코드'],
    [/원\s*외\s*처방/g, '원외처방'],
    [/외\s*래/g, '외래'],
    [/통\s*원/g, '통원'],
  ];

  let normalized = source;
  replacements.forEach(([pattern, replacement]) => {
    normalized = normalized.replace(pattern, replacement);
  });

  return normalized
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n')
    .trim();
}
