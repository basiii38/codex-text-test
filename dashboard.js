const state = {
  snippets: [],
  editId: null,
  settings: {
    triggerKey: 'space',
    theme: 'light',
    name: '',
    supabase: {
      url: '',
      key: '',
      email: '',
      password: '',
    },
    lastSync: null,
  },
};

const editor = document.getElementById('editor');
const snippetList = document.getElementById('snippetList');
const globalSearch = document.getElementById('globalSearch');
const form = document.getElementById('snippetForm');

const supabaseScript = document.createElement('script');
supabaseScript.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js';

const supabaseReady = new Promise((resolve) => {
  supabaseScript.addEventListener('load', () => resolve(true));
  supabaseScript.addEventListener('error', () => resolve(false));
});

document.head.appendChild(supabaseScript);

function uuid() {
  return crypto.randomUUID ? crypto.randomUUID() : Date.now().toString();
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  state.settings.theme = theme;
  chrome.storage.sync.set({ settings: state.settings });
}

function formatContent(command, value = null) {
  if (command === 'createLink') {
    const url = prompt('Enter URL');
    if (url) document.execCommand(command, false, url);
    return;
  }
  if (command === 'formatBlock') {
    document.execCommand(command, false, value);
    return;
  }
  document.execCommand(command, false, value);
}

function getFormData() {
  return {
    id: state.editId || uuid(),
    title: document.getElementById('title').value.trim(),
    trigger: document.getElementById('trigger').value.trim(),
    folder: document.getElementById('folder').value.trim(),
    tags: document.getElementById('tags').value.split(',').map(t => t.trim()).filter(Boolean),
    color: document.getElementById('color').value,
    triggerKey: document.getElementById('triggerKey').value,
    name: document.getElementById('userName').value,
    content: editor.innerHTML,
    usageCount: state.editId ? (state.snippets.find(s => s.id === state.editId)?.usageCount || 0) : 0,
    lastUsed: state.editId ? (state.snippets.find(s => s.id === state.editId)?.lastUsed || null) : null,
  };
}

function resetForm() {
  state.editId = null;
  form.reset();
  editor.innerHTML = '';
  document.getElementById('formTitle').innerText = 'Create snippet';
  document.getElementById('saveSnippet').innerText = 'Save snippet';
}

function renderSnippets(filter = '') {
  snippetList.innerHTML = '';
  const normalized = filter.toLowerCase();
  const frag = document.createDocumentFragment();
  const template = document.getElementById('snippetTemplate');

  state.snippets
    .filter(s => s.title.toLowerCase().includes(normalized) || s.trigger.toLowerCase().includes(normalized) || s.tags.join(' ').toLowerCase().includes(normalized))
    .forEach(snippet => {
      const node = template.content.cloneNode(true);
      node.querySelector('.trigger-value').textContent = snippet.trigger;
      node.querySelector('.title').textContent = snippet.title;
      const usage = snippet.usageCount ? `${snippet.usageCount} uses` : 'New';
      const last = snippet.lastUsed ? new Date(snippet.lastUsed).toLocaleString() : '—';
      node.querySelector('.meta').textContent = `${snippet.folder || 'General'} · ${snippet.tags.join(', ') || 'No tags'} · Key: ${snippet.triggerKey} · ${usage} · Last: ${last}`;
      node.querySelector('.content-preview').innerHTML = snippet.content;
      node.querySelector('.badge').style.background = snippet.color || 'var(--accent)';
      node.querySelector('[data-action="edit"]').addEventListener('click', () => loadSnippet(snippet.id));
      node.querySelector('[data-action="delete"]').addEventListener('click', () => deleteSnippet(snippet.id));
      node.querySelector('[data-action="duplicate"]').addEventListener('click', () => duplicateSnippet(snippet.id));
      frag.appendChild(node);
    });

  snippetList.appendChild(frag);
  document.getElementById('statTotal').innerText = state.snippets.length;
  document.getElementById('statSync').innerText = state.settings.lastSync ? new Date(state.settings.lastSync).toLocaleString() : 'Never';
}

function saveState() {
  chrome.storage.sync.set({ snippets: state.snippets, settings: state.settings });
  chrome.runtime.sendMessage({ type: 'sync-snippets', snippets: state.snippets, settings: state.settings });
}

