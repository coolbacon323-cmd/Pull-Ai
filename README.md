# Power AI

Power AI is a local-first AI development project with a web coding workspace, a Node.js backend, persistent project files, a dataset manager, and an experimental trainable language model.

## Run it locally

Requirements: Node.js 20 or newer. No npm packages and no external AI API keys are required.

\`\`\`powershell
npm start
\`\`\`

Open http://127.0.0.1:3000

## Features

- **Code Studio:** edit several project files, add files, and save them through the backend.
- **AI Assistant:** talks to the Power AI backend. The bootstrap assistant gives basic workflow guidance without calling another AI provider.
- **Training Lab:** add or delete text datasets and start a training run.
- **Persistent data:** workspace, datasets, and trained model are stored in \`data/\` as JSON.
- **Local-first:** no OpenAI, Anthropic, Google, Groq, Ollama, or other inference provider is called.

## What the training model is (and isn't)

The trainer learns a word-level bigram model from the datasets: it counts tokens and which tokens follow one another, then stores those learned weights in \`data/model.json\`. Chat generation samples from those learned transitions.

That is a real, trainable statistical language model, but it is **not** a Transformer or a modern general-purpose LLM. It does not have robust reasoning or code understanding. The starter dataset is only a smoke-test example; train with original material you have permission to use. Bigger training text will not magically make this architecture equivalent to a frontier model.

## API

- \`GET /api/health\` — backend and model status
- \`GET /api/workspace\` — read project files
- \`PUT /api/workspace\` — save project files (40 files max; 250 KB per file)
- \`GET /api/datasets\` — list training datasets
- \`POST /api/datasets\` — add a dataset using JSON \`{ "name": "...", "text": "..." }\`
- \`DELETE /api/datasets/:id\` — delete a dataset
- \`POST /api/train\` — train and save the bigram model
- \`POST /api/chat\` — generate a reply

## Security and deployment notes

The server binds to \`127.0.0.1\` by default. That is intentional: the workspace and training endpoints do not include user accounts, so do not expose the backend publicly as-is. For a trusted private deployment set \`HOST=0.0.0.0\` and put proper authentication and HTTPS in front of it first. The editor saves code as text; it deliberately does not execute arbitrary submitted code on the server.

## Roadmap

1. Add automated API and UI tests.
2. Add user authentication and project isolation before public hosting.
3. Implement a tokenizer and a small Transformer training/inference path with reproducible checkpoints.
4. Evaluate on held-out coding and reasoning tasks before making capability claims.
