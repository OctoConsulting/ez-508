//popup.js
const scanBtn = document.getElementById("scan");
const aboutBtn = document.getElementById("about");
const currentTabRadioBtn = document.getElementById("currentTab");
const popupRadioBtn = document.getElementById("popup");
let [currentTab] = await chrome.tabs.query({
  active: true,
  currentWindow: true,
});

//AWS Lambda helper/middleware function to send inquiry to OpenAI API and relay response, keeping API key secure
//TODO: implement some kind of auth only allowing requests from this extension
const helpApi =
  "https://7j1yq207qb.execute-api.us-east-2.amazonaws.com/default/ez508-gpt-responder";
let selectedStandards;
let scanTarget;

aboutBtn.addEventListener("click", openOnboarding);

function openOnboarding() {
  chrome.runtime.openOptionsPage();
}

if (currentTab.url.includes("chrome://")) {
  currentTabRadioBtn.disabled = true;
} else {
  currentTabRadioBtn.disabled = false;
}

//onMessage listener - picks up results from scan of current tab and displays them in popup.html
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // console.log(message);
  if (message.action === "displayResults") {
    // console.log("displayResults message received");
    // console.log(message.results);
    displayResults(message.results);
  }
});

//listener on currentTabRadioBtn to inject inject.js into current tab when chosen
//TODO: make this stop triggering axe scan if clicked a second time? due to how inject.js is set up
// if button is disabled that kind of helps but if user clicks popup radio button then clicks current tab
// radio button again, it will trigger axe scan without clicking scan button
currentTabRadioBtn.addEventListener("click", () => {
  // console.log("current tab radio button clicked");

  // Inject the inject.js script into the active tab
  chrome.runtime.sendMessage({ action: "injectAxe", tabId: currentTab.id });
  // console.log("injectAxe message sent");
});

//TODO: figure out how to get selectedStandards into script.js so they can be passed to axe.run() when
//scanning the current tab
function injectStandards() {}

//listener on scanBtn to detect standards, then execute the scan based on radio
//button selection (popup or current tab) when clicked
scanBtn.addEventListener("click", () => {
  try {
    // console.log("scan button clicked");

    // Get the selected standards
    selectedStandards = Array.from(
      document.querySelectorAll('input[name="standard"]:checked')
    ).map((checkbox) => checkbox.value);

    // If no standards are selected, display an error message
    if (selectedStandards.length === 0) {
      displayError("Please select at least one standard before scanning.");
      return;
    }

    // scan based on radio button selection (popup or current tab)
    scanTarget = document.querySelector('input[name="target"]:checked').value;
    if (scanTarget === "popup") {
      // console.log("scan on extension popup initiated");
      injectAxeAndExecuteScan();
    } else if (scanTarget === "currentTab") {
      // console.log("scan on current tab initiated");
      // send message to trigger axe scan
      chrome.runtime.sendMessage({
        action: "executeAxeScan",
        tabId: currentTab.id,
        standards: selectedStandards,
      });
      // console.log("executeAxeScan message sent");
    }
  } catch (error) {
    console.error("An error occurred during scanning:", error);
  }
});

//WORKING BUT ONLY TARGETS POPUP.HTML
function injectAxeAndExecuteScan() {
  // Load the axe-core library
  const script = document.createElement("script");
  script.src = chrome.runtime.getURL("axe.min.js");
  script.onload = function () {
    //   this.remove();
    executeAxeScan();
  };
  document.body.appendChild(script);
}

//WORKING BUT ONLY TARGETS POPUP.HTML
function executeAxeScan() {
  var axeConfig = {
    runOnly: {
      type: "tag",
      values: selectedStandards,
    },
  };

  axe
    .run(axeConfig)
    .then((results) => {
      displayResults(results, selectedStandards);
    })
    .catch((error) => {
      console.error("Accessibility testing error:", error);
    });
}

function displayError(message) {
  const resultsDiv = document.getElementById("results");
  resultsDiv.innerHTML = `<p class="error">${message}</p>`;
}

