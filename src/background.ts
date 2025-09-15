// background service worker (translated from JS)
// Keep a minimal polling loop for other uses, but implement the message
// handler that the content script expects.

function polling() {
  // console.log("polling");
  setTimeout(polling, 1000 * 30);
}

polling();

chrome.runtime.onInstalled.addListener(() => {
  console.log('LinkedIn Commentator extension installed');
});
// AnyObject is declared in src/types.d.ts

chrome.runtime.onMessage.addListener((message: any, sender: any, sendResponse: (resp?: any) => void) => {
  if (!message || !message.action) return;

  if (message.action === 'ping') {
    sendResponse({ pong: true });
    return;
  }

  if (message.action === 'generate_comment') {
    // Asynchronous response: return true to keep the message channel open
    (async () => {
      const postText: string = message.postText || '';
      try {
        // Prefer the Prompt API LanguageModel if available
        const LM = (globalThis as any).LanguageModel;
        if (typeof LM !== 'undefined' && LM) {
          // availability may be a function or a property depending on the runtime
          let available: any = 'available';
          try {
            if (typeof LM.availability === 'function') available = await LM.availability();
            else if (LM.availability) available = LM.availability;
          } catch (e) {
            available = 'unavailable';
          }

          if (available === 'unavailable') {
            sendResponse({ error: 'LanguageModel unavailable on this device' });
            return;
          }

          const session = await LM.create();
          try {
            const prompt = `Write a short, friendly, professional LinkedIn comment (1-2 sentences) in response to the following post content. Keep it positive and concise.\n\nPost:\n${postText}`;
            // session.prompt may return a string or an object depending on environment
            const result = await session.prompt(prompt);
            sendResponse({ comment: (result || '').toString().trim() });
          } finally {
            if (session && typeof session.destroy === 'function') {
              try { await session.destroy(); } catch (e) { /* ignore */ }
            }
          }
          return;
        }

        // Fallback: older chrome.ai.generate shape if present
  const chromeAny = (chrome as any);
  if (chromeAny.ai && typeof chromeAny.ai.generate === 'function') {
          const prompt = `Write a short, friendly, professional LinkedIn comment (1-2 sentences) in response to the following post content. Keep it positive and concise.\n\nPost:\n${postText}`;
          const response = await chromeAny.ai.generate({ model: 'gen-1', prompt, max_output_tokens: 256 });
          let text = '';
          if (response && response.output_text) text = response.output_text.trim();
          else if (response && Array.isArray(response.output) && response.output.length) {
            text = response.output.map((o: any) => (o.content || []).map((c: any) => c.text || '').join('')).join('\n').trim();
          }
          sendResponse({ comment: text });
          return;
        }

        sendResponse({ error: 'No compatible built-in AI API available (LanguageModel or chrome.ai)' });
      } catch (err) {
        sendResponse({ error: String(err) });
      }
    })();

    return true;
  }
});
