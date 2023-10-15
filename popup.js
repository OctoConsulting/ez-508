//popup.js
const scanBtn = document.getElementById("scan");
const aboutBtn = document.getElementById("about");
let [currentTab] = await chrome.tabs.query({
  active: true,
  currentWindow: true,
});

chrome.tabs.onActivated.addListener((activeInfo) => {
  currentTab = activeInfo
});

// load preferences from chrome.storage
chrome.storage.sync.get(["auto-scan", "highlight", "selectedStandards"]).then((result) => {
  console.log(result)
  document.getElementById("auto-scan").checked = result["auto-scan"] ? true : false
  document.getElementById("highlight").checked = result["highlight"] ? true : false
  if (result["selectedStandards"]) {
    document.querySelectorAll('input[name="standard"]').forEach((ele) => {
      if (result["selectedStandards"].includes(ele.value)) {
        ele.checked = true
      } else {
        ele.checked = false
      }
    })
  }
});

let selectedStandards;
let scanTarget;

aboutBtn.addEventListener("click", openOnboarding);

document.getElementById("auto-scan").addEventListener("click", () => {
  chrome.storage.sync.set({ "auto-scan": document.getElementById("auto-scan").checked }).then(() => {
    console.log("Updated auto-scan preference to " + document.getElementById("auto-scan").checked);
  });
})

document.getElementById("highlight").addEventListener("click", () => {
  chrome.storage.sync.set({ "highlight": document.getElementById("highlight").checked }).then(() => {
    console.log("Updated highlight preference to " + document.getElementById("highlight").checked);
  });
})

function openOnboarding() {
  chrome.runtime.openOptionsPage();
}

//onMessage listener - picks up results from scan of current tab and displays them in popup.html
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action == "axeResultsCurrentTab") {
    if (document.getElementById("toggle-results-div")?.innerText == "Hide Results") {
      // don't interrupt user viewing results
    } else {
      displayResults(message.data);
    }
  }
});


document.getElementById("standardsSelectArea").addEventListener("click", () => {
  let selectedStandards = Array.from(
    document.querySelectorAll('input[name="standard"]:checked')
  ).map((checkbox) => checkbox.value);

  if (selectedStandards.length === 0) {
    displayError("Please select at least one standard to enable scanning.");
    return;
  } else {
    chrome.storage.sync.set({ "selectedStandards": selectedStandards }).then(() => {
      console.log("Updated standards preference to " + selectedStandards);
    });
  }
})

//listener on scanBtn to detect standards, then execute the scan based on radio
//button selection (popup or current tab) when clicked
scanBtn.addEventListener("click", () => {
  chrome.tabs.sendMessage(currentTab.id, { action: "executeAxeScan", tabId: currentTab.id, standards: selectedStandards });
});

function displayError(message) {
  const resultsDiv = document.getElementById("results");
  resultsDiv.innerHTML = `<p class="error">${message}</p>`;
}

function toggleResultsDiv() {
  let curr = document.getElementById("results-list").style.display
  document.getElementById("results-list").style.display = curr == "none" ? 'unset' : 'none'
  document.getElementById("toggle-results-div").innerText = curr == "none" ? 'Hide Results' : 'Show Results'
}

// Interprets the results from axe.run() and displays them in the popup
function displayResults(results) {
  try {
    // console.log(results);
    const resultsDivRoot = document.getElementById("results");
    resultsDivRoot.innerHTML = "<h2>Latest Scan Results</h2>"
    resultsDivRoot.innerHTML += `<div class="buttons-container" id="results-actions"><button id="toggle-results-div">Show Results</button></div>`
    document.getElementById("toggle-results-div").addEventListener("click", toggleResultsDiv)
    const resultsDiv = document.createElement("div");
    resultsDiv.id = "results-list"
    resultsDiv.style.display = 'none'
    resultsDivRoot.appendChild(resultsDiv)

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
    const activeTabURL = new URL(currentTab.url);
    const scanURL = activeTabURL.hostname + activeTabURL.pathname;
    downloadLink.download = `${scanURL}_${date}_ez508scan.csv`;
    downloadLink.href = resultsCsv;
    document.getElementById("results-actions").appendChild(downloadLink);

    //scroll results into view after displaying
    // resultsDiv.scrollIntoView();
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


