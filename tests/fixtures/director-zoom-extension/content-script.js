"use strict";

(async () => {
  const requested = Number(new URL(location.href).searchParams.get("director_zoom"));
  if (!Number.isFinite(requested) || requested === 1) return;
  const publish = evidence => {
    const meta = document.createElement("meta");
    meta.name = "director-browser-zoom-evidence";
    meta.content = JSON.stringify(evidence);
    (document.head || document.documentElement).append(meta);
    document.documentElement.dataset.directorBrowserZoomStatus = evidence.status || "not-run";
  };
  try {
    const evidence = await chrome.runtime.sendMessage({ type: "DIRECTOR_SET_BROWSER_ZOOM", zoom: requested });
    publish(evidence || {
      status: "not-run", requested, actual: null, source: "chrome.tabs.getZoom",
      reason: "The extension service worker returned no evidence."
    });
  } catch (error) {
    publish({
      status: "not-run", requested, actual: null, source: "chrome.tabs.getZoom",
      reason: String(error?.message || error)
    });
  }
})();
