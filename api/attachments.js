const MAX_ATTACHMENTS = 4;
const MAX_TOTAL_BYTES = 2_700_000;
const MAX_EXTRACTED_CHARS = 45_000;
const MAX_PDF_PAGES = 60;
const MAX_DOCX_UNCOMPRESSED_BYTES = 20_000_000;

const TEXT_EXTENSIONS = new Set([
  '.txt', '.md', '.markdown', '.csv', '.tsv', '.json', '.xml', '.html', '.htm', '.css', '.js', '.mjs', '.cjs',
  '.ts', '.tsx', '.jsx', '.py', '.java', '.c', '.cc', '.cpp', '.h', '.hpp', '.go', '.rs', '.rb', '.php', '.sql',
  '.sh', '.bat', '.ps1', '.yml', '.yaml', '.toml', '.ini', '.log', '.diff', '.patch', '.env.example',
]);
const IMAGE_TYPES = new Map([
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
]);
const DOCX_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

function badRequest(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

function safeName(value) {
  const name = String(value || 'attachment').replace(/\\/g, '/').split('/').pop().replace(/[\r\n\0]/g, '').trim();
  return name.slice(0, 120) || 'attachment';
}

function hasMagic(ext, buffer) {
  if (ext === '.pdf') return buffer.subarray(0, 5).toString('ascii') === '%PDF-';
  if (ext === '.docx') return buffer.length >= 4 && buffer.readUInt32LE(0) === 0x04034b50;
  if (ext === '.png') return buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (ext === '.jpg' || ext === '.jpeg') return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (ext === '.webp') return buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP';
  return true;
}

function assertDocxSize(buffer) {
  const min = Math.max(0, buffer.length - 65_557);
  let eocd = -1;
  for (let offset = buffer.length - 22; offset >= min; offset--) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) { eocd = offset; break; }
  }
  if (eocd < 0) throw badRequest('The DOCX file is not a valid Word document.');
  const entries = buffer.readUInt16LE(eocd + 10), directorySize = buffer.readUInt32LE(eocd + 12), directoryOffset = buffer.readUInt32LE(eocd + 16);
  if (directorySize === 0xffffffff || directoryOffset === 0xffffffff || directoryOffset + directorySize > eocd) throw badRequest('The DOCX file uses an unsupported ZIP layout.');
  let offset = directoryOffset, total = 0;
  for (let i = 0; i < entries; i++) {
    if (offset + 46 > buffer.length || buffer.readUInt32LE(offset) !== 0x02014b50) throw badRequest('The DOCX file is not a valid Word document.');
    const expanded = buffer.readUInt32LE(offset + 24);
    if (expanded === 0xffffffff) throw badRequest('The DOCX file uses an unsupported ZIP64 layout.');
    total += expanded;
    if (total > MAX_DOCX_UNCOMPRESSED_BYTES) throw badRequest('The uncompressed DOCX content is too large to read safely.');
    offset += 46 + buffer.readUInt16LE(offset + 28) + buffer.readUInt16LE(offset + 30) + buffer.readUInt16LE(offset + 32);
  }
}

function decodeAttachment(input) {
  if (!input || typeof input !== 'object' || typeof input.data !== 'string') throw badRequest('Each attachment must include base64 file data.');
  const name = safeName(input.name);
  const lower = name.toLowerCase();
  const ext = lower.endsWith('.env.example') ? '.env.example' : require('path').extname(lower);
  const allowed = TEXT_EXTENSIONS.has(ext) || IMAGE_TYPES.has(ext) || ext === '.pdf' || ext === '.docx';
  if (!allowed) throw badRequest(`Unsupported file type: ${name}`);
  if (!input.data || input.data.length > Math.ceil(MAX_TOTAL_BYTES * 4 / 3) + 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(input.data) || input.data.length % 4 !== 0) {
    throw badRequest(`Invalid or oversized file data: ${name}`);
  }
  const buffer = Buffer.from(input.data, 'base64');
  const mime = IMAGE_TYPES.get(ext) || (ext === '.pdf' ? 'application/pdf' : ext === '.docx' ? DOCX_TYPE : 'text/plain');
  if (buffer.length === 0) throw badRequest(`The file is empty: ${name}`);
  if (!hasMagic(ext, buffer)) throw badRequest(`The file contents do not match its file type: ${name}`);
  if (ext === '.docx') assertDocxSize(buffer);
  return { name, ext, mime, buffer };
}

async function extractPdf(buffer) {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task = getDocument({ data: new Uint8Array(buffer), isEvalSupported: false, useSystemFonts: false });
  try {
    const pdf = await task.promise;
    if (pdf.numPages > MAX_PDF_PAGES) throw badRequest(`PDF has more than ${MAX_PDF_PAGES} pages.`);
    const pages = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(content.items.map(item => typeof item.str === 'string' ? item.str : '').join(' '));
      page.cleanup();
    }
    return pages.join('\n\n').trim();
  } finally {
    await task.destroy();
  }
}

async function readAttachments(inputs) {
  if (inputs === undefined) return { documents: [], images: [] };
  if (!Array.isArray(inputs) || inputs.length > MAX_ATTACHMENTS) throw badRequest(`Attach up to ${MAX_ATTACHMENTS} files at a time.`);
  const decoded = inputs.map(decodeAttachment);
  const totalBytes = decoded.reduce((sum, file) => sum + file.buffer.length, 0);
  if (totalBytes > MAX_TOTAL_BYTES) throw badRequest('Attachments exceed the 2.7 MB total size limit.');

  const documents = [];
  const images = [];
  let remaining = MAX_EXTRACTED_CHARS;
  for (const file of decoded) {
    if (IMAGE_TYPES.has(file.ext)) {
      images.push({ name: file.name, mime: file.mime, data: file.buffer.toString('base64') });
      continue;
    }
    let text;
    try {
      if (file.ext === '.pdf') text = await extractPdf(file.buffer);
      else if (file.ext === '.docx') text = (await require('mammoth').extractRawText({ buffer: file.buffer })).value;
      else text = new TextDecoder('utf-8').decode(file.buffer);
    } catch (error) {
      if (error && error.statusCode === 400) throw error;
      throw badRequest(`Could not read ${file.name}. Check that it is a valid PDF, DOCX, or text file.`);
    }
    text = String(text || '').replace(/\0/g, '').trim();
    if (!text) throw badRequest(`${file.name} has no readable text. Scanned PDFs need OCR before JARVIS can read them.`);
    const excerpt = text.slice(0, Math.max(0, remaining));
    const note = remaining <= 0 ? '[Text omitted because the combined file text limit was reached.]' : text.length > excerpt.length ? '\n[Text truncated to stay within the request limit.]' : '';
    documents.push({ name: file.name, text: excerpt + note });
    remaining -= excerpt.length;
  }
  return { documents, images };
}

module.exports = { MAX_ATTACHMENTS, MAX_TOTAL_BYTES, MAX_EXTRACTED_CHARS, readAttachments };
