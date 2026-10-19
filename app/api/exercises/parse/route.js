import mammoth from 'mammoth';
import { parseExercise } from '../../../../lib/exercise-parse';

export async function POST(request) {
  try {
    const form = await request.formData();
    const file = form.get('file');
    const pasted = form.get('text');
    let text = typeof pasted === 'string' ? pasted : '';
    if (file && typeof file.arrayBuffer === 'function' && file.size) {
      const buffer = Buffer.from(await file.arrayBuffer());
      text = file.name.toLowerCase().endsWith('.docx')
        ? (await mammoth.extractRawText({ buffer })).value
        : buffer.toString('utf8');
    }
    const parsed = parseExercise(text);
    if (!parsed.ok) return Response.json({ error: 'The import needs a few fixes.', errors: parsed.errors }, { status: 400 });
    return Response.json(parsed.exercise);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Could not parse this exercise.' }, { status: 400 });
  }
}
