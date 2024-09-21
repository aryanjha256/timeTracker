let currentView = "daily";

document.addEventListener("DOMContentLoaded", async () => {
  await updateTimeList();
  setInterval(updateTimeList, 1000);

  document
    .getElementById("dailyBtn")
    .addEventListener("click", () => changeView("daily"));
  document
    .getElementById("weeklyBtn")
    .addEventListener("click", () => changeView("weekly"));
  document
    .getElementById("monthlyBtn")
    .addEventListener("click", () => changeView("monthly"));

  document.getElementById("exportBtn").addEventListener("click", exportData);
  document.getElementById("resetBtn").addEventListener("click", resetData);
  document
    .getElementById("blockSiteBtn")
    .addEventListener("click", blockCurrentSite);
  document
    .getElementById("showErrorsBtn")
    .addEventListener("click", toggleErrorLog);
});

async function changeView(view) {
  currentView = view;
  document
    .getElementById("dailyBtn")
    .classList.toggle("bg-indigo-500", view === "daily");
  document
    .getElementById("weeklyBtn")
    .classList.toggle("bg-indigo-500", view === "weekly");
  document
    .getElementById("monthlyBtn")
    .classList.toggle("bg-indigo-500", view === "monthly");
  document
    .getElementById("dailyBtn")
    .classList.toggle("bg-indigo-300", view !== "daily");
  document
    .getElementById("weeklyBtn")
    .classList.toggle("bg-indigo-300", view !== "weekly");
  document
    .getElementById("monthlyBtn")
    .classList.toggle("bg-indigo-300", view !== "monthly");
  await updateTimeList();
}

async function updateTimeList() {
  try {
    const data = await chrome.storage.local.get(null);
    const timeList = document.getElementById("timeList");
    const aggregatedData = aggregateData(data);
    const sortedEntries = Object.entries(aggregatedData).sort(
      (a, b) => b[1] - a[1]
    );

    timeList.innerHTML = "";

    for (const [domain, time] of sortedEntries) {
      const li = document.createElement("li");
      li.className = "flex justify-between items-center bg-gray-50 p-2 rounded";
      li.innerHTML = `
        <div class="flex items-center">
          <img src="https://www.google.com/s2/favicons?domain=${domain}" alt="${domain} favicon" class="mr-2 w-4 h-4">
          <span class="text-gray-700">${domain}</span>
        </div>
        <span class="text-indigo-500 font-medium">${formatTime(time)}</span>
      `;
      timeList.appendChild(li);
    }
  } catch (error) {
    console.error("Error loading data:", error);
    const errorMessage = document.createElement("p");
    errorMessage.textContent = "An error occurred while loading data.";
    errorMessage.className = "text-red-500 mt-4";
    document.body.appendChild(errorMessage);
  }
}

function aggregateData(data) {
  const aggregated = {};
  const today = new Date().toISOString().split("T")[0];
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];
  const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  for (const [key, value] of Object.entries(data)) {
    const [domain, date] = key.split("_");
    if (
      (currentView === "daily" && date === today) ||
      (currentView === "weekly" && date >= oneWeekAgo) ||
      (currentView === "monthly" && date >= oneMonthAgo)
    ) {
      aggregated[domain] = (aggregated[domain] || 0) + value;
    }
  }
  return aggregated;
}

function formatTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  return `${hours}h ${minutes}m ${remainingSeconds}s`;
}

async function exportData() {
  const data = await chrome.storage.local.get(null);
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  chrome.downloads.download({
    url: url,
    filename: "website_time_tracker_data.json",
  });
}

async function resetData() {
  if (
    confirm(
      "Are you sure you want to reset all data? This action cannot be undone."
    )
  ) {
    await chrome.storage.local.clear();
    updateTimeList();
  }
}

async function blockCurrentSite() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.url) {
    const url = new URL(tab.url);
    const domain = url.hostname;
    const blockedSites = await chrome.storage.local.get("blockedSites");
    const newBlockedSites = [...(blockedSites.blockedSites || []), domain];
    await chrome.storage.local.set({ blockedSites: newBlockedSites });
    alert(`${domain} has been blocked.`);
  }
}

function toggleErrorLog() {
  const errorLog = document.getElementById("errorLog");
  if (errorLog.classList.contains("hidden")) {
    chrome.storage.local.get("errorLog", (data) => {
      errorLog.textContent = data.errorLog || "No errors logged.";
      errorLog.classList.remove("hidden");
    });
  } else {
    errorLog.classList.add("hidden");
  }
}
