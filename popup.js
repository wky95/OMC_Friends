const area = document.getElementById('list');
chrome.storage.local.get(['omc_friends'], (res) => {
  if (res.omc_friends) area.value = res.omc_friends.join('\n');
});

document.getElementById('saveBtn').onclick = () => {
  const list = area.value.split('\n').map(s => s.trim()).filter(s => s);
  chrome.storage.local.set({ omc_friends: list }, () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) chrome.tabs.reload(tabs[0].id);
      window.close();
    });
  });
};