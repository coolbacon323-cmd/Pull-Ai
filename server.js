'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const DATA = path.join(ROOT, 'data');
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '127.0.0.1';
const MAX_BODY = 2 * 1024 * 1024;
fs.mkdirSync(DATA, { recursive: true });

const FILES_PATH = path.join(DATA, 'workspace.json');
const DATASETS_PATH = path.join(DATA, 'datasets.json');
const MODEL_PATH = path.join(DATA, 'model.json');

const starterFiles = {
  'main.py': 'def greet(name: str) -> str:\n    return f"Hello, {name}!"\n\n\nif __name__ == "__main__":\n    print(greet("Power AI"))\n',
  'README.md': '# My Power AI project\n\nEdit files in the Code workspace. Save stores your project on this server.\n',
  'app.js': 'function add(a, b) {\n  return a + b;\n}\n\nconsole.log(add(2, 3));\n'
};

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch { return fallback; }
}
function writeJson(file, value) {
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2), 'utf8');
  fs.renameSync(tmp, file);
}
if (!fs.existsSync(FILES_PATH)) writeJson(FILES_PATH, starterFiles);
if (!fs.existsSync(DATASETS_PATH)) writeJson(DATASETS_PATH, [
  { id: crypto.randomUUID(), name: 'Power AI starter notes', createdAt: new Date().toISOString(), text: 'Power AI is a locally owned experimental language model project. A function is a reusable block of code. Python uses indentation to define code blocks. JavaScript can run in a browser or a Node.js server. A variable stores a value under a name. Test code with small examples and explain assumptions clearly.' }
]);