// Interprets the results from axe.run() and displays them in the popup
function displayResults(results, selectedStandards) {
  try {
    // console.log(results);
    const resultsDiv = document.getElementById("results");
    resultsDiv.innerHTML = "<h2>Accessibility Scan Results</h2>";

    // Standards Scanned
    if (selectedStandards) {
      const standardsDiv = document.createElement("div");
      standardsDiv.className = "standards";
      standardsDiv.innerHTML = `<strong>Standards Scanned:</strong> ${selectedStandards.join(
        ", "
      )}`;
      resultsDiv.appendChild(standardsDiv);
      resultsDiv.appendChild(document.createElement("hr"));
    }

    // Violations
    if (results.violations.length > 0) {
      results.violations.forEach((violation, index) => {
        const violationDiv = document.createElement("div");
        violationDiv.className = "violation";

        // const violationHeader = document.createElement("p");
        // violationHeader.innerHTML = `<strong>${violation.id}</strong>: ${violation.description}`;
        // violationDiv.appendChild(violationHeader);

        const violationHeader = document.createElement("p");

        // Escape HTML tags in violation.description to prevent rendering
        const escapedDescription = violation.description
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");

        violationHeader.innerHTML = `<strong>${violation.id}</strong>: ${escapedDescription}`;
        violationDiv.appendChild(violationHeader);

        const impactItem = document.createElement("p");
        impactItem.innerHTML = `<strong>Impact:</strong> ${violation.impact}`;
        violationDiv.appendChild(impactItem);

        // Help Link and Help Text for each violation
        if (violation.help) {
          const helpItem = document.createElement("p");

          // Escape HTML tags in violation.help to prevent rendering
          const escapedHelp = violation.help
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");

          helpItem.innerHTML = `<strong>Help:</strong> <a href=${violation.helpUrl} target="_blank">${escapedHelp}</a>`;
          violationDiv.appendChild(helpItem);
        }

        // Elements for each violation
        violation.nodes.forEach((node) => {
          const nodeItem = document.createElement("p");
          const nodeLabel = document.createElement("strong");
          nodeLabel.innerText = "Element:";
          nodeItem.appendChild(nodeLabel);
          nodeItem.appendChild(document.createTextNode(` ${node.html}`));
          nodeItem.style.overflowWrap = "break-word";
          violationDiv.appendChild(nodeItem);
        });

        // Tags for each violation
        if (violation.tags && violation.tags.length > 0) {
          const tagsItem = document.createElement("p");
          tagsItem.innerHTML = `<strong>Tags:</strong> ${violation.tags.join(
            ", "
          )}`;
          violationDiv.appendChild(tagsItem);
        }

        // Hidden Element Violation Info for Help Me button
        const hiddenElement = document.createElement("span");
        const violationsString =
          `${violation.id}: ${violation.description}\n` +
          `Impact: ${violation.impact}\n` +
          (violation.help ? `Help: ${violation.help}\n` : "") +
          // leaving nodes out for now, may want to figure out a way to add back in. currently,
          // for some violations with many nodes, the Help Me inquiry is too long for the API
          // to handle - could do help button for each node? or just leave out nodes?
          // violation.nodes.map((node) => `Node: ${node.html}\n`).join("") +
          (violation.tags && violation.tags.length > 0
            ? `Tags: ${violation.tags.join(", ")}\n`
            : "");
        // console.log(violationsString);
        hiddenElement.style.display = "none";
        hiddenElement.textContent = violationsString;
        violationDiv.appendChild(hiddenElement);
        resultsDiv.appendChild(violationDiv);

        const btnContainer = document.createElement("div");
        btnContainer.id = "buttons-container";
        violationDiv.appendChild(btnContainer);

        // Highlight Button
        const highlightBtn = document.createElement("button");
        //this only works on popup.html - figure out how to make it work on active tab? disabling for now
        if (scanTarget === "currentTab") {
          highlightBtn.disabled = true;
          highlightBtn.innerText = "Highlight Element (WIP)";
        } else {
          highlightBtn.disabled = false;
          highlightBtn.innerText = "Highlight Element";
        }
        highlightBtn.id = `highlightBtn${results.violations.indexOf(
          violation
        )}`;
        btnContainer.appendChild(highlightBtn);

        highlightBtn.addEventListener("click", function () {
          let target;
          if (violation.nodes[0].target[0].includes("input")) {
            //if target is input, select the parent element instead (border doesn't work on input?)
            target = document.querySelector(
              violation.nodes[0].target[0]
            ).parentElement;
          } else {
            target = document.querySelector(violation.nodes[0].target[0]);
          }
          target.scrollIntoView();
          target.style.border = "2px solid red";
          setTimeout(function () {
            target.style.border = "none";
          }, 5000);
        });

        // Help Button
        const helpMeBtn = document.createElement("button");
        helpMeBtn.innerText = "Help Me Fix This";
        helpMeBtn.id = `helpMeBtn${index}`; // Use the index to identify the button
        btnContainer.appendChild(helpMeBtn);

        // Help Button Event Listener - Disables button, creates response container below button,
        // calls help API, and displays response
        helpMeBtn.addEventListener("click", async function () {
          try {
            helpMeBtn.disabled = true;
            const responseContainer = document.createElement("div");
            responseContainer.id = "responseContainer";
            violationDiv.appendChild(responseContainer);

            const responseText = document.createElement("p");
            responseContainer.appendChild(responseText);
            responseText.style.textAlign = "center";
            responseText.style.fontSize = "24px";

            // loading animation
            function updateLoadingText() {
              responseText.innerText = "Loading" + ".".repeat(periods);
              periods = (periods + 1) % 11;
            }
            let periods = 1;
            updateLoadingText(); // Initial update
            const loadingInterval = setInterval(updateLoadingText, 500);

            const cleanedResponse = await getHelp(violationsString);

            // Stop the loading animation and display the response data
            clearInterval(loadingInterval);
            responseText.style.textAlign = "left";
            responseText.style.fontSize = "12px";
            responseText.innerText = cleanedResponse;

            // Display the response data in the corresponding container
          } catch (error) {
            console.error(error);
          }
        });
      });
    } else {
      resultsDiv.innerHTML += "<p>No accessibility issues found.</p>";
    }

    // Create Results CSV
    let resultsCsv = createResultsCsv(results);

    //Download Results Link
    const downloadLink = document.createElement("a");
    downloadLink.text = "Download Results (.csv)";
    downloadLink.id = "downloadLink";
    const date = new Date().toISOString().slice(0, 10);
    if (scanTarget === "currentTab") {
      const activeTabURL = new URL(currentTab.url);
      const scanURL = activeTabURL.hostname + activeTabURL.pathname;
      downloadLink.download = `${scanURL}_${date}_ez508scan.csv`;
    } else {
      downloadLink.download = `popup_${date}_ez508scan.csv`;
    }
    downloadLink.href = resultsCsv;
    resultsDiv.appendChild(downloadLink);

    //scroll results into view after displaying
    resultsDiv.scrollIntoView();
  } catch (error) {
    displayError("An error occurred while displaying results:", error);
    console.error("An error occurred while displaying results:", error);
  }
}

