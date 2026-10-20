import { readFile } from 'node:fs/promises';
import path from 'node:path';

const files = {
  txt: 'exercise.txt',
  md: 'exercise.md',
  json: 'exercise.json',
  docx: 'exercise.docx',
};

const contentTypes = {
  txt: 'text/plain; charset=utf-8',
  md: 'text/markdown; charset=utf-8',
  json: 'application/json; charset=utf-8',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

export async function GET(request) {
  const requestedFormat = new URL(request.url).searchParams.get('format') || 'txt';
  const format = Object.hasOwn(files, requestedFormat) ? requestedFormat : 'txt';
  const file = files[format];
  const content = await readFile(path.join(process.cwd(), 'public', 'templates', file));

  return new Response(content, {
    headers: {
      'Content-Type': contentTypes[format],
      'Content-Disposition': `attachment; filename="${file}"`,
      'Content-Length': String(content.byteLength),
      'Cache-Control': 'private, no-store',
    },
  });
}
