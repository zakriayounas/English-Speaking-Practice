import { Document, Packer, Paragraph, TextRun } from 'docx';

const template = `Title: Business phrases
Category: Workplace English
Level: Beginner

Question: Choose the best phrase: Want to lead the project? _____!
A: Go for it
B: Never mind
C: Hold on
D: Not really
Answer: A
Explanation: Go for it means do it; I support you.`;

export async function GET(request) {
  const format = new URL(request.url).searchParams.get('format') || 'txt';
  if (format === 'json') {
    return new Response(JSON.stringify({ title: 'Business phrases', category: 'Workplace English', level: 'beginner', questions: [{ prompt: 'Choose the best phrase: Want to lead the project? _____!', options: ['Go for it', 'Never mind', 'Hold on', 'Not really'], answer: 'A', explanation: 'Go for it means do it; I support you.' }] }, null, 2), { headers: { 'Content-Type': 'application/json', 'Content-Disposition': 'attachment; filename="fluentpal-template.json"' } });
  }
  if (format === 'docx') {
    const document = new Document({ sections: [{ children: template.split('\n').map(line => new Paragraph({ children: [new TextRun(line)] })) }] });
    const buffer = await Packer.toBuffer(document);
    return new Response(buffer, { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'Content-Disposition': 'attachment; filename="fluentpal-template.docx"' } });
  }
  const extension = format === 'md' ? 'md' : 'txt';
  return new Response(template, { headers: { 'Content-Type': format === 'md' ? 'text/markdown' : 'text/plain', 'Content-Disposition': `attachment; filename="fluentpal-template.${extension}"` } });
}
