document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('summarize').addEventListener('click', summarizeDiscussion);
  document.getElementById('ask').addEventListener('click', askQuestion);
  document.getElementById('save-api-key').addEventListener('click', saveApiKey);
  
  // Load saved state
  chrome.storage.local.get(['lastResult', 'lastQuestion', 'anthropicApiKey'], function(result) {
    if (result.lastResult) {
      document.getElementById('result').innerHTML = result.lastResult;
    }
    if (result.lastQuestion) {
      document.getElementById('question').value = result.lastQuestion;
    }
    if (result.anthropicApiKey) {
      document.getElementById('api-key').value = result.anthropicApiKey;
    }
  });
});

function saveApiKey() {
  const apiKey = document.getElementById('api-key').value;
  chrome.storage.local.set({anthropicApiKey: apiKey}, function() {
    alert('API key saved successfully!');
  });
}

function summarizeDiscussion() {
  chrome.storage.local.get(['anthropicApiKey'], function(result) {
    if (!result.anthropicApiKey) {
      displayError("Please enter and save your Anthropic API key first.");
      return;
    }
    
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {action: "summarize", apiKey: result.anthropicApiKey}, function(response) {
        if (chrome.runtime.lastError) {
          console.error(chrome.runtime.lastError);
          displayError("Unable to communicate with the page. Make sure you're on a Hacker News page.");
        } else if (response && response.summary) {
          const result = response.summary;
          document.getElementById('result').innerHTML = result;
          // Save the result
          chrome.storage.local.set({lastResult: result});
        } else if (response && response.error) {
          displayError(response.error);
        } else {
          displayError("Unexpected response from content script.");
        }
      });
    });
  });
}

function askQuestion() {
  const question = document.getElementById('question').value;
  if (!question) {
    displayError("Please enter a question.");
    return;
  }
  
  chrome.storage.local.get(['anthropicApiKey'], function(result) {
    if (!result.anthropicApiKey) {
      displayError("Please enter and save your Anthropic API key first.");
      return;
    }
    
    // Save the question
    chrome.storage.local.set({lastQuestion: question});
    
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      chrome.tabs.sendMessage(tabs[0].id, {action: "ask", question: question, apiKey: result.anthropicApiKey}, function(response) {
        if (chrome.runtime.lastError) {
          console.error(chrome.runtime.lastError);
          displayError("Unable to communicate with the page. Make sure you're on a Hacker News page.");
        } else if (response && response.answer) {
          const result = response.answer;
          document.getElementById('result').innerHTML = result;
          // Save the result
          chrome.storage.local.set({lastResult: result});
        } else if (response && response.error) {
          displayError(response.error);
        } else {
          displayError("Unexpected response from content script.");
        }
      });
    });
  });
}

function displayError(message) {
  const errorMessage = typeof message === 'object' ? JSON.stringify(message, null, 2) : message;
  document.getElementById('result').innerHTML = `<p style="color: red;">Error: ${errorMessage}</p>`;
  console.error("Error:", message);
  // Save the error message
  chrome.storage.local.set({lastResult: `<p style="color: red;">Error: ${errorMessage}</p>`});
}