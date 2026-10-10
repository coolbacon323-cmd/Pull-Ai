const $ = (id) => document.getElementById(id);
const state = { files:{}, currentFile:'main.py', datasets:[], health:null, dirty:false, chatBusy:false };
const fileTabs = $('fileTabs');
const editor = $('codeEditor');
let toastTimer;

async function api(url, options={}) {
  const response = await fetch(url, { ...options, headers:{ 'Content-Type':'application/json', ...(options.headers||{}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Request failed (' + response.status + ').');
  return data;
}
function toast(message) {
  const node = $('toast'); node.textContent = message; node.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => node.classList.remove('show'), 2800);
}
function languageFor(name) {
  const ext = name.split('.').pop().toLowerCase();
  return ({py:'Python',js:'JavaScript',ts:'TypeScript',html:'HTML',css:'CSS',json:'JSON',md:'Markdown',txt:'Text',sh:'Shell'}[ext] || 'Text');
}
function markDirty() { state.dirty = true; $('saveState').textContent = 'Unsaved changes'; }
function renderFiles() {
  fileTabs.replaceChildren();
  Object.keys(state.files).forEach(name => {
    const button = document.createElement('button');
    button.className = 'file-tab' + (name === state.currentFile ? ' active' : '');
    button.textContent = name;
    button.title = name;
    button.addEventListener('click', () => {
      if (state.dirty && !confirm('Discard unsaved editor changes? Save the project first if you want to keep them.')) return;
      state.files[state.currentFile] = editor.value;
      state.currentFile = name; editor.value = state.files[name] || '';
      state.dirty = false; $('saveState').textContent = 'All changes saved'; renderFiles(); updateEditorInfo();
    });
    fileTabs.append(button);
  });
  updateEditorInfo();
}
function updateEditorInfo() {
  $('fileInfo').textContent = state.currentFile + ' · ' + languageFor(state.currentFile);
  updateLineNumbers();
}
function updateLineNumbers() {
  const count = Math.max(1, editor.value.split('\n').length);
  $('lineNumbers').textContent = Array.from({length:count}, (_,i)=>i+1).join('\n');
  $('lineNumbers').scrollTop = editor.scrollTop;
}
function syncEditor() { state.files[state.currentFile] = editor.value; updateLineNumbers(); }
async function loadWorkspace() {
  const result = await api('/api/workspace');
  state.files = result.files || {};
  state.currentFile = Object.keys(state.files)[0] || 'main.py';
  if (!state.files[state.currentFile]) state.files[state.currentFile] = '';
  editor.value = state.files[state.currentFile];
  state.dirty = false; $('saveState').textContent = 'All changes saved'; renderFiles();
  $('filesStat').textContent = Object.keys(state.files).length;
}
async function saveWorkspace(silent=false) {
  syncEditor();
  const result = await api('/api/workspace', {method:'PUT', body:JSON.stringify({files:state.files})});
  state.dirty = false; $('saveState').textContent = 'Saved just now';
  $('filesStat').textContent = result.files;
  if (!silent) toast('Project saved to the backend.');
}
async function refreshHealth() {
  try {
    state.health = await api('/api/health');
    $('backendStatus').textContent = 'Backend online';
    $('modelStatus').textContent = state.health.modelLoaded ? 'Trained model loaded' : 'Bootstrap model';
    $('dataStat').textContent = state.health.datasetCount;
    $('filesStat').textContent = state.health.workspaceFiles;
    $('datasetBadge').textContent = state.health.datasetCount;
    $('modelChip').textContent = state.health.modelLoaded ? 'TRAINED BIGRAM' : 'BOOTSTRAP';
    $('vocabStat').textContent = state.health.vocabularySize || '—';
  } catch {
    $('backendStatus').textContent = 'Backend unavailable';
    $('modelStatus').textContent = 'Run npm start';
  }
}
function switchView(view) {
  document.querySelectorAll('.view').forEach(node => node.classList.toggle('active', node.id === 'view-' + view));
  document.querySelectorAll('.nav-item').forEach(node => node.classList.toggle('active', node.dataset.view === view));
  $('viewTitle').textContent = ({code:'Code Studio',assistant:'AI Assistant',training:'Training Lab'})[view] || 'Code Studio';
}
async function loadDatasets() {
  const result = await api('/api/datasets'); state.datasets = result.datasets || [];
  renderDatasets(); $('dataStat').textContent = state.datasets.length;
  $('datasetBadge').textContent = state.datasets.length;
}
function renderDatasets() {
  $('datasetCount').textContent = state.datasets.length + (state.datasets.length === 1 ? ' dataset' : ' datasets');
  const list = $('datasetList'); list.replaceChildren();
  if (!state.datasets.length) {
    const empty = document.createElement('p'); empty.className = 'muted'; empty.textContent = 'No datasets yet. Add your first training example above.'; list.append(empty); return;
  }
  state.datasets.forEach(dataset => {
    const item = document.createElement('div'); item.className = 'dataset-item';
    const info = document.createElement('div'); const name = document.createElement('b'); name.textContent = dataset.name;
    const details = document.createElement('small'); details.textContent = (dataset.text || '').length.toLocaleString() + ' characters · ' + new Date(dataset.createdAt).toLocaleDateString();
    info.append(name, details);
    const remove = document.createElement('button'); remove.className = 'delete-dataset'; remove.textContent = 'Delete';
    remove.addEventListener('click', async () => {
      if (!confirm('Delete dataset "' + dataset.name + '"?')) return;
      try { await api('/api/datasets/' + encodeURIComponent(dataset.id), {method:'DELETE'}); await loadDatasets(); await refreshHealth(); toast('Dataset deleted.'); }
      catch (error) { toast(error.message); }
    });
    item.append(info, remove); list.append(item);
  });
}
function appendChat(role, text) {
  const row = document.createElement('div'); row.className = 'chat-message ' + role;
  const avatar = document.createElement('div'); avatar.className = 'message-avatar'; avatar.textContent = role === 'assistant' ? 'P' : 'Y';
  const content = document.createElement('div'); const title = document.createElement('b'); title.textContent = role === 'assistant' ? 'Power AI' : 'You';
  const p = document.createElement('p'); p.textContent = text; content.append(title,p); row.append(avatar,content); $('chatLog').append(row);
  $('chatLog').scrollTop = $('chatLog').scrollHeight;
}
async function sendChat(message) {
  const text = message.trim(); if (!text || state.chatBusy) return;
  state.chatBusy = true; appendChat('user',text);
  const placeholder = document.createElement('div'); placeholder.className='chat-message assistant'; placeholder.textContent='Power AI is thinking…'; $('chatLog').append(placeholder);
  try {
    const result = await api('/api/chat',{method:'POST',body:JSON.stringify({message:text})});
    placeholder.remove(); appendChat('assistant',result.reply + (result.warning ? '\n\nNote: ' + result.warning : ''));
  } catch (error) { placeholder.remove(); appendChat('assistant','Request failed: ' + error.message); }
  finally { state.chatBusy = false; }
}

editor.addEventListener('input', () => { syncEditor(); markDirty(); });
editor.addEventListener('scroll', () => { $('lineNumbers').scrollTop = editor.scrollTop; });
editor.addEventListener('keydown', event => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); saveWorkspace().catch(error=>toast(error.message)); }
  if (event.key === 'Tab') { event.preventDefault(); const start=editor.selectionStart,end=editor.selectionEnd; editor.setRangeText('    ',start,end,'end'); syncEditor(); markDirty(); }
});
$('saveBtn').addEventListener('click', () => saveWorkspace().catch(error=>toast(error.message)));
$('addFileBtn').addEventListener('click', () => {
  const name = prompt('New filename (letters, numbers, dot, dash and underscore):','new_file.py');
  if (!name) return;
  if (!/^[\w.-]{1,80}$/.test(name) || name === '.' || name === '..') return toast('Invalid filename.');
  if (Object.hasOwn(state.files,name)) return toast('That file already exists.');
  if (Object.keys(state.files).length >= 40) return toast('Maximum 40 files per project.');
  syncEditor(); state.files[name]=''; state.currentFile=name; editor.value=''; markDirty(); renderFiles(); toast('File added. Save the project to persist it.');
});
$('newProject').addEventListener('click', async () => {
  if (!confirm('Replace this workspace with a fresh starter project?')) return;
  state.files={'main.py':'def main():\n    print("Hello from Power AI")\n\nif __name__ == "__main__":\n    main()\n','README.md':'# New Power AI project\n'};
  state.currentFile='main.py'; editor.value=state.files[state.currentFile]; markDirty(); renderFiles();
  try { await saveWorkspace(true); toast('Fresh workspace created.'); } catch(error) { toast(error.message); }
});
document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>switchView(button.dataset.view)));
document.querySelectorAll('[data-go]').forEach(button=>button.addEventListener('click',()=>switchView(button.dataset.go)));
$('refreshBtn').addEventListener('click', async()=>{await refreshHealth(); await loadDatasets().catch(()=>{}); toast('Status refreshed.');});
$('askQuick').addEventListener('click', async()=>{
  const prompt=$('quickPrompt').value.trim(); if(!prompt) return toast('Enter a question first.');
  $('askQuick').disabled=true; $('quickAnswer').classList.remove('hidden'); $('quickAnswer').textContent='Thinking…';
  try { const result=await api('/api/chat',{method:'POST',body:JSON.stringify({message:prompt})}); $('quickAnswer').textContent=result.reply; }
  catch(error){$('quickAnswer').textContent=error.message;}
  finally{$('askQuick').disabled=false;}
});
$('chatForm').addEventListener('submit',async event=>{
  event.preventDefault(); const input=$('chatInput'); const text=input.value; input.value=''; await sendChat(text);
});
$('chatInput').addEventListener('keydown',event=>{
  if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();$('chatForm').requestSubmit();}
});
$('datasetForm').addEventListener('submit',async event=>{
  event.preventDefault(); const button=event.submitter; button.disabled=true;
  try {
    await api('/api/datasets',{method:'POST',body:JSON.stringify({name:$('datasetName').value,text:$('datasetText').value})});
    $('datasetText').value=''; await loadDatasets(); await refreshHealth(); toast('Dataset added and saved.');
  } catch(error){toast(error.message);}
  finally{button.disabled=false;}
});
$('trainBtn').addEventListener('click',async()=>{
  const button=$('trainBtn'); button.disabled=true; button.textContent='Training…';
  $('trainingState').classList.remove('hidden'); $('trainingState').querySelector('h3').textContent='Training model…'; $('trainingState').querySelector('p').textContent='Counting token transitions and saving the model locally.';
  $('trainingMetrics').classList.add('hidden');
  try {
    const result=await api('/api/train',{method:'POST',body:'{}'});
    const s=result.stats;
    $('trainingState').querySelector('h3').textContent='Training complete';
    $('trainingState').querySelector('p').textContent=result.note;
    $('trainingMetrics').classList.remove('hidden');
    $('metricTokens').textContent=s.tokenCount.toLocaleString();
    $('metricVocab').textContent=s.vocabularySize.toLocaleString();
    $('metricSets').textContent=s.datasetCount;
    $('metricTime').textContent=new Date(s.trainedAt).toLocaleTimeString();
    $('vocabStat').textContent=s.vocabularySize; $('modelChip').textContent='TRAINED BIGRAM';
    await refreshHealth(); toast('Training finished. Model saved on the backend.');
  } catch(error){$('trainingState').querySelector('h3').textContent='Training failed';$('trainingState').querySelector('p').textContent=error.message;toast(error.message);}
  finally{button.disabled=false;button.textContent='▶ Train model';}
});
$('testModelBtn').addEventListener('click',async()=>{
  const prompt=$('testPrompt').value.trim(); if(!prompt)return toast('Enter a prompt first.');
  const output=$('testOutput'); output.classList.remove('hidden'); output.textContent='Generating…';
  try {const result=await api('/api/chat',{method:'POST',body:JSON.stringify({message:prompt})});output.textContent='Mode: '+result.mode+'\n\n'+result.reply+(result.warning?'\n\n'+result.warning:'');}
  catch(error){output.textContent=error.message;}
});
window.addEventListener('beforeunload',event=>{if(state.dirty){event.preventDefault();event.returnValue='';}});
(async()=>{
  try { await loadWorkspace(); await loadDatasets(); await refreshHealth(); }
  catch(error){toast('Backend could not load: ' + error.message); $('backendStatus').textContent='Backend unavailable';}
})();
