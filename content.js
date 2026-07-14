// Content Script for AI Bilingual Translator

let isTranslating = false;
let currentLanguage = '';
let currentService = 'google';

// Create and inject CSS if needed (content.css handles most styling)
// Injected elements structure:
// <trans-span class="bilingual-translated">Translated text</trans-span>

// Find block elements containing translatable text
function getTranslatableBlocks(root = document.body) {
  const blocks = [];
  const ignoredTags = new Set([
    'SCRIPT', 'STYLE', 'CODE', 'PRE', 'INPUT', 'TEXTAREA', 'NOSCRIPT',
    'SVG', 'CANVAS', 'IFRAME', 'AUDIO', 'VIDEO', 'OBJECT', 'EMBED', 'HEAD'
  ]);

  function traverse(node) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const tagName = node.tagName;

      // Ignore translation markup and non-translatable tags
      if (ignoredTags.has(tagName) || 
          node.classList.contains('bilingual-translated') || 
          node.getAttribute('data-translated-state') === 'translated' ||
          node.id === 'translation-float-ball') {
        return;
      }

      // Check if it is a block container we want to translate
      const isTextContainer = ['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'BLOCKQUOTE', 'TD', 'TH', 'SPAN', 'DIV'].includes(tagName);

      if (isTextContainer) {
        // Check if node has direct, non-empty text children
        let hasDirectText = false;
        let childNodesCount = 0;
        let hasBlockChildren = false;

        for (let child of node.childNodes) {
          if (child.nodeType === Node.TEXT_NODE) {
            if (child.textContent.trim().length > 15) { // minimum length threshold to avoid translating random punctuation/numbers
              hasDirectText = true;
            }
          } else if (child.nodeType === Node.ELEMENT_NODE) {
            childNodesCount++;
            const childTagName = child.tagName;
            if (['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'SECTION', 'ARTICLE'].includes(childTagName)) {
              hasBlockChildren = true;
            }
          }
        }

        // If it has text content and no block children, translate this container as a whole
        if (hasDirectText && !hasBlockChildren) {
          const text = node.textContent.trim();
          if (text.length > 5) {
            blocks.push(node);
            return; // Don't traverse deeper into this leaf block
          }
        }
      }
    }

    // Traverse children
    for (let child of node.childNodes) {
      traverse(child);
    }
  }

  traverse(root);
  return blocks;
}

// Perform full page translation
async function translatePage(targetLanguage, service, apiKey) {
  if (isTranslating) return;
  isTranslating = true;
  updateFloatBallStatus(true, 'Dang dịch...');

  try {
    const blocks = getTranslatableBlocks();
    if (blocks.length === 0) {
      updateFloatBallStatus(false);
      isTranslating = false;
      return;
    }

    // Load custom translation styling from settings
    const settings = await new Promise(resolve => {
      chrome.storage.local.get(['textColor', 'fontSize', 'lineHeight'], resolve);
    });

    const textColor = settings.textColor || '#6b7280';
    const fontSize = settings.fontSize || '0.9em';
    const lineHeight = settings.lineHeight || '1.4';

    // Batch translation in groups of 10 to avoid hitting limits
    const batchSize = 10;
    for (let i = 0; i < blocks.length; i += batchSize) {
      const batchBlocks = blocks.slice(i, i + batchSize);
      const textsToTranslate = batchBlocks.map(block => block.textContent.trim());

      // Send batch to background script for translation
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({
          action: 'translate',
          texts: textsToTranslate,
          targetLanguage,
          service,
          apiKey
        }, resolve);
      });

      if (response && response.success && response.translations) {
        response.translations.forEach((translation, index) => {
          const block = batchBlocks[index];
          if (translation && translation !== textsToTranslate[index]) {
            injectTranslation(block, translation, { textColor, fontSize, lineHeight });
          }
        });
      }
    }
  } catch (error) {
    console.error('Translation error:', error);
  } finally {
    isTranslating = false;
    updateFloatBallStatus(false);
  }
}

