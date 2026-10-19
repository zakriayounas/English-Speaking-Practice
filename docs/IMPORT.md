# Exercise import

FluentPal reads exercises from four static files in `public/templates/`. Those files are part of the repository. The app does not recreate them when a page loads, when someone downloads a template, or during deployment.

| File | How it is used |
|---|---|
| `exercise.txt` | Plain-text download |
| `exercise.md` | Markdown download, paste placeholder, and Insert example |
| `exercise.json` | JSON download |
| `exercise.docx` | Word download. It was created once from the text template. |

Downloads link directly to those files. Paste example loads `exercise.md` in the browser and keeps it for the rest of the page session.

## Field template

Use this shape in `.txt`, `.md`, and `.docx` files:

```text
Title: Starting a standup
Category: workplace-english
Level: beginner
Target: 5
Visibility: members

Question:
First line of the prompt.
Second line of the prompt.

A: First answer
B: Second answer
C: Third answer
D: Fourth answer
Answer: A
Explanation:
First paragraph with **bold** and "quotes".

Second paragraph.
```

`Category` must match a category slug or display name. `Target` is optional and is a whole number of minutes. `Visibility` is `public` or `members`. Each question needs a prompt, exactly four answers, a correct answer (`A`–`D` or the option text), and an explanation.

Blank lines inside a prompt or explanation are kept. A new question starts at the next `Question:` line.

## JSON

Use `title`, `category`, `level`, optional `targetMinutes`, optional `visibility`, and a `questions` array. Each question has `prompt`, `options` (four strings), `answer`, and `explanation`.

## Older markdown

Files that use `## Question` headings and `**Prompt:**` lines still import. New templates use the field format so the text and markdown examples stay equivalent.

## What import does

Parsing fills the form so you can review it. It does not save. If parsing fails, the form you already had is left alone and the message includes the field, and the line number when there is one.

## When the format changes

Update the static files, `lib/exercise-parse.js`, this document, and `tests/templates.test.js` together. Do not generate the template files from the running app.
