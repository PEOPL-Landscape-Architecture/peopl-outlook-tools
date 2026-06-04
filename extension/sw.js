/* Background service worker.
 * Makes the toolbar icon open the docked side panel (which stays open while you
 * work in Outlook), instead of a popup that closes on click-away. */
function enablePanel() {
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(function () {});
  }
}

chrome.runtime.onInstalled.addListener(enablePanel);
if (chrome.runtime.onStartup) chrome.runtime.onStartup.addListener(enablePanel);
enablePanel();
