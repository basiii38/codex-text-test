const cache = {
  snippets: [],
  settings: { triggerKey: 'space', name: '' },
};

function refreshCache() {
  chrome.storage.sync.get(['snippets', 'settings'], (data) => {
    cache.snippets = data.snippets || [];
    cache.settings = { triggerKey: 'space', name: '', ...(data.settings || {}) };
  });
}

refreshCache();
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && (changes.snippets || changes.settings)) {
    refreshCache();
  }
});

function parseTodayMath(token) {
  const match = token.match(/today([+-]\d+)?/i);
  if (!match) return null;
  const delta = parseInt(match[1] || '0', 10);
  const date = new Date();
  date.setDate(date.getDate() + delta);
  return date.toISOString().slice(0, 10);
}

async function applyVariables(text) {
  const now = new Date();
  const time = now.toLocaleTimeString();
  const date = now.toLocaleDateString();
  let clipboard = '{clipboard}';
  try {
    clipboard = await navigator.clipboard.readText();
  } catch (err) {
    // ignore clipboard errors
  }
  return text
    .replace(/\{date\}/gi, date)
    .replace(/\{time\}/gi, time)
    .replace(/\{name\}/gi, cache.settings.name || '')
    .replace(/\{clipboard\}/gi, clipboard)
    .replace(/\{today([+-]\d+)?\}/gi, (_, offset) => parseTodayMath(`today${offset || ''}`) || date);
}

function findTriggerInInput(el, triggerKey) {
  const caret = el.selectionStart;
  const value = el.value;
  const before = value.slice(0, caret);
  const tokens = before.split(/\s/);
  const last = tokens[tokens.length - 1];
  const snippet = cache.snippets.find(s => s.trigger === last && (s.triggerKey || cache.settings.triggerKey) === triggerKey);
  return { snippet, start: before.length - last.length, end: caret };
}

function replaceInInput(el, range, content, key) {
  const value = el.value;
  const before = value.slice(0, range.start);
  const after = value.slice(range.end);
  el.value = `${before}${content}${key === 'enter' ? '\n' : ' '}${after}`;
  const pos = before.length + content.length + 1;
  el.setSelectionRange(pos, pos);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

function findTriggerInEditable(node, triggerKey) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return {};
  const range = selection.getRangeAt(0).cloneRange();
  const preCaretRange = range.cloneRange();
  preCaretRange.selectNodeContents(node);
  preCaretRange.setEnd(range.endContainer, range.endOffset);
  const text = preCaretRange.toString();
  const tokens = text.split(/\s/);
  const last = tokens[tokens.length - 1];
  const snippet = cache.snippets.find(s => s.trigger === last && (s.triggerKey || cache.settings.triggerKey) === triggerKey);
  return { snippet, text, range, last };
}

function replaceInEditable(range, last, content, key) {
  const selection = window.getSelection();
  range.setStart(range.endContainer, range.endOffset - last.length);
  range.deleteContents();
  const node = document.createElement('span');
  node.innerHTML = content + (key === 'enter' ? '<br>' : '&nbsp;');
  range.insertNode(node);
  range.setStartAfter(node);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

async function handleEvent(event) {
  const triggerKey = cache.settings.triggerKey || 'space';
  const keyMap = { space: ' ', tab: 'Tab', enter: 'Enter' };
  if (event.key !== keyMap[triggerKey]) return;

  const target = event.target;
  const isEditable = target.isContentEditable;
  const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
  if (!isEditable && !isInput) return;

  const activeTriggerKey = triggerKey;
  if (isInput) {
    const { snippet, start, end } = findTriggerInInput(target, activeTriggerKey);
    if (!snippet) return;
    event.preventDefault();
    const resolved = await applyVariables(snippet.content);
    replaceInInput(target, { start, end }, stripHtml(resolved), activeTriggerKey);
    chrome.runtime.sendMessage({ type: 'update-usage', trigger: snippet.trigger });
    return;
  }

  const { snippet, range, last } = findTriggerInEditable(target, activeTriggerKey);
  if (!snippet || !range) return;
  event.preventDefault();
  const resolved = await applyVariables(snippet.content);
  replaceInEditable(range, last, resolved, activeTriggerKey);
  chrome.runtime.sendMessage({ type: 'update-usage', trigger: snippet.trigger });
}

function stripHtml(html) {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || '';
}

document.addEventListener('keydown', handleEvent, true);
