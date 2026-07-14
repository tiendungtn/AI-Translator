// Options script for AI Bilingual Translator

document.addEventListener('DOMContentLoaded', async () => {
  const inputApiKey = document.getElementById('input-api-key');
  const selectDefaultEngine = document.getElementById('select-default-engine');
  const inputTextColor = document.getElementById('input-text-color');
  const inputTextColorHex = document.getElementById('input-text-color-hex');
  const selectFontSize = document.getElementById('select-font-size');
  const selectLineHeight = document.getElementById('select-line-height');
  const previewTrans = document.getElementById('preview-trans');
  const btnSave = document.getElementById('btn-save');
  const toast = document.getElementById('toast');

  // Load preferences from local storage
  const settings = await new Promise(resolve => {
    chrome.storage.local.get([
      'apiKey',
      'service',
      'textColor',
      'fontSize',
      'lineHeight'
    ], resolve);
  });

  // Assign inputs
  if (settings.apiKey) inputApiKey.value = settings.apiKey;
  if (settings.service) selectDefaultEngine.value = settings.service;
  
  const textColor = settings.textColor || '#6b7280';
  inputTextColor.value = textColor;
  inputTextColorHex.value = textColor;

  if (settings.fontSize) selectFontSize.value = settings.fontSize;
  if (settings.lineHeight) selectLineHeight.value = settings.lineHeight;

  // Apply visual preview on startup
  updatePreview();

  // Sync color inputs
  inputTextColor.addEventListener('input', () => {
    inputTextColorHex.value = inputTextColor.value;
    updatePreview();
  });

  inputTextColorHex.addEventListener('input', () => {
    // Basic validation
    if (/^#[0-9A-F]{6}$/i.test(inputTextColorHex.value)) {
      inputTextColor.value = inputTextColorHex.value;
      updatePreview();
    }
  });

  selectFontSize.addEventListener('change', updatePreview);
  selectLineHeight.addEventListener('change', updatePreview);

  // Update Live Preview Box styling
  function updatePreview() {
    previewTrans.style.color = inputTextColor.value;
    previewTrans.style.fontSize = selectFontSize.value;
    previewTrans.style.lineHeight = selectLineHeight.value;
  }

  // Save changes
  btnSave.addEventListener('click', () => {
    const preferences = {
      apiKey: inputApiKey.value.trim(),
      service: selectDefaultEngine.value,
      textColor: inputTextColor.value,
      fontSize: selectFontSize.value,
      lineHeight: selectLineHeight.value
    };

    chrome.storage.local.set(preferences, () => {
      showToast();
    });
  });

  function showToast() {
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 2500);
  }
});
