const files = {
  txt: 'exercise.txt',
  md: 'exercise.md',
  json: 'exercise.json',
  docx: 'exercise.docx',
};

export async function GET(request) {
  const format = new URL(request.url).searchParams.get('format') || 'txt';
  const file = files[format] || files.txt;
  return Response.redirect(new URL(`/templates/${file}`, request.url), 307);
}
