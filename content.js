import { ChatAnthropic } from "@langchain/anthropic";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";

let model;

// Function to check if the current page is a discussion page
function isDiscussionPage() {
  return window.location.pathname === '/item' && window.location.search.includes('id=');
}

// Automatically run summarization if it's a discussion page
if (isDiscussionPage()) {
  chrome.storage.local.get(['anthropicApiKey'], function(result) {
    if (result.anthropicApiKey) {
      initializeModel(result.anthropicApiKey);
      showLoadingIndicator();
      extractAndSummarizeDiscussion().then(summary => {
        displaySummaryOnPage(summary);
      }).catch(error => {
        console.error("Error auto-summarizing:", error);
        hideLoadingIndicator();
        displayErrorOnPage("An error occurred while summarizing the discussion.");
      });
    }
  });
}

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === "summarize") {
    initializeModel(request.apiKey);
    showLoadingIndicator();
    extractAndSummarizeDiscussion().then(summary => {
      displaySummaryOnPage(summary);
      sendResponse({summary: summary});
    }).catch(error => {
      hideLoadingIndicator();
      displayErrorOnPage("An error occurred while summarizing the discussion.");
      sendResponse({error: error.message || "An error occurred while summarizing the discussion."});
    });
    return true;  // Indicates that the response will be sent asynchronously
  } else if (request.action === "ask") {
    initializeModel(request.apiKey);
    showLoadingIndicator();
    answerQuestion(request.question).then(answer => {
      displaySummaryOnPage(answer);
      sendResponse({answer: answer});
    }).catch(error => {
      hideLoadingIndicator();
      displayErrorOnPage("An error occurred while answering the question.");
      sendResponse({error: error.message || "An error occurred while answering the question."});
    });
    return true;  // Indicates that the response will be sent asynchronously
  }
});

function initializeModel(apiKey) {
  model = new ChatAnthropic({
    anthropicApiKey: apiKey,
    modelName: "claude-3-haiku-20240307",
    clientOptions: {
      defaultHeaders: {
          "anthropic-dangerous-direct-browser-access": "true",
      },
    },
  });
}

async function extractAndSummarizeDiscussion() {
  const pageContent = document.body.innerText;
  
  const prompt = PromptTemplate.fromTemplate(
    "Summarize the following Hacker News discussion in a concise manner. Surface interesting insights and unique perpsective in that are being discussed. Analyze the overall sentiment of the discussion. Do not include title or opening paragraph like 'here is summary of the discussion'. Format in HTML markup. Use <ol> or <ul> to list out the points.\n\n<text>{text}</text>"
  );

  const chain = prompt.pipe(model).pipe(new StringOutputParser());

  const summary = await chain.invoke({
    text: pageContent,
  });
  return summary;
}

async function answerQuestion(question) {
  const pageContent = document.body.innerText;
  
  const prompt = PromptTemplate.fromTemplate(
    "Based on the following Hacker News discussion. Format in HTML markup. Answer this question: {question}\n\nDiscussion content:\n{text}"
  );

  const chain = prompt.pipe(model).pipe(new StringOutputParser());

  const answer = await chain.invoke({
    question: question,
    text: pageContent,
  });
  return answer;
}

function displaySummaryOnPage(summary) {
  hideLoadingIndicator();
  
  let summaryContainer = document.getElementById('ai-summary-container');
  if (!summaryContainer) {
    summaryContainer = document.createElement('div');
    summaryContainer.id = 'ai-summary-container';
    summaryContainer.style.cssText = `
      border: 1px solid #ff6600;
      background-color: #f6f6ef;
      padding: 10px;
      margin: 10px 0;
      font-family: Verdana, Geneva, sans-serif;
      font-size: 10pt;
    `;
    const mainContent = document.querySelector('.fatitem');
    if (mainContent) {
      mainContent.insertAdjacentElement('afterend', summaryContainer);
    } else {
      document.body.insertAdjacentElement('afterbegin', summaryContainer);
    }
  }

  summaryContainer.innerHTML = `
    <h3 style="margin: 0 0 10px 0; color: #ff6600;">AI-Generated Summary</h3>
    ${summary}
  `;
}

function showLoadingIndicator() {
  let loadingContainer = document.getElementById('ai-loading-container');
  if (!loadingContainer) {
    loadingContainer = document.createElement('div');
    loadingContainer.id = 'ai-loading-container';
    loadingContainer.style.cssText = `
      border: 1px solid #ff6600;
      background-color: #f6f6ef;
      padding: 10px;
      margin: 10px 0;
      font-family: Verdana, Geneva, sans-serif;
      font-size: 10pt;
      text-align: center;
    `;
    
    // Add the keyframes animation definition
    const styleElement = document.createElement('style');
    styleElement.textContent = `
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(styleElement);
    
    loadingContainer.innerHTML = `
      <p>Generating AI summary...</p>
      <div class="loader" style="
        border: 5px solid #f3f3f3;
        border-top: 5px solid #ff6600;
        border-radius: 50%;
        width: 30px;
        height: 30px;
        animation: spin 1s linear infinite;
        margin: 10px auto;
      "></div>
    `;
    const mainContent = document.querySelector('.fatitem');
    if (mainContent) {
      mainContent.insertAdjacentElement('afterend', loadingContainer);
    } else {
      document.body.insertAdjacentElement('afterbegin', loadingContainer);
    }
  }
  loadingContainer.style.display = 'block';
}

function hideLoadingIndicator() {
  const loadingContainer = document.getElementById('ai-loading-container');
  if (loadingContainer) {
    loadingContainer.style.display = 'none';
  }
}

function displayErrorOnPage(errorMessage) {
  let errorContainer = document.getElementById('ai-error-container');
  if (!errorContainer) {
    errorContainer = document.createElement('div');
    errorContainer.id = 'ai-error-container';
    errorContainer.style.cssText = `
      border: 1px solid #ff0000;
      background-color: #fff0f0;
      color: #ff0000;
      padding: 10px;
      margin: 10px 0;
      font-family: Verdana, Geneva, sans-serif;
      font-size: 10pt;
    `;
    const mainContent = document.querySelector('.fatitem');
    if (mainContent) {
      mainContent.insertAdjacentElement('afterend', errorContainer);
    } else {
      document.body.insertAdjacentElement('afterbegin', errorContainer);
    }
  }
  errorContainer.textContent = errorMessage;
  errorContainer.style.display = 'block';
}