function loadSnippet(id) {
  const snippet = state.snippets.find(s => s.id === id);
  if (!snippet) return;
  state.editId = snippet.id;
  document.getElementById('title').value = snippet.title;
  document.getElementById('trigger').value = snippet.trigger;
  document.getElementById('folder').value = snippet.folder;
  document.getElementById('tags').value = snippet.tags.join(', ');
  document.getElementById('color').value = snippet.color;
  document.getElementById('triggerKey').value = snippet.triggerKey || 'space';
  document.getElementById('userName').value = snippet.name || '';
  editor.innerHTML = snippet.content;
  document.getElementById('formTitle').innerText = 'Edit snippet';
  document.getElementById('saveSnippet').innerText = 'Update snippet';
}

function deleteSnippet(id) {
  state.snippets = state.snippets.filter(s => s.id !== id);
  saveState();
  renderSnippets(globalSearch.value);
}

function duplicateSnippet(id) {
  const snippet = state.snippets.find(s => s.id === id);
  if (!snippet) return;
  const copy = { ...snippet, id: uuid(), title: `${snippet.title} copy`, trigger: `${snippet.trigger}_copy`, usageCount: 0 };
  state.snippets.push(copy);
  saveState();
  renderSnippets(globalSearch.value);
}

function hydrate(data) {
  state.snippets = data.snippets || [];
  state.settings = { ...state.settings, ...(data.settings || {}) };
  document.getElementById('triggerKey').value = state.settings.triggerKey || 'space';
  applyTheme(state.settings.theme || 'light');
  document.getElementById('userName').value = state.settings.name || '';
  document.getElementById('supabaseUrl').value = state.settings.supabase?.url || '';
  document.getElementById('supabaseKey').value = state.settings.supabase?.key || '';
  document.getElementById('supabaseEmail').value = state.settings.supabase?.email || '';
  renderSnippets();
}

function applyUsageLog(log) {
  state.snippets = state.snippets.map(snippet => ({
    ...snippet,
    usageCount: log[snippet.trigger]?.count || snippet.usageCount || 0,
    lastUsed: log[snippet.trigger]?.lastUsed || snippet.lastUsed || null,
  }));
  renderSnippets(globalSearch.value);
}

async function exportJson() {
  const data = JSON.stringify(state.snippets, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'snippets.json';
  a.click();
  URL.revokeObjectURL(url);
}

function toCsv(snippets) {
  const headers = ['title', 'trigger', 'folder', 'tags', 'color', 'content'];
  const rows = snippets.map(s => headers.map(h => JSON.stringify(h === 'tags' ? s[h].join('|') : s[h] || '')).join(','));
  return [headers.join(','), ...rows].join('\n');
}

async function exportCsv() {
  const data = toCsv(state.snippets);
  const blob = new Blob([data], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'snippets.csv';
  a.click();
  URL.revokeObjectURL(url);
}

function importFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      let snippets = [];
      if (file.name.endsWith('.json')) {
        snippets = JSON.parse(reader.result);
      } else {
        const [headerLine, ...rows] = reader.result.split(/\r?\n/);
        const headers = headerLine.split(',');
        snippets = rows.filter(Boolean).map(row => {
          const cols = row.split(',');
          const entry = {};
          headers.forEach((h, i) => entry[h] = cols[i]?.replace(/^"|"$/g, ''));
          return {
            id: uuid(),
            title: entry.title,
            trigger: entry.trigger,
            folder: entry.folder,
            tags: (entry.tags || '').split('|').filter(Boolean),
            color: entry.color || '#63d6ab',
            content: entry.content || '',
            triggerKey: 'space',
          };
        });
      }
      state.snippets = [...state.snippets, ...snippets];
      saveState();
      renderSnippets(globalSearch.value);
    } catch (err) {
      alert('Import failed: ' + err.message);
    }
  };
  reader.readAsText(file);
}

function setupToolbar() {
  document.querySelectorAll('.toolbar button[data-command]').forEach(btn => {
    btn.addEventListener('click', () => {
      const command = btn.dataset.command;
      const value = btn.dataset.value || null;
      formatContent(command, value);
      editor.focus();
    });
  });
  document.getElementById('emojiBtn').addEventListener('click', () => {
    const emoji = prompt('Emoji to insert');
    if (emoji) document.execCommand('insertText', false, emoji);
  });
}

