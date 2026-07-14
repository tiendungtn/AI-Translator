// Popup interactions for AI Bilingual Translator

document.addEventListener('DOMContentLoaded', async () => {
  const btnTranslatePage = document.getElementById('btn-translate-page');
  const btnRestorePage = document.getElementById('btn-restore-page');
  const selectTargetLang = document.getElementById('select-target-lang');
  const selectService = document.getElementById('select-service');
  const apiWarning = document.getElementById('api-warning');
  const linkSetupKey = document.getElementById('link-setup-key');
  const btnOptions = document.getElementById('btn-options');
  const statusContainer = document.getElementById('status-container');
  const statusText = document.getElementById('status-text');

  // Load saved preferences
  const settings = await new Promise(resolve => {
    chrome.storage.local.get(['targetLanguage', 'service', 'apiKey', 'isTranslated'], resolve);
  });

  if (settings.targetLanguage) selectTargetLang.value = settings.targetLanguage;
  if (settings.service) selectService.value = settings.service;

  // Toggle API warning based on key presence and service
  function checkApiWarning() {
    if (selectService.value === 'gemini' && !settings.apiKey) {
      apiWarning.style.display = 'flex';
    } else {
      apiWarning.style.display = 'none';
    }
  }
  checkApiWarning();

  // If page was already translated, show restore button
  if (settings.isTranslated) {
    btnRestorePage.style.display = 'block';
  }

  // Handle service change
  selectService.addEventListener('change', () => {
    chrome.storage.local.set({ service: selectService.value });
    chrome.storage.local.get(['apiKey'], (res) => {
      if (selectService.value === 'gemini' && !res.apiKey) {
        apiWarning.style.display = 'flex';
      } else {
        apiWarning.style.display = 'none';
      }
    });
  });

  // Handle target language change
  selectTargetLang.addEventListener('change', () => {
    chrome.storage.local.set({ targetLanguage: selectTargetLang.value });
  });

  // Open Options page
  function openOptions() {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open(chrome.runtime.getURL('options.html'));
    }
  }

  btnOptions.addEventListener('click', openOptions);
  linkSetupKey.addEventListener('click', (e) => {
    e.preventDefault();
    openOptions();
  });

  // Trigger translate command
  btnTranslatePage.addEventListener('click', async () => {
    statusContainer.style.display = 'flex';
    btnTranslatePage.disabled = true;

    // Get current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      showError('Không tìm thấy tab hiện tại');
      return;
    }

    // Get active keys/settings
    const res = await new Promise(resolve => {
      chrome.storage.local.get(['targetLanguage', 'service', 'apiKey'], resolve);
    });

    const targetLang = res.targetLanguage || 'vi';
    const service = res.service || 'google';
    const apiKey = res.apiKey || '';

    // Send translation request to the content script in the current tab
    chrome.tabs.sendMessage(tab.id, {
      action: 'translate_page',
      targetLanguage: targetLang,
      service: service,
      apiKey: apiKey
    }, (response) => {
      statusContainer.style.display = 'none';
      btnTranslatePage.disabled = false;

      if (chrome.runtime.lastError) {
        showError('Không thể tương tác với trang này (Có thể do là trang đặc biệt của trình duyệt)');
        console.error(chrome.runtime.lastError);
        return;
      }

      if (response && response.success) {
        btnRestorePage.style.display = 'block';
        chrome.storage.local.set({ isTranslated: true });
      } else {
        showError('Dịch thất bại');
      }
    });
  });

  // Trigger restore command
  btnRestorePage.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;

    chrome.tabs.sendMessage(tab.id, { action: 'restore_page' }, (response) => {
      if (response && response.success) {
        btnRestorePage.style.display = 'none';
        chrome.storage.local.set({ isTranslated: false });
      }
    });
  });

  function showError(msg) {
    statusContainer.style.display = 'flex';
    statusText.textContent = msg;
    statusText.style.color = '#ef4444';
    setTimeout(() => {
      statusContainer.style.display = 'none';
      statusText.textContent = 'Đang dịch...';
      statusText.style.color = 'var(--accent-cyan)';
    }, 3000);
  }
});
