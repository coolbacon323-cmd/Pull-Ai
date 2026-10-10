const messagesEl = document.querySelector("#messages");
const input = document.querySelector("#input");
const form = document.querySelector("#form");
const chatsEl = document.querySelector("#chats");
let history = [];
let busy = false;

function add(role, text, id) {
  const row = document.createElement("div");
  row.className = "msg " + role;
  if (id) row.dataset.messageId = id;
  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.textContent = role === "user" ? "You" : "P";
  const body = document.createElement("div");
  body.className = "body";
  body.textContent = text;
  row.append(avatar, body);
  messagesEl.append(row);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return body;
}
function setBusy(value) {
  busy = value;
  const button = form.querySelector("button");
  button.disabled = value;
  button.textContent = value ? "…" : "↑";
  input.disabled = value;
}
function newChat() {
  history = [];
  messagesEl.replaceChildren();
  const welcome = document.createElement("div");
  welcome.id = "welcome";
  welcome.className = "welcome";
  welcome.innerHTML = '<div class="mark">P</div><h1>What can Pull AI help with?</h1><p>Your own AI interface, your own API, and your own model path.</p><div class="suggest"><button type="button">Explain a concept</button><button type="button">Plan a project</button><button type="button">Review an idea</button><button type="button">Write code</button></div>';
  messagesEl.append(welcome);
  wireSuggestions();
  input.focus();
}
function wireSuggestions() {
  document.querySelectorAll(".suggest button").forEach(button => {
    button.onclick = () => {
      const prompts = {
        "Explain a concept": "Explain how neural networks learn, using a simple example.",
        "Plan a project": "Help me plan a software project from idea to tested first release.",
        "Review an idea": "Help me evaluate this idea: "
      };
      input.value = prompts[button.textContent] || "Write a small JavaScript example and explain how it works.";
      input.focus();
    };
  });
}
async function send(text) {
  text = text.trim();
  if (!text || busy) return;
  document.querySelector("#welcome")?.remove();
  history.push({ role: "user", content: text });
  add("user", text);
  input.value = "";
  setBusy(true);
  const responseBody = add("assistant", "Thinking…", "pending");
  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "pull-1", messages: history })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "HTTP " + response.status);
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) throw new Error("The API returned an empty response.");
    responseBody.textContent = content;
    history.push({ role: "assistant", content });
    responseBody.parentElement.removeAttribute("data-message-id");
    if (history.filter(m => m.role === "user").length === 1) {
      const title = text.length > 26 ? text.slice(0, 26) + "…" : text;
      const item = document.createElement("button");
      item.type = "button";
      item.textContent = title;
      item.title = text;
      item.onclick = () => alert("This prototype keeps the current conversation in memory only. Persistent multi-chat history is not implemented yet.");
      chatsEl.prepend(item);
    }
  } catch (error) {
    responseBody.textContent = "Pull API error: " + error.message + "\n\nCheck that the server is running and try again.";
  } finally {
    setBusy(false);
    input.focus();
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }
}
form.addEventListener("submit", event => {
  event.preventDefault();
  send(input.value);
});
input.addEventListener("keydown", event => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});
document.querySelector("#new").addEventListener("click", newChat);
wireSuggestions();
fetch("/api/health").then(r => r.json()).then(status => {
  const statusEl = document.querySelector(".status");
  if (statusEl && status.ok) {
    statusEl.innerHTML = "● " + status.model + "<br><small>Self-owned API · bootstrap mode</small>";
    statusEl.title = status.trainedWeightsLoaded ? "Trained model loaded" : "No trained neural weights loaded yet";
  }
}).catch(() => {
  const statusEl = document.querySelector(".status");
  if (statusEl) statusEl.innerHTML = "● API unavailable<br><small>Start the local server</small>";
});
