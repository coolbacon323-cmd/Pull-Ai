const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const PORT = Number(process.env.PORT || 3000);
const ROOT = path.join(__dirname, "public");
const MODEL = "Pull-1 Bootstrap Reasoner";
const MAX_BODY = 1024 * 1024;

function json(res, status, data) {
  res.writeHead(status, {"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"});
  res.end(JSON.stringify(data));
}
function lastUser(messages) { return [...messages].reverse().find(m => m && m.role === "user"); }
function clean(s) { return String(s || "").trim().slice(0, 12000); }

function answer(messages) {
  const current = clean(lastUser(messages)?.content);
  const lower = current.toLowerCase();
  const prior = messages.slice(0, -1).filter(m => m && ["user", "assistant"].includes(m.role)).slice(-8);
  if (!current) return "Send a message and I’ll help you work through it.";
  if (/^(hi|hello|hey|yo)\b/i.test(current)) return "Hey! I’m Pull AI. I can help explain concepts, plan projects, reason through problems, and draft code. I’m currently running the built-in bootstrap reasoner, not trained Pull-1 neural weights.";
  if (/\b(what are you|who are you|your model|are you an ai)\b/.test(lower)) return "I’m Pull AI, running the Pull-1 bootstrap reasoner. The app and API are self-owned, but this version is not yet a trained large language model. It uses local response logic; real open-ended LLM quality requires trained model weights and an inference runtime.";
  if (/\b(help|what can you do|capabilities)\b/.test(lower)) return "I can currently help with:\n• Breaking a project into concrete steps\n• Explaining common programming and technical concepts\n• Drafting small examples and debugging from supplied errors\n• Basic arithmetic and structured reasoning\n• Turning an idea into a specification\n\nLimits: I do not have web access, external AI providers, or trained Pull-1 weights in this bootstrap build.";
  if (/\b(variable|variables)\b/.test(lower) && /\b(python|programming|code)\b/.test(lower)) return "A variable is a named reference to a value. In Python:\n\nname = \"Ada\"\nage = 12\nprint(name, age)\n\nHere, name refers to a string and age refers to an integer. = assigns a value; == checks whether two values are equal.";
  if (/\bfunction\b/.test(lower) && /\b(python|programming|code)\b/.test(lower)) return "A function is a reusable block of code. Example in Python:\n\ndef add(a, b):\n    return a + b\n\nprint(add(2, 3))  # 5\n\nThe parameters a and b receive inputs, return sends a result back, and add(2, 3) produces 5.";
  if (/\b(debug|error|exception|traceback|failed|doesn't work|does not work)\b/.test(lower)) return "I can help debug this. Please include:\n1. The exact error message or full traceback\n2. The relevant code or command\n3. What you expected to happen\n4. What actually happened\n\nI’ll separate the likely root cause from fixes you can verify. Don’t include passwords, API keys, or other secrets.";
  if (/\b(build|make|create|develop|design)\b/.test(lower) && /\b(app|website|game|project|ai|bot|mod|software)\b/.test(lower)) return "Let’s turn this into a buildable specification.\n\nGoal: " + current + "\n\nBuild sequence\n1. Define the smallest working version and its success criteria.\n2. Choose a stack that fits the target platform and constraints.\n3. Implement the main user flow end-to-end before adding secondary features.\n4. Add persistence, validation, error handling, and security checks.\n5. Test real use cases and fix failures before release.\n\nNext useful detail: tell me the platform, must-have features, and any tools or services you want excluded.";
  if (/\b(plan|roadmap|steps|how do i|how to)\b/.test(lower)) return "A practical approach:\n\n1. State the desired outcome in one sentence.\n2. List the constraints and what counts as done.\n3. Build the smallest end-to-end version.\n4. Test it with normal, invalid, and edge-case inputs.\n5. Improve the weakest measured part instead of adding features blindly.\n\nFor a specific plan, share the goal and constraints and I’ll make the steps concrete.";
  if (/\b(add|plus|sum|calculate|what is)\b/.test(lower)) {
    const match = current.match(/(-?\d+(?:\.\d+)?)\s*([+*/-])\s*(-?\d+(?:\.\d+)?)/);
    if (match) {
      const a = Number(match[1]), b = Number(match[3]);
      let result;
      if (match[2] === "+") result = a + b;
      if (match[2] === "-") result = a - b;
      if (match[2] === "*") result = a * b;
      if (match[2] === "/") result = b === 0 ? null : a / b;
      if (result !== undefined) return result === null ? "Division by zero is undefined." : String(result);
    }
  }
  if (/\b(code|javascript|python|luau|html|css|script)\b/.test(lower)) return "I can help write code, but I need to be precise about the current engine: this is a bootstrap reasoner, not a trained coding LLM, so I shouldn’t invent a full solution from a vague prompt.\n\nSend the language, the exact behaviour you want, and any existing code or error. I’ll return a focused example and explain how to verify it.";
  const context = prior.length ? "\n\nI can use recent messages included in this request, but this bootstrap version has no persistent learned knowledge or trained neural weights." : "";
  return "I understand the request: “" + current + "”\n\nThis version of Pull AI is an early self-contained bootstrap engine. It can handle a few common explanation, planning, debugging, and arithmetic patterns, but it cannot yet provide the flexible reasoning of a modern LLM. I won’t pretend it has capabilities it doesn’t have.\n\nTo make progress, give me the concrete goal, relevant context, and constraints. I’ll help structure the next step." + context;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname === "/api/health" && req.method === "GET") {
      return json(res, 200, {ok:true,name:"Pull AI",api:"Pull API v1",model:MODEL,provider:"self-owned",inference:"bootstrap-rules",trainedWeightsLoaded:false});
    }
    if (url.pathname === "/api/chat" && req.method === "POST") {
      let body = "";
      for await (const chunk of req) {
        body += chunk;
        if (body.length > MAX_BODY) return json(res, 413, {error:"Request too large (1 MB maximum)."});
      }
      let data;
      try { data = JSON.parse(body || "{}"); } catch { return json(res, 400, {error:"Invalid JSON."}); }
      if (!Array.isArray(data.messages)) return json(res, 400, {error:"messages must be an array."});
      if (data.messages.length > 80) return json(res, 400, {error:"A maximum of 80 messages is supported per request."});
      const messages = data.messages.filter(m => m && typeof m.content === "string" && ["user","assistant","system"].includes(m.role)).map(m => ({role:m.role,content:clean(m.content)}));
      const content = answer(messages);
      return json(res, 200, {id:"pull_"+Date.now().toString(36),model:"pull-1-bootstrap",choices:[{index:0,message:{role:"assistant",content},finish_reason:"stop"}],usage:{prompt_messages:messages.length,completion_characters:content.length},capabilities:{trainedLLM:false,externalProvider:false}});
    }
    if (req.method !== "GET" && req.method !== "HEAD") return json(res, 405, {error:"Method not allowed."});
    let relative = decodeURIComponent(url.pathname === "/" ? "index.html" : url.pathname.slice(1));
    relative = path.normalize(relative);
    if (relative.startsWith("..") || path.isAbsolute(relative)) return json(res, 403, {error:"Forbidden."});
    const file = path.resolve(ROOT, relative);
    if (!file.startsWith(ROOT + path.sep)) return json(res, 403, {error:"Forbidden."});
    fs.readFile(file, (err, data) => {
      if (err) return json(res, 404, {error:"Not found."});
      const types = {".html":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",".js":"text/javascript; charset=utf-8",".json":"application/json; charset=utf-8",".svg":"image/svg+xml"};
      res.writeHead(200, {"Content-Type":types[path.extname(file)] || "application/octet-stream","X-Content-Type-Options":"nosniff"});
      if (req.method === "HEAD") return res.end();
      res.end(data);
    });
  } catch (error) {
    console.error(error);
    json(res, 500, {error:"Internal Pull API error."});
  }
});
server.listen(PORT, () => console.log("Pull AI listening on port " + PORT));
