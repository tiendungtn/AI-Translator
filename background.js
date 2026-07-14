// Background Service Worker for AI Bilingual Translator

const cache = {};

// Helper to get cached translation
function getCachedTranslation(text, targetLang, service) {
  const key = `${service}:${targetLang}:${text}`;
  return cache[key] || null;
}

// Helper to set cached translation
function setCachedTranslation(text, targetLang, service, translation) {
  const key = `${service}:${targetLang}:${text}`;
  cache[key] = translation;
}

// Handle message requests
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'translate') {
    const { texts, targetLanguage, service, apiKey } = request;

    handleTranslation(texts, targetLanguage, service, apiKey)
      .then(translations => sendResponse({ success: true, translations }))
      .catch(error => {
        console.error('Translation error:', error);
        sendResponse({ success: false, error: error.message });
      });

    return true; // Keep message channel open for async response
  }
});

// Main translation orchestrator
async function handleTranslation(texts, targetLanguage, service, apiKey) {
  const results = new Array(texts.length).fill(null);
  const indexesToTranslate = [];
  const textsToTranslate = [];

  // Check cache first
  texts.forEach((text, index) => {
    const cached = getCachedTranslation(text, targetLanguage, service);
    if (cached) {
      results[index] = cached;
    } else {
      indexesToTranslate.push(index);
      textsToTranslate.push(text);
    }
  });

  if (textsToTranslate.length === 0) {
    return results;
  }

  let translations = [];
  if (service === 'gemini' && apiKey) {
    translations = await translateWithGemini(textsToTranslate, targetLanguage, apiKey);
  } else {
    // Default to Google Translate Free
    translations = await translateWithGoogleFree(textsToTranslate, targetLanguage);
  }

  // Map translations back to results and update cache
  translations.forEach((translation, i) => {
    const originalIndex = indexesToTranslate[i];
    const originalText = textsToTranslate[i];
    results[originalIndex] = translation;
    setCachedTranslation(originalText, targetLanguage, service, translation);
  });

  return results;
}

// Google Translate Free API (translating in parallel with concurrency control)
async function translateWithGoogleFree(texts, targetLanguage) {
  const limit = 5; // max concurrent requests
  const results = [];

  for (let i = 0; i < texts.length; i += limit) {
    const chunk = texts.slice(i, i + limit);
    const promises = chunk.map(text => {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLanguage}&dt=t&q=${encodeURIComponent(text)}`;
      return fetch(url)
        .then(res => {
          if (!res.ok) throw new Error(`Google API responded with status ${res.status}`);
          return res.json();
        })
        .then(data => {
          // Parse Google Translate response structure: [[["translated_text", "original_text", ...]]]
          if (data && data[0]) {
            return data[0].map(item => item[0]).join('');
          }
          return text; // fallback
        })
        .catch(err => {
          console.error('Single text google translate error:', err);
          return text; // return original as fallback
        });
    });

    const chunkResults = await Promise.all(promises);
    results.push(...chunkResults);
  }

  return results;
}

// Gemini API Translation (Batch mode using JSON structure response)
async function translateWithGemini(texts, targetLanguage, apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  
  const prompt = `You are a professional website translation tool. Translate the following array of texts into the language with code/name: "${targetLanguage}".
Keep the exact same array structure. Return ONLY a valid JSON array of strings in the same order as the input.
Do not add markdown formatting, notes, or wrap in backticks.
Input array: ${JSON.stringify(texts)}`;

  const requestBody = {
    contents: [
      {
        parts: [
          { text: prompt }
        ]
      }
    ],
    generationConfig: {
      responseMimeType: "application/json"
    }
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts[0]) {
      const responseText = data.candidates[0].content.parts[0].text.trim();
      const parsedArray = JSON.parse(responseText);
      if (Array.isArray(parsedArray)) {
        return parsedArray.map((t, idx) => t || texts[idx]);
      }
    }
    throw new Error('Invalid response structure from Gemini API');
  } catch (error) {
    console.error('Gemini batch translation failed, falling back to Google:', error);
    // Fallback to Google Translate if Gemini fails
    return translateWithGoogleFree(texts, targetLanguage);
  }
}
