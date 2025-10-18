/// <reference types="chrome"/>
type TabId = number;
const enabledTabs = new Map<TabId, boolean>();

// Tiny helper to run chrome.scripting with proper error handling
function run<T>(fn: (cb: (res?: T) => void) => void): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    fn((res?: T) => {
      const err = chrome.runtime.lastError;
      if (err) reject(err);
      else resolve(res);
    });
  });
}


function iconPaths(on: boolean) {
  return on
    ? {
        16: "../icons/icon16-on.png",
        48: "../icons/icon48-on.png",
        128: "../icons/icon128-on.png",
      }
    : {
        16: "../icons/icon16.png",
        48: "../icons/icon48.png",
        128: "../icons/icon128.png",
      };
}

async function setIcon(tabId: number, on: boolean) {
  await chrome.action.setIcon({ tabId, path: iconPaths(on) });

  await chrome.action.setTitle({
    tabId,
    title: on ? "Table Picker: ON (click to disable)" : "Table Picker: OFF (click to enable)",
  });
  // Optional badge
  await chrome.action.setBadgeText({ tabId, text: on ? "ON" : "" });
  await chrome.action.setBadgeBackgroundColor({ tabId, color: "#2ecc71" });
}

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  const isOn = !!enabledTabs.get(tabId);
  await setIcon(tabId, isOn);
});

chrome.action.onClicked.addListener(async (tab) => {
  try {
    if (!tab?.id) return;

    // Inject CSS first (all frames so nested iframes you can access are styled)
    await run<void>((cb) =>
      chrome.scripting.insertCSS(
        { target: { tabId: tab.id, allFrames: true }, files: ["styles.css"] },
        () => cb()
      )
    );

    // Then inject the content script bundle
    await run<void>((cb) =>
      chrome.scripting.executeScript(
        { target: { tabId: tab.id, allFrames: true }, files: ["dist/content.js"] },
        () => cb()
      )
    );
  } catch (e) {
    // Optional: surface errors in the service worker log
    console.error("[Table Picker] injection error:", e);
  }
});