function setupSearch() {
  globalSearch.addEventListener('input', () => renderSnippets(globalSearch.value));
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.code === 'Space') {
      e.preventDefault();
      globalSearch.focus();
    }
  });
}

function syncStatus(message) {
  const el = document.getElementById('syncStatus');
  el.textContent = message;
}

async function initSupabaseClient() {
  const loaded = await supabaseReady;
  if (!loaded || !window.supabase || !state.settings.supabase.url || !state.settings.supabase.key) return null;
  return window.supabase.createClient(state.settings.supabase.url, state.settings.supabase.key);
}

async function performSupabaseSync(direction = 'pull') {
  const client = await initSupabaseClient();
  if (!client) {
    syncStatus('Supabase unavailable');
    return;
  }
  syncStatus('Syncing…');
  try {
    if (direction === 'pull') {
      const { data, error } = await client.from('snippets').select();
      if (error) throw error;
      if (Array.isArray(data)) {
        state.snippets = data.map(row => ({ ...row, id: row.id || uuid() }));
        state.settings.lastSync = new Date().toISOString();
        saveState();
        renderSnippets(globalSearch.value);
      }
    } else {
      const payload = state.snippets.map(s => ({ ...s, id: s.id || uuid() }));
      const { error } = await client.from('snippets').upsert(payload, { onConflict: 'id' });
      if (error) throw error;
      state.settings.lastSync = new Date().toISOString();
      saveState();
    }
    document.getElementById('syncLog').textContent = `Last sync ${new Date().toLocaleString()}`;
    syncStatus('Synced');
  } catch (err) {
    console.error(err);
    syncStatus('Sync error');
    document.getElementById('syncLog').textContent = err.message;
  }
}

function initEvents() {
  document.getElementById('themeToggle').addEventListener('click', () => {
    const next = state.settings.theme === 'light' ? 'dark' : 'light';
    state.settings.theme = next;
    applyTheme(next);
  });

  document.getElementById('newSnippet').addEventListener('click', resetForm);
  document.getElementById('resetForm').addEventListener('click', resetForm);

  document.getElementById('triggerKey').addEventListener('change', (e) => {
    state.settings.triggerKey = e.target.value;
    saveState();
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = getFormData();
    if (state.editId) {
      state.snippets = state.snippets.map(s => s.id === state.editId ? data : s);
    } else {
      state.snippets.push(data);
    }
    state.settings.triggerKey = data.triggerKey;
    state.settings.name = data.name;
    saveState();
    renderSnippets(globalSearch.value);
    resetForm();
  });

  document.getElementById('importFile').addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (file) importFile(file);
  });

  document.getElementById('exportJson').addEventListener('click', exportJson);
  document.getElementById('exportCsv').addEventListener('click', exportCsv);

  document.getElementById('supabaseSignIn').addEventListener('click', async () => {
    state.settings.supabase.url = document.getElementById('supabaseUrl').value.trim();
    state.settings.supabase.key = document.getElementById('supabaseKey').value.trim();
    state.settings.supabase.email = document.getElementById('supabaseEmail').value.trim();
    state.settings.supabase.password = document.getElementById('supabasePassword').value.trim();
    const client = await initSupabaseClient();
    if (!client) {
      syncStatus('Supabase config missing');
      return;
    }
    const { error } = await client.auth.signInWithPassword({ email: state.settings.supabase.email, password: state.settings.supabase.password });
    syncStatus(error ? error.message : 'Signed in');
    saveState();
  });

  document.getElementById('supabaseSync').addEventListener('click', () => performSupabaseSync('pull'));
  document.getElementById('supabaseExport').addEventListener('click', () => performSupabaseSync('push'));

  document.getElementById('globalSearch').addEventListener('input', () => renderSnippets(globalSearch.value));
}

function restore() {
  chrome.storage.sync.get(['snippets', 'settings'], (data) => {
    hydrate(data);
  });
  chrome.storage.local.get(['usageLog'], (data) => applyUsageLog(data.usageLog || {}));
}

supabaseReady.then((loaded) => {
  if (!loaded) {
    syncStatus('Supabase library failed to load');
  }
});

setupToolbar();
setupSearch();
initEvents();
restore();
