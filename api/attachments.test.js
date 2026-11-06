import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { MAX_TOTAL_BYTES, readAttachments } from './attachments.js';

const base64 = value => Buffer.from(value).toString('base64');

function makePdf(text) {
  const stream = `BT /F1 18 Tf 20 200 Td (${text}) Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
  ];
  const parts = ['%PDF-1.4\n'];
  const offsets = [];
  for (let i = 0; i < objects.length; i++) {
    offsets.push(Buffer.byteLength(parts.join('')));
    parts.push(`${i + 1} 0 obj\n${objects[i]}\nendobj\n`);
  }
  const xref = Buffer.byteLength(parts.join(''));
  parts.push(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`);
  parts.push(offsets.map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join(''));
  parts.push(`trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  return Buffer.from(parts.join(''), 'binary');
}

describe('uploaded attachments', () => {
  it('extracts UTF-8 text without persisting it elsewhere', async () => {
    const result = await readAttachments([{ name: 'notes.txt', data: base64('Hello JARVIS') }]);
    expect(result.documents).toEqual([{ name: 'notes.txt', text: 'Hello JARVIS' }]);
    expect(result.images).toEqual([]);
  });

  it('extracts readable PDF text', async () => {
    const result = await readAttachments([{ name: 'report.pdf', data: makePdf('Jarvis PDF test').toString('base64') }]);
    expect(result.documents[0].text).toContain('Jarvis PDF test');
  });

  it('extracts Word document text', async () => {
    const docx = readFileSync(new URL('./test/fixtures/minimal.docx', import.meta.url)).toString('base64');
    const result = await readAttachments([{ name: 'notes.docx', data: docx }]);
    expect(result.documents[0].text).toContain('JARVIS DOCX extraction test');
  });

  it('passes image bytes through with an extension-derived safe MIME type', async () => {
    const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).toString('base64');
    const result = await readAttachments([{ name: 'screen.png', mime: 'text/plain', data: png }]);
    expect(result.images).toEqual([{ name: 'screen.png', mime: 'image/png', data: png }]);
  });

  it('rejects unsupported file types and oversized uploads', async () => {
    await expect(readAttachments([{ name: 'program.exe', data: base64('no') }])).rejects.toThrow('Unsupported file type');
    const tooLarge = Buffer.alloc(MAX_TOTAL_BYTES + 1).toString('base64');
    await expect(readAttachments([{ name: 'large.txt', data: tooLarge }])).rejects.toThrow('Attachments exceed the 2.7 MB total size limit');
  });
});
