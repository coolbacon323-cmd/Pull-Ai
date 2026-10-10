# Pull AI

Pull AI is an independent AI project with its own interface and API. The long-term goal is a proprietary Pull-1 language model, trained and served by this project rather than delegated to an external AI provider.

## Run locally

Requirements: Node.js 20 or newer.

1. Run `npm start` in this folder.
2. Open `http://localhost:3000`.
3. Check `http://localhost:3000/api/health` for API status.

No npm packages are required.

## Current state — bootstrap prototype

The current API uses a small set of hand-written response and routing rules. It supports a few basic explanations, simple arithmetic, project-planning guidance, and debugging prompts. It is **not yet a trained language model**, and it will not match the open-ended reasoning or coding ability of a modern LLM. The health endpoint reports `trainedWeightsLoaded: false` so the app does not misrepresent its capabilities.

## Roadmap toward a real Pull-1 model

1. **Data pipeline:** curate licensed, high-quality instruction/code examples; deduplicate, validate, and split them into training and evaluation sets.
2. **Tokenizer:** train and version a tokenizer with reproducible encode/decode tests.
3. **Model:** implement a decoder-only Transformer in a framework that supports local training, checkpoints, and GPU acceleration.
4. **Training:** add a real next-token training loop, validation loss, checkpoint saving/resume, gradient accumulation, and reproducible configuration.
5. **Inference:** load trained checkpoints, generate tokens with sampling controls, stream responses, and enforce context limits.
6. **Evaluation:** test held-out reasoning, coding, instruction-following, and safety examples; compare versions instead of judging by a few cherry-picked prompts.
7. **Product:** add durable chat history, model/version settings, import/export, and a transparent model-status panel.

## Important distinction

A training-data file or a button labelled “Train” does not itself create a capable LLM. The project needs a tokenizer, a trainable neural architecture, enough suitable data and compute, trained weights, and repeatable evaluation. Start with a small model that can actually be trained and tested locally, then scale based on measured results.

## API

- `GET /api/health` — reports the current engine and whether trained weights are loaded.
- `POST /api/chat` — accepts a JSON object containing a `messages` array and returns a chat-completions-style response.

The API is self-owned; this project does not call OpenAI, Anthropic, Google, Groq, or another hosted inference provider.
