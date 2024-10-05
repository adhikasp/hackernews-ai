import { ChatAnthropic } from "@langchain/anthropic";
import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";

let model;

// Function to check if the current page is a discussion page
function isDiscussionPage() {
  return window.location.pathname === '/item' && window.location.search.includes('id=');
}

// Function to generate a cache key
function getCacheKey(url, selectedModel) {
  return `${url}|${selectedModel}`;
}

// Automatically run summarization if it's a discussion page
if (isDiscussionPage()) {
  chrome.storage.local.get(['anthropicApiKey', 'openaiApiKey', 'selectedModel', 'summaryCache'], function(result) {
    if (result.anthropicApiKey || result.openaiApiKey) {
      const cacheKey = getCacheKey(window.location.href, result.selectedModel);
      const summaryCache = result.summaryCache || {};

      if (summaryCache[cacheKey]) {
        console.info("Using cached summary");
        displaySummaryOnPage(summaryCache[cacheKey]);
      } else {
        console.info("Generating new summary");
        initializeModel(result);
        showLoadingIndicator();
        extractAndSummarizeDiscussion().then(summary => {
          // Cache the summary
          summaryCache[cacheKey] = summary;
          chrome.storage.local.set({ summaryCache: summaryCache });
          displaySummaryOnPage(summary);
        }).catch(error => {
          console.error("Error auto-summarizing:", error);
          hideLoadingIndicator();
          displayErrorOnPage("An error occurred while summarizing the discussion.");
        });
      }
    }
  });
}

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === "summarize") {
    chrome.storage.local.get(['summaryCache', 'selectedModel'], function(result) {
      const cacheKey = getCacheKey(window.location.href, result.selectedModel);
      const summaryCache = result.summaryCache || {};
      if (summaryCache[cacheKey]) {
        console.log("Using cached summary");
        displaySummaryOnPage(summaryCache[cacheKey]);
        sendResponse({summary: summaryCache[cacheKey]});
      } else {
        console.log("Generating new summary");
        initializeModel(request);
        showLoadingIndicator();
        extractAndSummarizeDiscussion().then(summary => {
          // Cache the summary
          summaryCache[cacheKey] = summary;
          chrome.storage.local.set({ summaryCache: summaryCache });
          displaySummaryOnPage(summary);
          sendResponse({summary: summary});
        }).catch(error => {
          hideLoadingIndicator();
          displayErrorOnPage("An error occurred while summarizing the discussion.");
          sendResponse({error: error.message || "An error occurred while summarizing the discussion."});
        });
      }
    });
    return true;  // Indicates that the response will be sent asynchronously
  } else if (request.action === "ask") {
    initializeModel(request);
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

// Modify the initializeModel function
function initializeModel(config) {
  const selectedModel = config.selectedModel;
  if (selectedModel.startsWith('claude-')) {
    if (!config.anthropicApiKey) {
      throw new Error("Anthropic API key is required for Claude models.");
    }
    model = new ChatAnthropic({
      anthropicApiKey: config.anthropicApiKey,
      modelName: selectedModel,
      clientOptions: {
        defaultHeaders: {
          "anthropic-dangerous-direct-browser-access": "true",
        },
      },
    });
  } else if (selectedModel.startsWith('gpt-')) {
    if (!config.openaiApiKey) {
      throw new Error("OpenAI API key is required for GPT models.");
    }
    model = new ChatOpenAI({
      openAIApiKey: config.openaiApiKey,
      modelName: selectedModel,
    });
  } else {
    throw new Error("Invalid model selected.");
  }
}

async function extractAndSummarizeDiscussion() {
  const pageContent = document.body.innerText;
  
  const prompt = PromptTemplate.fromTemplate(`
    Analyze and summarize the following Hacker News discussion using these steps:

    1. Read through the entire discussion carefully.
    2. Identify the main topics and themes being discussed.
    3. Note any interesting insights or unique perspectives shared by commenters.
    4. Consider the overall sentiment of the discussion (positive, negative, neutral, or mixed).
    5. Organize the key points into a logical structure.
    6. Summarize the discussion concisely, highlighting the most important aspects.
    7. Format the summary using HTML markup, utilizing <ol> or <ul> for listing points.

    Remember:
    - Do not include a title or opening paragraph like "Here is a summary of the discussion."
    - Focus on surfacing valuable insights and unique viewpoints.
    - Ensure the summary is concise yet comprehensive.

    Discussion content:
    <text>{text}</text>

    Based on the above steps, provide a well-structured summary of the Hacker News discussion.
  `);

  const chain = prompt.pipe(model).pipe(new StringOutputParser());

  const summary = await chain.invoke({
    text: pageContent,
  });
  return summary;
}

async function answerQuestion(question) {
  const pageContent = document.body.innerText;
  
  const prompt = PromptTemplate.fromTemplate(`
    You are an AI assistant analyzing a Hacker News discussion. Your task is to answer a specific question based on the content of the discussion.

    Discussion content:
    {text}

    Question to answer:
    {question}

    Instructions:
    1. Carefully read and analyze the discussion content.
    2. Focus on answering the given question accurately and concisely.
    3. If the answer is not directly stated in the discussion, use the context to provide the most relevant and informed response possible.
    4. Include relevant quotes or examples from the discussion to support your answer, if applicable.
    5. If the question cannot be answered based on the given discussion, state this clearly and explain why.
    6. Format your response using appropriate HTML markup for readability (e.g., <p>, <ul>, <ol>, <strong>, <em>).
    7. Ensure your answer is objective and based solely on the information provided in the discussion.

    Provide your answer below:
  `);

  const chain = prompt.pipe(model).pipe(new StringOutputParser());

  const answer = await chain.invoke({
    question: question,
    text: pageContent,
  });
  return answer;
}

function handleAskQuestion() {
  const question = document.getElementById('ai-question-input').value;
  if (!question) {
    alert("Please enter a question.");
    return;
  }

  showLoadingIndicator();
  chrome.storage.local.get(['anthropicApiKey', 'openaiApiKey', 'selectedModel'], function(result) {
    if (result.anthropicApiKey || result.openaiApiKey) {
      initializeModel(result);
      answerQuestion(question).then(answer => {
        displayAnswerOnPage(answer);
      }).catch(error => {
        console.error("Error answering question:", error);
        hideLoadingIndicator();
        displayErrorOnPage("An error occurred while answering the question.");
      });
    } else {
      hideLoadingIndicator();
      displayErrorOnPage("Please set your API key in the extension popup.");
    }
  });
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

    // Create the structure only if it doesn't exist
    summaryContainer.innerHTML = `
      <h3 style="margin: 0 0 10px 0; color: #ff6600;">AI-Generated Summary</h3>
      <div id="ai-summary-content"></div>
      <div id="ai-question-container" style="margin-top: 15px;">
        <input type="text" id="ai-question-input" placeholder="Ask a question about the content" style="width: 100%; padding: 5px; margin-bottom: 10px;">
        <button id="ai-ask-button" style="padding: 5px 10px; background-color: #ff6600; color: white; border: none; cursor: pointer;">Ask</button>
      </div>
      <div id="ai-answer-container" style="margin-top: 15px; display: none;"></div>
    `;

    // Add event listener for the ask button
    document.getElementById('ai-ask-button').addEventListener('click', handleAskQuestion);

    // Add event listener for the Enter key on the input field
    document.getElementById('ai-question-input').addEventListener('keypress', function(event) {
      if (event.key === 'Enter') {
        event.preventDefault(); // Prevent the default action
        handleAskQuestion();
      }
    });
  }

  // Update only the summary content
  const summaryContent = document.getElementById('ai-summary-content');
  if (summaryContent) {
    summaryContent.innerHTML = summary;
  }
}

function displayAnswerOnPage(answer) {
  hideLoadingIndicator();
  
  const answerContainer = document.getElementById('ai-answer-container');
  answerContainer.style.display = 'block';
  answerContainer.innerHTML = `
    <h4 style="margin: 0 0 10px 0; color: #ff6600;">AI Answer</h4>
    ${answer}
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