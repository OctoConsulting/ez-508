//script.js
//injected after axe.min.js into the page to run axe.run()
//currently triggered by both clicking the "Scan" button in popup.html and selecting the "current tab" radio button in popup.
//console.log("script.js loaded");

//TODO: need to figure out how to get selectedStandards from popup.js into this script to setup axeConfig
var axeConfig = {
  runOnly: {
    type: "tag",
    // values: selectedStandards,
    values: ["wcag2aa", "TTv5"],
  },
};
axe.run(axeConfig).then((results) => {
  if (results.violations.length > 0) {
    // console.log(`Found ${results.violations.length} violations`);
    // console.log(results.violations);
    //using CustomEvent because Chrome API is inaccessbile from here
    const customEvent = new CustomEvent("customAxeResults", {
      detail: results,
    });
    document.dispatchEvent(customEvent);
  } else {
    console.log("No violations found");
  }
});
