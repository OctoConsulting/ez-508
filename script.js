//script.js
// Listen for messages from background or popup
let global = this
let selectedStandards = ["wcag2aa", "TTv5"] // default, will be fetched from extension before run
let highlightEnabled = false
let autoScan = false
let elementsWithHighlight = []
let results = null

const converter = new showdown.Converter()
chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
  if (message.action == "sendAiInsight") {
    document.getElementById("ez-508-shadow-root").shadowRoot.getElementById("ez-508-helper-ai")
      .outerHTML = `<div class="ai-insights">${converter.makeHtml(message.response)}</div>`

    document.getElementById("ez-508-shadow-root").shadowRoot.getElementById("ai-insights-title")
      .outerHTML = `<h5>AI Generated Insights & Resolution</h5>`
  } else if (message.action == "executeAxeScan") {
    runAxe()
  }
});

chrome.storage.onChanged.addListener(async (changes) => {
  if (!Object.keys(changes).includes("selectedStandards")) {
    highlightEnabled = (await chrome.storage.sync.get(["highlight"]))['highlight']
    autoScan = (await chrome.storage.sync.get(["auto-scan"]))['auto-scan']
    runAxe()
  }
});

async function runAxe() {
  if (document.visibilityState != "visible") { // if the DOM is visible (currently on tab)
    return
  }
  let getStandards = await chrome.storage.sync.get(["selectedStandards"])
  if (getStandards['selectedStandards']) {
    selectedStandards = getStandards['selectedStandards']
  }
  var axeConfig = {
    runOnly: {
      type: "tag",
      values: selectedStandards,
    },
  };

  global.results = await axe.run(axeConfig)
  console.log(`Found ${global.results.violations.length} violation(s)`);
  console.log(global.results.violations);
  //using CustomEvent because Chrome API is inaccessbile from here
  // const customEvent = new CustomEvent("customAxeResults", {
  //   detail: results,
  // });
  // document.dispatchEvent(customEvent);
  chrome.runtime.sendMessage({ action: "axeResultsCurrentTab", data: global.results });

  if (highlightEnabled) {
    global.results.violations.forEach((violation, index) => {
      let target;
        if (violation.nodes[0].target[0].includes("input")) {
          //if target is input, select the parent element instead (border doesn't work on input?)
          target = document.querySelector(
            violation.nodes[0].target[0]
          ).parentElement;
        } else {
          target = document.querySelector(violation.nodes[0].target[0]);
        }
        // target.scrollIntoView();
        let highlightAdded = elementsWithHighlight.filter(x => x.element.outerHTML == target.outerHTML)?.length > 0
        if (!highlightAdded) {
          target.classList.add(`ez-508`)
          target.classList.add(`ez-508-${violation.impact}`)
          target.addEventListener("mouseenter", () => {
            let stillHighlighted = elementsWithHighlight.filter(x => x.element.outerHTML == target.outerHTML)?.length > 0
            if (stillHighlighted) {
              showHelperWidget(violation, index)
            }
          })
          elementsWithHighlight.push({ element: target, class: `ez-508-${violation.impact}` })
        }
    })
  } else { // remove highlights + event listener
    elementsWithHighlight.forEach((entry) => {
      entry?.element?.classList.remove(`ez-508`)
      entry?.element?.classList.remove(entry.class)
    })
    elementsWithHighlight = []
  }
}


