"use strict";

function lastErrorMessage() {
  return chrome.runtime.lastError ? chrome.runtime.lastError.message : null;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "DIRECTOR_SET_BROWSER_ZOOM") return false;
  const requested = Number(message.zoom);
  const tabId = sender.tab?.id;
  if (!Number.isFinite(requested) || requested < 0.25 || requested > 5 || !Number.isInteger(tabId)) {
    sendResponse({
      status: "not-run", requested: Number.isFinite(requested) ? requested : null,
      actual: null, tabId: Number.isInteger(tabId) ? tabId : null,
      source: "chrome.tabs.getZoom", reason: "Invalid zoom request or missing sender tab id."
    });
    return false;
  }
  chrome.tabs.setZoomSettings(tabId, { mode: "automatic", scope: "per-tab" }, () => {
    const settingsError = lastErrorMessage();
    chrome.tabs.setZoom(tabId, requested, () => {
      const setZoomError = lastErrorMessage();
      chrome.tabs.getZoom(tabId, actual => {
        const getZoomError = lastErrorMessage();
        const applied = !setZoomError && !getZoomError &&
          Number.isFinite(actual) && Math.abs(actual - requested) < 0.0001;
        sendResponse({
          status: applied ? "applied" : "not-run",
          requested, actual: Number.isFinite(actual) ? actual : null, tabId,
          settingsError, setZoomError, getZoomError,
          source: "chrome.tabs.setZoom + chrome.tabs.getZoom"
        });
      });
    });
  });
  return true;
});
