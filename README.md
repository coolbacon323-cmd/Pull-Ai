# Power AI

Minimal local coding workspace with a built-in Node.js backend and an experimental text trainer.

## Requirements
- Node.js 20 or newer
- Windows, macOS, or Linux
- No npm commands, no npm install, no packages, API keys, account, or internet needed once the project is on your computer.

## Run on Windows
Double-click `start.bat`, or open PowerShell in this folder and run:

```powershell
node server.js
```

Then open http://127.0.0.1:3000. Keep the terminal window open while using the site.

## What it does
- Code: edit files and save them to the local backend.
- Chat: basic built-in coding helper, not a modern LLM.
- Train: add text examples and train a word-level bigram statistical model.

Training counts token transitions. It is real statistical training but not a Transformer or deep-reasoning model. Generated text may be incoherent. The app does not call external AI providers. Files, datasets, and model data are stored in the server's `data/` folder.

Use original training data or text you have permission to use. The server binds to localhost and should not be exposed publicly without authentication.
