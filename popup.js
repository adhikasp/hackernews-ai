document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('save-config').addEventListener('click', saveConfiguration);
  
  // Load saved state
  chrome.storage.local.get(['anthropicApiKey', 'openaiApiKey', 'selectedModel'], function(result) {
    if (result.anthropicApiKey) {
      document.getElementById('anthropic-api-key').value = maskApiKey(result.anthropicApiKey);
      document.getElementById('anthropic-api-key').dataset.masked = 'true';
    }
    if (result.openaiApiKey) {
      document.getElementById('openai-api-key').value = maskApiKey(result.openaiApiKey);
      document.getElementById('openai-api-key').dataset.masked = 'true';
    }
    if (result.selectedModel) {
      document.getElementById('model-select').value = result.selectedModel;
    }
  });

  // Add event listeners for api-key inputs
  ['anthropic-api-key', 'openai-api-key'].forEach(id => {
    document.getElementById(id).addEventListener('focus', function() {
      if (this.dataset.masked === 'true') {
        this.value = '';
        this.dataset.masked = 'false';
      }
    });

    document.getElementById(id).addEventListener('blur', function() {
      if (this.value === '') {
        const key = id === 'anthropic-api-key' ? 'anthropicApiKey' : 'openaiApiKey';
        chrome.storage.local.get([key], function(result) {
          if (result[key]) {
            document.getElementById(id).value = maskApiKey(result[key]);
            document.getElementById(id).dataset.masked = 'true';
          }
        });
      }
    });
  });
});

function saveConfiguration() {
  const anthropicApiKey = document.getElementById('anthropic-api-key').value;
  const openaiApiKey = document.getElementById('openai-api-key').value;
  const selectedModel = document.getElementById('model-select').value;
  
  const dataToSave = {
    selectedModel: selectedModel
  };

  // Only update API keys if they're not all asterisks
  if (!/^\*+$/.test(anthropicApiKey)) {
    dataToSave.anthropicApiKey = anthropicApiKey;
  }
  if (!/^\*+$/.test(openaiApiKey)) {
    dataToSave.openaiApiKey = openaiApiKey;
  }

  chrome.storage.local.get(['selectedModel', 'summaryCache'], function(result) {
    if (result.selectedModel !== selectedModel) {
      // Clear the summary cache if the model has changed
      dataToSave.summaryCache = {};
    } else {
      dataToSave.summaryCache = result.summaryCache || {};
    }

    chrome.storage.local.set(dataToSave, function() {
      if (dataToSave.anthropicApiKey) {
        document.getElementById('anthropic-api-key').value = maskApiKey(anthropicApiKey);
        document.getElementById('anthropic-api-key').dataset.masked = 'true';
      }
      if (dataToSave.openaiApiKey) {
        document.getElementById('openai-api-key').value = maskApiKey(openaiApiKey);
        document.getElementById('openai-api-key').dataset.masked = 'true';
      }
      alert('Configuration saved successfully!');
    });
  });
}

function maskApiKey(apiKey) {
  return '*'.repeat(apiKey.length);
}