/// <reference types="chrome"/>

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


async function setBadge(tabId: number) {

  await chrome.action.setTitle({
    tabId,
    title:  "Table Picker is ON",
  });
  // Optional badge
  await chrome.action.setBadgeText({ tabId, text:   "ON"  });
  await chrome.action.setBadgeBackgroundColor({ tabId, color: "#2ecc71" });
}


chrome.action.onClicked.addListener(async (tab) => {
  if (!tab?.id) return;
  await setBadge(tab.id);
});

chrome.action.onClicked.addListener(async (tab) => {
  try {
    if (!tab?.id) return;
    const tabId = tab.id;
    // Inject CSS first (all frames so nested iframes you can access are styled)
    await run<void>((cb) =>
      chrome.scripting.insertCSS(
        { target: { tabId, allFrames: true }, files: ["styles.css"] },
        () => cb()
      )
    );

    // Then inject the content script bundle
    await run<void>((cb) =>
      chrome.scripting.executeScript(
        { target: { tabId, allFrames: true }, files: ["dist/content.js"] },
        () => cb()
      )
    );
    } catch (e) {
    // Optional: surface errors in the service worker log
    console.error("[Table Picker] injection error:", e);
  }
});