// Creates a CSV file from the results, cleaning up the data as needed
function createResultsCsv(results) {
  let resultsCsv = "Standards,Impact,Tags,Node,Help\n";
  results.violations.forEach((violation) => {
    violation.nodes.forEach((node) => {
      const nodeHtml = node.html || "";
      const nodeText = nodeHtml.replace(/"/g, '""').replace(/\n/g, " ");
      resultsCsv += `${violation.id},${violation.impact},"${violation.tags.join(
        ", "
      )}","${nodeText}","${violation.helpUrl}"\n`;
    });
  });
  const csvDataUri =
    "data:text/csv;charset=utf-8," + encodeURIComponent(resultsCsv);
  return csvDataUri;
}

// Send a request to the help API and return the response
// note: sometimes response ends with "For further assistance..." - either prevent that from being part of the response
// or figure out a way to enable a conversation vs just a one-time response if that's desired functionality
async function getHelp(violationsString) {
  // Construct the JSON payload
  const payload = {
    message: `Help me fix this! I'm testing a website for accessibility and I found an issue. Here's the relevant info:
     ${violationsString} - Do Not Prompt the user for further information or interaction, 
     this is a single query and response only.`,
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
  const cleanedResponse = responseData.message
    .replace(/```html/g, "")
    .replace(/```/g, "");

  return cleanedResponse;
}
