# Power AI

A local-first AI coding workspace with a code editor, assistant UI, Node.js API, dataset manager, and experimental trainable language model.

## Minimum requirements

- **Node.js 20+** (Node.js 22 or 24 is fine)
- Windows, macOS, or Linux
- No npm install step, no third-party packages, no API keys, no account, and no internet connection required after the project files are on your computer.

## Start

Open a terminal in the project folder and run:

\`\`\`bash
npm start
\`\`\`

Then open http://127.0.0.1:3000 in your browser.

The server stores your workspace, datasets, and model under \`data/\`. Back up that folder if you want to preserve training data and trained weights. The default server address is localhost only.

## What is included

- **Code Studio:** edit and save project files; create files and switch between them.
- **AI Assistant:** a local backend endpoint with basic coding workflow guidance.
- **Training Lab:** add text datasets, train the statistical model, see token/vocabulary counts, and test generation.
- **No hosted inference:** the application does not call OpenAI, Anthropic, Google, Groq, or another external AI provider.

## Training status: read this

The current trainer learns a word-level bigram model by counting which tokens follow one another in the supplied text. This is genuine statistical training, but it is **not a Transformer or a modern coding LLM**. Its generated text can be incoherent and it does not have deep reasoning. The next major milestone is a tokenizer plus a small neural Transformer training and inference pipeline.

Use original training material or text you have permission to use.

## API overview

- \`GET /api/health\`
- \`GET /api/workspace\`
- \`PUT /api/workspace\`
- \`GET /api/datasets\`
- \`POST /api/datasets\`
- \`DELETE /api/datasets/:id\`
- \`POST /api/train\`
- \`POST /api/chat\`

## Safety

The server intentionally binds to \`127.0.0.1\`. The workspace endpoints do not yet include authentication or multi-user access controls, so do not expose this backend publicly as-is. The editor stores code as text and does not execute submitted code on the server.
