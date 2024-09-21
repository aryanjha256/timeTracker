chrome.runtime.onInstalled.addListener(() => {
  chrome.declarativeContent.onPageChanged.removeRules(undefined, () => {
    chrome.declarativeContent.onPageChanged.addRules([
      {
        conditions: [new chrome.declarativeContent.PageStateMatcher({})],
        actions: [new chrome.declarativeContent.ShowAction()],
      },
    ]);
  });
});

let currentTab = null;
let startTime = null;

function shouldTrackURL(url) {
  const untracked_urls = [
    "chrome://",
    "chrome-extension://",
    "chrome-search://",
    "chrome-devtools://",
    "about:",
    "edge://",
    "brave://",
    "opera://",
    "vivaldi://",
    "file://",
  ];

  return !untracked_urls.some((prefix) => url.startsWith(prefix));
}

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  await updateTimeForPreviousTab();
  const tab = await chrome.tabs.get(activeInfo.tabId);
  if (tab.url && shouldTrackURL(tab.url)) {
    currentTab = tab;
    startTime = new Date();
  } else {
    currentTab = null;
    startTime = null;
  }
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tabId === currentTab?.id) {
    await updateTimeForPreviousTab();
    if (tab.url && shouldTrackURL(tab.url)) {
      currentTab = tab;
      startTime = new Date();
    } else {
      currentTab = null;
      startTime = null;
    }
  }
});

async function updateTimeForPreviousTab() {
  if (currentTab && startTime && shouldTrackURL(currentTab.url)) {
    try {
      const url = new URL(currentTab.url);
      const domain = url.hostname;
      const timeSpent = Math.round((new Date() - startTime) / 1000);
      const date = new Date().toISOString().split("T")[0];
      const key = `${domain}_${date}`;
      const data = await chrome.storage.local.get(key);
      const currentTime = data[key] || 0;
      await chrome.storage.local.set({ [key]: currentTime + timeSpent });
    } catch (error) {
      console.error("Error updating time for previous tab:", error);
      chrome.runtime.sendMessage({
        action: "logError",
        error: error.toString(),
      });
    }
  }
}

// Periodically update time for current tab
setInterval(updateTimeForPreviousTab, 1000);

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "logError") {
    chrome.storage.local.get("errorLog", (data) => {
      const currentLog = data.errorLog || "";
      const newLog = `${new Date().toISOString()}: ${request.error}\n${currentLog}`;
      chrome.storage.local.set({ errorLog: newLog });
    });
  }
});

// Add this function to check for blocked sites
async function checkBlockedSites(tabId, changeInfo, tab) {
  if (changeInfo.status === "complete" && tab.url) {
    const url = new URL(tab.url);
    const domain = url.hostname;
    const { blockedSites } = await chrome.storage.local.get("blockedSites");
    if (blockedSites && blockedSites.includes(domain)) {
      chrome.tabs.update(tabId, { url: "blocked.html" });
    }
  }
}

chrome.tabs.onUpdated.addListener(checkBlockedSites);