function showHelperWidget(violation, index, focus=false) {
  // blinking effect
  if (focus) {
    let element = document.querySelector(violation.nodes[0].target[0])
    element.classList.add(`ez-508-focus`)
    let interval = setInterval(() => { 
      if (element.classList.contains("ez-508-focus")) {
        element.classList.remove(`ez-508-focus`)
      } else {
        element.classList.add(`ez-508-focus`)
      }
    }, 250)
    setTimeout(() => {
      clearInterval(interval)
      element.classList.remove(`ez-508-focus`)
    }, 2000)
  }

  helperWidget.style.display = 'unset'
  helperWidget.innerHTML = "<h3>ez-508 Accessibility Insight</h3><h4>Violation Details</h4>"
  const violationDiv = document.createElement("div");
  // Escape HTML tags in violation.description to prevent rendering
  const escapedDescription = violation.description
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const escapedHelp = violation.help
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  helperWidget.innerHTML += `<div id="ez-508-nav">[${ index + 1 } / ${ global.results.violations.length }] [<a id="ez-508-prev" ${ index - 1 < 0 ? 'class="ez-disabled"' : "" } data-index="${ index - 1 }">prev</a> / <a id="ez-508-next" ${ index + 1 >= global.results.violations.length ? 'class="ez-disabled"' : "" } data-index="${ index + 1 }">next</a>]</div><a id="ez-508-close">[close]</a><p><strong>The Problem</strong>: ${escapedHelp}.</p>`;
  helperWidget.innerHTML += `<p><strong>The Rule</strong>: ${escapedDescription} (<em>${violation.id}</em>).</p>`;
  helperWidget.innerHTML +=  `<p><strong>The Impact:</strong> This is a <span class="ez-508-helper-${violation.impact}"><strong>${violation.impact}</strong></span> accessibility item.</p>`;

  helperWidget.innerHTML +=  `<h4>How to Fix</h4>`;
  helperWidget.innerHTML +=  `<p><strong>Documentation</strong>: <a href="${violation.helpUrl}" target="_blank">Here's how the issue is generally addressed</a>.</p>`;
  
  const aiInsightsP = document.createElement('p')
  aiInsightsP.innerHTML = '<strong id="ai-insights-title"></strong> '

  const generateAiInsights = document.createElement('a')
  generateAiInsights.id = "ez-508-helper-ai"
  generateAiInsights.style.cursor = 'pointer'
  generateAiInsights.innerHTML = "Generate AI Insights"
  let aiHelpText = `
    Please suggest a code fix to my accessibility issue. Assume it belongs to a larger piece of working code.
    The Problem: ${escapedHelp}. The Rule ${escapedDescription}. Tags: ${violation.tags.join(", ")}
    HTML code: ${violation.nodes[0]?.html}
  `
  generateAiInsights.setAttribute("data-help-text", aiHelpText)
  
  
  aiInsightsP.appendChild(generateAiInsights)
  helperWidget.appendChild(aiInsightsP)

  helperWidget.innerHTML +=  `<h4>Elements Affected</h4>`;
  // Elements for each violation
  violation.nodes.forEach((node, index) => {
    const nodeItem = document.createElement("p");
    const nodeLabel = document.createElement("strong");
    nodeLabel.innerText = `Element ${ index + 1 }:`;
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

  helperWidget.appendChild(violationDiv)
}

// Debounce function
function debounce(func, delay) {
  let timeout;
  return function () {
    clearTimeout(timeout);
    timeout = setTimeout(() => {
      func.apply(this, arguments);
    }, delay);
  };
}

// Callback function for the MutationObserver
async function handleDOMChanges(mutationsList, observer) {
  // Your code to handle DOM changes goes here
  highlightEnabled = (await chrome.storage.sync.get(["highlight"]))['highlight']
  autoScan = (await chrome.storage.sync.get(["auto-scan"]))['auto-scan']
  if (autoScan) {
    console.log('DOM content changed. Running ez-508...');
    runAxe()
  }
}
const observer = new MutationObserver(
  debounce(handleDOMChanges, 2000) // Debounce the callback
);

// Configure the observer to watch for changes in the entire document
const observerConfig = { childList: true, subtree: true };
observer.observe(document, observerConfig);

const helperWidgetRoot = document.createElement('div');
helperWidgetRoot.id = "ez-508-shadow-root"
helperWidgetRoot.attachShadow({ mode: "open" })
helperWidgetRoot.shadowRoot.innerHTML = `
<style>:host {all: initial;}</style>
<link rel="stylesheet" href="${chrome.runtime.getURL('css/helper-widget.css')}">
`

document.head.innerHTML += `
<link rel="stylesheet" href="${chrome.runtime.getURL('css/roboto/roboto-fontface.css')}">
<link rel="stylesheet" href="${chrome.runtime.getURL('css/roboto/roboto-condensed-fontface.css')}">
<link rel="stylesheet" href="${chrome.runtime.getURL('css/roboto/roboto-slab-fontface.css')}">

<style>
@font-face {
  font-family: 'Consolas';
  src: url('${chrome.runtime.getURL('fonts/CONSOLA.TTF')}') format('truetype')
}
</style>
`

const helperWidget = document.createElement('div');
helperWidget.id = 'ez-508-helper-widget'
helperWidget.innerHTML = "test"
helperWidgetRoot.shadowRoot.appendChild(helperWidget)
document.body.appendChild(helperWidgetRoot)
helperWidget.style.display = 'none'

// Attach the event listener to an ancestor outside of the shadow DOM
document.addEventListener('click', async function (ev) {
  const target = ev.composedPath()[0]; // Get the actual target element

  if (target.id == "ez-508-helper-ai") {
    ev.preventDefault()
    target.innerText = "..."
    
    // loading animation
    function updateLoadingText() {
      target.innerText = ".".repeat(periods);
      periods = (periods + 1) % 11;
    }
    let periods = 1;
    updateLoadingText(); // Initial update
    setInterval(updateLoadingText, 500);
    
    chrome.runtime.sendMessage({ action: "getAiInsight", helpText: target.getAttribute("data-help-text") });

  } else if (target.id == "ez-508-close") {
    ev.preventDefault()
    document.getElementById("ez-508-shadow-root").shadowRoot.getElementById("ez-508-helper-widget").style.display = 'none'
  } else if ((target.id == "ez-508-prev" || target.id == "ez-508-next") && !target.classList.contains("ez-disabled")) {
    ev.preventDefault()
    let nextIndex = parseInt(target.getAttribute("data-index"))
    showHelperWidget(global.results.violations[nextIndex], nextIndex, true)
  }
});