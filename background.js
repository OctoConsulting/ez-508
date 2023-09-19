//background.js
//opens onboarding.html on first install
chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === "install") {
    // console.log("This is a first install!");
    chrome.tabs.create({ url: "onboarding.html" });
  }
});

//Choosing "Current Tab" radio button or clicking "Scan" button in popup.html
//injects inject.js into current tab
//can either executeScript be replaced with function instead of files? Need to pass standards along
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // console.log(message);
  if (message.action === "injectAxe") {
    // console.log("injectAxe message received");
    // Inject the inject.js script into the active tab
    chrome.scripting.executeScript({
      target: { tabId: message.tabId },
      files: ["inject.js"],
    });
    // console.log("inject.js injected #1");
  } else if (message.action === "executeAxeScan") {
    // console.log("executeAxeScan message received");
    // there must be a better way to do this
    chrome.scripting.executeScript({
      target: { tabId: message.tabId },
      files: ["inject.js"],
    });
    // console.log("inject.js injected #2");
  }
});
