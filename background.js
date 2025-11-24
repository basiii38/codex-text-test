chrome.runtime.onInstalled.addListener(() => {
  console.log('Superscribe Text Expander installed');
});

chrome.action.onClicked.addListener(async () => {
  const url = chrome.runtime.getURL('dashboard.html');
  const tabs = await chrome.tabs.query({ url });
  if (tabs.length) {
    chrome.tabs.update(tabs[0].id, { active: true });
  } else {
    chrome.tabs.create({ url });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'open-dashboard') {
    const url = chrome.runtime.getURL('dashboard.html');
    chrome.tabs.create({ url });
  }
  if (message.type === 'update-usage') {
    chrome.storage.local.get(['usageLog'], (data) => {
      const usageLog = data.usageLog || {};
      const entry = usageLog[message.trigger] || { count: 0, lastUsed: null };
      usageLog[message.trigger] = {
        count: entry.count + 1,
        lastUsed: new Date().toISOString(),
      };
      chrome.storage.local.set({ usageLog });
    });
  }
  if (message.type === 'sync-snippets') {
    chrome.storage.sync.set({ snippets: message.snippets, settings: message.settings });
  }
  return false;
});