// Inject translated text element into the DOM block
function injectTranslation(block, translationText, styles) {
  // Prevent double translation
  if (block.getAttribute('data-translated-state') === 'translated') return;

  const transSpan = document.createElement('trans-span');
  transSpan.className = 'bilingual-translated';
  transSpan.textContent = translationText;

  // Apply custom user styles
  transSpan.style.color = styles.textColor;
  transSpan.style.fontSize = styles.fontSize;
  transSpan.style.lineHeight = styles.lineHeight;
  transSpan.style.display = 'block';
  transSpan.style.marginTop = '4px';
  transSpan.style.opacity = '0.85';

  // Inject line break + translation span
  const br = document.createElement('br');
  br.className = 'bilingual-translated-br';
  
  block.appendChild(br);
  block.appendChild(transSpan);
  block.setAttribute('data-translated-state', 'translated');
}

// Restore original page by removing translations
function restorePage() {
  const translations = document.querySelectorAll('.bilingual-translated');
  const breaks = document.querySelectorAll('.bilingual-translated-br');
  const blocks = document.querySelectorAll('[data-translated-state="translated"]');

  translations.forEach(el => el.remove());
  breaks.forEach(el => el.remove());
  blocks.forEach(el => el.removeAttribute('data-translated-state'));

  updateFloatBallStatus(false);
}

// Setup floating action button
function initFloatBall() {
  if (document.getElementById('translation-float-ball')) return;

  const floatBall = document.createElement('div');
  floatBall.id = 'translation-float-ball';
  floatBall.className = 'float-ball-container';

  // Floating button structure
  floatBall.innerHTML = `
    <div class="float-ball-main" title="Bilingual Translation">
      <svg class="float-ball-icon" viewBox="0 0 24 24" width="24" height="24">
        <path fill="currentColor" d="M12.87 15.07l-2.54-2.51.03-.03c1.74-1.94 2.98-4.17 3.71-6.53H17V4h-7V2H8v2H1v2h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"/>
      </svg>
      <div class="float-ball-pulse"></div>
    </div>
    <div class="float-ball-menu">
      <div class="float-ball-menu-item" id="float-btn-translate">Dịch trang</div>
      <div class="float-ball-menu-item" id="float-btn-restore">Khôi phục</div>
      <div class="float-ball-menu-item" id="float-btn-settings">Cài đặt</div>
    </div>
  `;

  document.body.appendChild(floatBall);

  // Set up events
  const mainBtn = floatBall.querySelector('.float-ball-main');
  const menu = floatBall.querySelector('.float-ball-menu');

  mainBtn.addEventListener('click', () => {
    floatBall.classList.toggle('active');
  });

  document.addEventListener('click', (e) => {
    if (!floatBall.contains(e.target)) {
      floatBall.classList.remove('active');
    }
  });

  floatBall.querySelector('#float-btn-translate').addEventListener('click', async () => {
    floatBall.classList.remove('active');
    const settings = await new Promise(resolve => {
      chrome.storage.local.get(['targetLanguage', 'service', 'apiKey'], resolve);
    });
    const targetLang = settings.targetLanguage || 'vi';
    const service = settings.service || 'google';
    const apiKey = settings.apiKey || '';
    
    translatePage(targetLang, service, apiKey);
  });

  floatBall.querySelector('#float-btn-restore').addEventListener('click', () => {
    floatBall.classList.remove('active');
    restorePage();
  });

  floatBall.querySelector('#float-btn-settings').addEventListener('click', () => {
    floatBall.classList.remove('active');
    chrome.runtime.sendMessage({ action: 'open_options_page' }); // We can use background or open directly
    // If runtime open_options exists:
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open(chrome.runtime.getURL('options.html'));
    }
  });
}

// Update the float ball status
function updateFloatBallStatus(loading, text = '') {
  const floatBall = document.getElementById('translation-float-ball');
  if (!floatBall) return;

  const pulse = floatBall.querySelector('.float-ball-pulse');
  const mainBtn = floatBall.querySelector('.float-ball-main');

  if (loading) {
    pulse.classList.add('loading');
    mainBtn.setAttribute('title', text);
  } else {
    pulse.classList.remove('loading');
    mainBtn.setAttribute('title', 'Bilingual Translation');
  }
}

// Listen for messages from Popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'translate_page') {
    translatePage(request.targetLanguage, request.service, request.apiKey)
      .then(() => sendResponse({ success: true }));
    return true;
  } else if (request.action === 'restore_page') {
    restorePage();
    sendResponse({ success: true });
  }
});

// Initialize on page load
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  initFloatBall();
} else {
  window.addEventListener('DOMContentLoaded', initFloatBall);
}