const mime = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.json':'application/json; charset=utf-8', '.svg':'image/svg+xml', '.txt':'text/plain; charset=utf-8' };
function send(res, status, data, type='application/json; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'X-Content-Type-Options':'nosniff', 'Cache-Control':'no-store' });
  res.end(type.startsWith('application/json') ? JSON.stringify(data) : data);
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (Buffer.byteLength(body) > MAX_BODY) {
        reject(Object.assign(new Error('Request too large (2 MB maximum).'), { status: 413 }));
        req.destroy();
      }
    });
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch { reject(Object.assign(new Error('Invalid JSON body.'), { status: 400 })); }
    });
    req.on('error', reject);
  });
}
function cleanFilename(name) {
  if (typeof name !== 'string' || !/^[\w.-]{1,80}$/.test(name) || name === '.' || name === '..') return null;
  return name;
}
function tokenize(text) {
  return (String(text).toLowerCase().match(/[a-z0-9_]+|[^\s\w]/g) || []).slice(0, 100000);
}
function weightedPick(items) {
  const total = items.reduce((sum, item) => sum + item[1], 0);
  if (!total) return items[0]?.[0] || '';
  let target = Math.random() * total;
  for (const [value, weight] of items) {
    target -= weight;
    if (target <= 0) return value;
  }
  return items[items.length - 1][0];
}
function train(datasets) {
  const transitions = Object.create(null);
  const unigram = Object.create(null);
  let tokenCount = 0;
  for (const set of datasets) {
    const tokens = tokenize(set.text);
    tokenCount += tokens.length;
    for (let i = 0; i < tokens.length; i++) {
      unigram[tokens[i]] = (unigram[tokens[i]] || 0) + 1;
      if (i + 1 < tokens.length) {
        const key = tokens[i];
        transitions[key] ||= Object.create(null);
        transitions[key][tokens[i + 1]] = (transitions[key][tokens[i + 1]] || 0) + 1;
      }
    }
  }
  const model = { format:'power-ai-bigram-v1', trainedAt:new Date().toISOString(), datasetCount:datasets.length, tokenCount, vocabularySize:Object.keys(unigram).length, unigram, transitions };
  writeJson(MODEL_PATH, model);
  return { trainedAt:model.trainedAt, datasetCount:model.datasetCount, tokenCount, vocabularySize:model.vocabularySize, modelType:'Trainable bigram language model (experimental)' };
}
function generate(text, model, maxTokens=70) {
  const words = tokenize(text);
  let current = words[words.length - 1] || weightedPick(Object.entries(model.unigram || {}));
  const output = [];
  for (let i = 0; i < maxTokens; i++) {
    const options = Object.entries((model.transitions || {})[current] || {});
    if (!options.length) current = weightedPick(Object.entries(model.unigram || {}));
    else current = weightedPick(options);
    if (!current) break;
    output.push(current);
  }
  let result = output.join(' ').replace(/\s+([.,!?;:])/g, '$1');
  if (result) result = result[0].toUpperCase() + result.slice(1);
  return result;
}
function codeHelper(message) {
  const q = message.trim();
  if (/^(hi|hello|hey)\b/i.test(q)) return 'Power AI coding workspace is ready. Ask for code help, or open Training to add examples and train the experimental local model.';
  if (/python|function|variable|code|javascript|bug|error|script|html|css/i.test(q)) {
    return 'I can help plan and review this coding task, but this starter assistant is not yet a neural coding model.\n\nSuggested workflow:\n1. Describe the expected behavior and language.\n2. Share the relevant code and exact error.\n3. Test one small change at a time.\n\nTraining data you add is used by the experimental local bigram model; it does not automatically create code-understanding ability.';
  }
  return 'Power AI is running locally. This initial backend includes a code workspace, persistent project files, a dataset manager, and a trainable statistical language model. It is not yet a capable general-purpose LLM. Use the Training tab to train on examples you provide.';
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (req.method === 'GET' && url.pathname === '/api/health') {
      const model = readJson(MODEL_PATH, null);
      return send(res, 200, { ok:true, name:'Power AI', version:'0.2.0', backend:'Node.js', modelLoaded:!!model, modelType:model?.format || null, datasetCount:readJson(DATASETS_PATH, []).length, workspaceFiles:Object.keys(readJson(FILES_PATH, starterFiles)).length });
    }
    if (req.method === 'GET' && url.pathname === '/api/workspace') {
      return send(res, 200, { files:readJson(FILES_PATH, starterFiles) });
    }
    if (req.method === 'PUT' && url.pathname === '/api/workspace') {
      const body = await readBody(req);
      if (!body.files || typeof body.files !== 'object' || Array.isArray(body.files)) return send(res, 400, { error:'Expected a files object.' });
      const entries = Object.entries(body.files);
      if (entries.length > 40) return send(res, 400, { error:'A project can contain up to 40 files.' });
      const clean = {};
      for (const [rawName, content] of entries) {
        const name = cleanFilename(rawName);
        if (!name || typeof content !== 'string' || Buffer.byteLength(content) > 250000) return send(res, 400, { error:'Invalid filename or file larger than 250 KB.' });
        clean[name] = content;
      }
      writeJson(FILES_PATH, clean);
      return send(res, 200, { ok:true, files:Object.keys(clean).length, savedAt:new Date().toISOString() });
    }
    if (req.method === 'GET' && url.pathname === '/api/datasets') {
      return send(res, 200, { datasets:readJson(DATASETS_PATH, []) });
    }
    if (req.method === 'POST' && url.pathname === '/api/datasets') {
      const body = await readBody(req);
      const name = String(body.name || '').trim().slice(0, 100);
      const text = String(body.text || '').trim();
      if (!name || text.length < 20) return send(res, 400, { error:'Give the dataset a name and at least 20 characters of training text.' });
      if (Buffer.byteLength(text) > 500000) return send(res, 400, { error:'Each dataset is limited to 500 KB.' });
      const datasets = readJson(DATASETS_PATH, []);
      if (datasets.length >= 100) return send(res, 400, { error:'Dataset limit reached (100). Delete or combine examples before adding more.' });
      const item = { id:crypto.randomUUID(), name, text, createdAt:new Date().toISOString() };
      datasets.push(item);
      writeJson(DATASETS_PATH, datasets);
      return send(res, 201, { ok:true, dataset:{ ...item, text:undefined }, count:datasets.length });
    }
    if (req.method === 'DELETE' && url.pathname.startsWith('/api/datasets/')) {
      const id = decodeURIComponent(url.pathname.slice('/api/datasets/'.length));
      const datasets = readJson(DATASETS_PATH, []);
      const next = datasets.filter(item => item.id !== id);
      if (next.length === datasets.length) return send(res, 404, { error:'Dataset not found.' });
      writeJson(DATASETS_PATH, next);
      return send(res, 200, { ok:true, count:next.length });
    }
    if (req.method === 'POST' && url.pathname === '/api/train') {
      const datasets = readJson(DATASETS_PATH, []);
      if (!datasets.length) return send(res, 400, { error:'Add a training dataset first.' });
      const stats = train(datasets);
      return send(res, 200, { ok:true, stats, note:'Training completed. This is a small word-level bigram model, not a Transformer or production LLM.' });
    }
    if (req.method === 'POST' && url.pathname === '/api/chat') {
      const body = await readBody(req);
      const message = String(body.message || '').trim().slice(0, 8000);
      if (!message) return send(res, 400, { error:'Enter a message first.' });
      const model = readJson(MODEL_PATH, null);
      if (model && Object.keys(model.unigram || {}).length) {
        const generated = generate(message, model);
        return send(res, 200, { reply:generated || codeHelper(message), mode:'trained-bigram', warning:'Experimental statistical generation; it may be incoherent and does not reason like a modern LLM.' });
      }
      return send(res, 200, { reply:codeHelper(message), mode:'bootstrap' });
    }
    if (req.method === 'GET' && url.pathname.startsWith('/api/')) return send(res, 404, { error:'API route not found.' });

    const requested = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);
    const full = path.resolve(PUBLIC, '.' + requested);
    if (!full.startsWith(PUBLIC + path.sep) || !fs.existsSync(full) || !fs.statSync(full).isFile()) return send(res, 404, 'Not found', 'text/plain; charset=utf-8');
    const ext = path.extname(full).toLowerCase();
    return send(res, 200, fs.readFileSync(full), mime[ext] || 'application/octet-stream');
  } catch (error) {
    if (!res.headersSent) send(res, error.status || 500, { error:error.message || 'Internal server error.' });
    else res.end();
  }
});

server.listen(PORT, HOST, () => {
  console.log('Power AI backend running at http://' + HOST + ':' + PORT);
  console.log('Data is stored in: ' + DATA);
});
