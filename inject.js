//inject.js
//if axe.min.js is not already injected, inject it
//if axe.min.js is already injected, inject script.js

// Inject the axe.min.js script into the page
if (!document.querySelector("#axeScript")) {
  // console.log("axeScript not yet injected");
  const axeScript = document.createElement("script");
  axeScript.id = "axeScript";
  axeScript.src = chrome.runtime.getURL("axe.min.js");
  document.body.appendChild(axeScript);
  // console.log("axe.min.js injected");
  // Notify the background script that axe.min.js is injected
  chrome.runtime.sendMessage({ action: "axeInjected" });
  // console.log("axeInjected message sent");
} else {
  if (document.querySelector("#script")) {
    document.querySelector("#script").remove();
  }
  // console.log("axeScript already injected, attempting to trigger axe.run()");
  const script = document.createElement("script");
  script.id = "script";
  script.src = chrome.runtime.getURL("script.js");
  document.body.appendChild(script);
  // console.log("script.js injected");
}

function handleCustomAxeResults(event) {
  // console.log("customAxeResults message received");
  chrome.runtime.sendMessage({
    action: "displayResults",
    results: event.detail,
  });

  // Remove the event listener after processing the event
  document.removeEventListener("customAxeResults", handleCustomAxeResults);
}

//custom event listener to receive axe.run() results from script.js to pass to popup.js
document.addEventListener("customAxeResults", handleCustomAxeResults);
