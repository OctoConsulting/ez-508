//background.js
//opens onboarding.html on first install

//AWS Lambda helper/middleware function to send inquiry to OpenAI API and relay response, keeping API key secure
//TODO: implement some kind of auth only allowing requests from this extension
const helpApi =
  "https://7j1yq207qb.execute-api.us-east-2.amazonaws.com/default/ez508-gpt-responder";

// Send a request to the help API and return the response
// note: sometimes response ends with "For further assistance..." - either prevent that from being part of the response
// or figure out a way to enable a conversation vs just a one-time response if that's desired functionality
async function getHelp(helpText) {
  const payload = {
    message: `Do not prompt me for further information or interaction, this is a single query and response only.
    
    ${helpText}`,
  };

  // Fetch the API response
  const response = await fetch(helpApi, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.status === 200) {
    throw new Error("Failed to fetch help data");
  }

  // Get the response data
  const responseData = await response.json();

  return responseData.message;
}

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === "install") {
    chrome.tabs.create({ url: "onboarding.html" });
  }
});

chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.action == "axeResultsCurrentTab") {
    let [currentTab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (currentTab?.id) {
      chrome.action.setBadgeBackgroundColor({ color: "#292929", tabId: currentTab.id });
      chrome.action.setBadgeText({text: `${message.data?.violations?.length}`, tabId: currentTab.id});
      // await chrome.storage.sync.set({ "scan-results-latest": { results: message.data, tabId: currentTab.id } })
    }
  } else if (message.action == "getAiInsight") {
    let response = await getHelp(message.helpText)
    let [currentTab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    chrome.tabs.sendMessage(currentTab.id, { action: "sendAiInsight", response: response, tabId: currentTab.id });
  }
});
