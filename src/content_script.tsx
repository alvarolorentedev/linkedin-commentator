// content script injected into LinkedIn pages (translated to TypeScript)
console.log('LinkedIn Commentator content script loaded');

const DEBUG = true;

function debugLog(message: string, data?: any) {
  if (!DEBUG) return;
  if (typeof data === 'undefined') {
    console.log(`[LinkedIn Commentator] ${message}`);
    return;
  }
  console.log(`[LinkedIn Commentator] ${message}`, data);
}

// Keep the simple message handler sample
chrome.runtime.onMessage.addListener(function (msg: any, sender: any, sendResponse: (resp?: any) => void) {
  if (msg.color) {
    console.log('Receive color = ' + msg.color);
    (document.body.style as any).backgroundColor = msg.color;
    sendResponse('Change color to ' + msg.color);
  } else {
    sendResponse('Color message is none.');
  }
});

// Utility: find the nearest post container for a given element
function findPostContainer(el: HTMLElement | null): HTMLElement | null {
  let cur: HTMLElement | null = el;
  while (cur && cur !== document.body) {
    if (
      cur.tagName &&
      (
        cur.tagName.toLowerCase() === 'article' ||
        cur.getAttribute('role') === 'article' ||
        cur.getAttribute('role') === 'listitem' ||
        (cur as any).dataset?.urn
      )
    ) {
      debugLog('Post container found', { tagName: cur.tagName, role: cur.getAttribute('role') });
      return cur;
    }
    cur = cur.parentElement;
  }
  debugLog('No post container found');
  return null;
}

function extractVisibleText(node: HTMLElement | null): string {
  if (!node) return '';

  const clone = node.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('button, script, style, svg, noscript').forEach(n => n.remove());

  const text = (clone.innerText || clone.textContent || '').replace(/\s+/g, ' ').trim();
  return text;
}

// Extract visible text content from a post container
function extractPostText(postEl: HTMLElement | null): string {
  if (!postEl) return '';

  const selectors = [
    '[data-testid="expandable-text-box"]',
    '.feed-shared-update-v2__description',
    '[data-testid="feed-shared-update-v2__description"]',
  ];

  for (const selector of selectors) {
    const candidate = postEl.querySelector(selector) as HTMLElement | null;
    const text = extractVisibleText(candidate);
    if (text) {
      debugLog('Post text extracted from selector', { selector, preview: text.slice(0, 180) });
      return text;
    }
  }

  const fallbackText = extractVisibleText(postEl);
  debugLog('Post text extracted from fallback container', { preview: fallbackText.slice(0, 180) });
  return fallbackText;
}

// Find or create the comment input area within a post
function findCommentComposer(postEl: HTMLElement | null): HTMLElement | null {
  if (!postEl) return null;

  const selectors = [
    '[data-testid="ui-core-tiptap-text-editor-wrapper"] [contenteditable][role="textbox"]',
    '[data-testid="ui-core-tiptap-text-editor-wrapper"] [contenteditable="true"]',
    '[contenteditable][role="textbox"]',
  ];

  for (const selector of selectors) {
    const composer = postEl.querySelector(selector) as HTMLElement | null;
    if (composer) {
      debugLog('Composer found inside post', { selector });
      return composer;
    }
  }

  for (const selector of selectors) {
    const composer = document.querySelector(selector) as HTMLElement | null;
    if (composer) {
      debugLog('Composer found in document', { selector });
      return composer;
    }
  }

  debugLog('Composer not found');
  return null;
}

async function waitForCommentComposer(postEl: HTMLElement | null, timeoutMs: number = 5000): Promise<HTMLElement | null> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const composer = findCommentComposer(postEl);
    if (composer) return composer;
    await new Promise(resolve => window.setTimeout(resolve, 150));
  }

  return null;
}

function isCommentButton(btn: HTMLButtonElement): boolean {
  const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
  if (aria === 'comment' || aria.includes('comment')) return true;

  const text = (btn.innerText || btn.textContent || '').toLowerCase();
  if (text.includes('comment')) return true;

  return Boolean(btn.querySelector('svg#comment-small'));
}

function setCommentButtonLoadingState(commentBtn: HTMLButtonElement) {
  if (commentBtn.getAttribute('data-lc-loading') === '1') return;

  commentBtn.setAttribute('data-lc-loading', '1');
  commentBtn.setAttribute('data-lc-prev-disabled', commentBtn.disabled ? '1' : '0');
  commentBtn.setAttribute('data-lc-prev-innerhtml', commentBtn.innerHTML);
  commentBtn.setAttribute('data-lc-prev-aria-label', commentBtn.getAttribute('aria-label') || '');
  commentBtn.disabled = true;
  commentBtn.setAttribute('data-lc-disabled', '1');
  commentBtn.setAttribute('aria-busy', 'true');
  commentBtn.innerHTML = `
    <span class="lc-commenting-state" aria-hidden="true">
      <span class="lc-spinner" aria-hidden="true"></span>
      <span class="lc-spinner-text">Commenting…</span>
    </span>
  `;
}

function restoreCommentButtonState(commentBtn: HTMLButtonElement) {
  try {
    const prevDisabled = commentBtn.getAttribute('data-lc-prev-disabled');
    const prevInnerHtml = commentBtn.getAttribute('data-lc-prev-innerhtml');
    const prevAriaLabel = commentBtn.getAttribute('data-lc-prev-aria-label');

    if (prevInnerHtml !== null) commentBtn.innerHTML = prevInnerHtml;
    if (prevDisabled === '1') commentBtn.disabled = true; else commentBtn.disabled = false;
    if (prevAriaLabel !== null) commentBtn.setAttribute('aria-label', prevAriaLabel);

    commentBtn.removeAttribute('data-lc-loading');
    commentBtn.removeAttribute('data-lc-disabled');
    commentBtn.removeAttribute('data-lc-prev-disabled');
    commentBtn.removeAttribute('data-lc-prev-innerhtml');
    commentBtn.removeAttribute('data-lc-prev-aria-label');
    commentBtn.removeAttribute('aria-busy');
  } catch (e) { /* ignore */ }
}

function showTransientNotice(message: string, kind: 'info' | 'error' = 'info') {
  const existing = document.getElementById('lc-transient-notice');
  if (existing) existing.remove();

  const style = document.createElement('style');
  style.id = 'lc-transient-notice-style';
  style.textContent = `
    #lc-transient-notice { position: fixed; right: 16px; bottom: 16px; z-index: 2147483647; max-width: 340px; padding: 10px 12px; border-radius: 10px; font: 600 13px/1.35 Inter, Roboto, system-ui, -apple-system, 'Segoe UI', Arial; box-shadow: 0 12px 40px rgba(11,37,69,0.18); color: #fff; }
    #lc-transient-notice[data-kind='info'] { background: #0a66c2; }
    #lc-transient-notice[data-kind='error'] { background: #b42318; }
  `;
  if (!document.getElementById('lc-transient-notice-style')) document.head.appendChild(style);

  const notice = document.createElement('div');
  notice.id = 'lc-transient-notice';
  notice.setAttribute('data-kind', kind);
  notice.textContent = message;
  document.body.appendChild(notice);

  window.setTimeout(() => {
    try { notice.remove(); } catch (e) { /* ignore */ }
    try { style.remove(); } catch (e) { /* ignore */ }
  }, 2500);
}

// Check whether a built-in AI API is available in this browser runtime
function isBuiltinAIAvailable(): boolean {
  try {
    const gg = (globalThis as any);
    if (typeof gg.LanguageModel !== 'undefined' && gg.LanguageModel) return true;
    if (typeof (chrome as any) !== 'undefined' && (chrome as any).ai && typeof (chrome as any).ai.generate === 'function') return true;
  } catch (e) { /* ignore */ }
  return false;
}

// Show an in-page modal explaining how to enable built-in AI features
function showEnableAIModal() {
  if (document.getElementById('lc-enable-ai-modal')) return;

  const style = document.createElement('style');
  style.id = 'lc-enable-ai-style';
  style.textContent = `
    #lc-enable-ai-modal { position: fixed; left: 12px; right: 12px; top: 80px; max-width: 720px; margin: 0 auto; z-index: 2147483647; }
    .lc-enable-ai-card { background: #fff; border-radius: 8px; box-shadow: 0 12px 40px rgba(11,37,69,0.12); padding: 16px; color: #0b2545; font-family: Inter, Roboto, system-ui, -apple-system, 'Segoe UI', Arial; }
    .lc-enable-ai-card h3 { margin: 0 0 8px 0; font-size: 16px; }
    .lc-enable-ai-card p { margin: 6px 0; font-size: 13px; line-height: 1.3; }
  .lc-enable-ai-card pre { background: #f6f9ff; padding: 10px; border-radius: 6px; overflow: auto; font-size: 12px; }
  /* right-align the close button */
  .lc-enable-ai-close { display:inline-block; margin-top:8px; padding:6px 10px; border-radius:6px; background:#0a66c2; color:#fff; cursor:pointer; border:none; float:right; }
  `;
  document.head.appendChild(style);

  const modal = document.createElement('div');
  modal.id = 'lc-enable-ai-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');

  const card = document.createElement('div');
  card.className = 'lc-enable-ai-card';

  const title = document.createElement('h3');
  title.textContent = 'Enable Chrome built-in AI features';
  card.appendChild(title);

  const body = document.createElement('div');
  body.innerHTML = `
    <p>This extension uses Chrome's built-in Translation API and Gemini Nano AI, which requires Chrome v138 or newer and the Experimental Web Platform features enabled.</p>
    <p>Follow these steps to enable the required components:</p>
    <pre>
Download and install Chrome with built-in AI Latest Version.
Go to chrome://flags/#enable-experimental-web-platform-features and enable the Experimental Web Platform features option.
Go to chrome://flags/#translation-api and enable the Translation API option.
Go to chrome://flags/#language-detection-api and enable the Language Detection API option (for automatic language detection).
Go to chrome://flags/#prompt-api-for-gemini-nano and enable the Prompt API for Gemini Nano option.
Go to chrome://flags/#optimization-guide-on-device-model and enable the Enables optimization guide on device option.
Go to chrome://components/ and check or download the latest version of Optimization Guide On Device Model.
Restart Chrome browser to apply changes.
    </pre>
  `;
  card.appendChild(body);

  const closeBtn = document.createElement('button');
  closeBtn.className = 'lc-enable-ai-close';
  closeBtn.textContent = 'Close';
  closeBtn.onclick = () => {
    try { modal.remove(); } catch (e) { /* ignore */ }
    try { style.remove(); } catch (e) { /* ignore */ }
  };
  card.appendChild(closeBtn);

  modal.appendChild(card);
  document.body.appendChild(modal);
  // focus the close button for accessibility
  closeBtn.focus();
}

async function generateAndInsertComment(postEl: HTMLElement | null) {
  const postText = extractPostText(postEl);
  if (!postText) {
    debugLog('Generation aborted because no post text was extracted');
    return;
  }

  debugLog('Starting comment generation', { postPreview: postText.slice(0, 180) });

  const buttons = Array.from((postEl || document).querySelectorAll('button')) as HTMLButtonElement[];
  const commentBtn = buttons.find(b => {
    const a = (b.getAttribute && b.getAttribute('aria-label')) || '';
    const text = ((b.innerText || '') + ' ' + a).toLowerCase();
    return text.includes('comment');
  });

  let composer = findCommentComposer(postEl);

  debugLog('Generation targets resolved', {
    hasCommentButton: Boolean(commentBtn),
    hasComposer: Boolean(composer),
  });

  if (!document.getElementById('lc-spinner-style')) {
    const s = document.createElement('style');
    s.id = 'lc-spinner-style';
    s.textContent = `
      .lc-commenting-state { display:inline-flex; align-items:center; gap:6px; font-size: inherit; color: inherit; }
      .lc-spinner { display:inline-block; width:14px; height:14px; border:2px solid rgba(0,0,0,0.15); border-top-color:currentColor; border-radius:50%; animation:lc-spin 800ms linear infinite; vertical-align:middle; }
      .lc-spinner-text { display:inline-block; line-height:1; }
      @keyframes lc-spin { to { transform: rotate(360deg); } }
    `;
    document.head.appendChild(s);
  }

  if (commentBtn) {
    try {
      setCommentButtonLoadingState(commentBtn);
    } catch (e) { /* ignore */ }
  }

  const restoreUI = () => {
    if (commentBtn) {
      restoreCommentButtonState(commentBtn);
    }
  };

  try {
    const settings = await new Promise<{ commentTone?: string; commentPrompt?: string }>((resolve) => {
      try {
        chrome.storage.sync.get({ commentTone: 'friendly', commentPrompt: '' }, (items: any) => resolve(items || {}));
      } catch (e) {
        resolve({ commentTone: 'friendly', commentPrompt: '' });
      }
    });

    const tone = settings.commentTone || 'friendly';
    const customPrompt = settings.commentPrompt || '';
    const defaultPrompt = 'Write a short, friendly, professional LinkedIn comment (1-2 sentences) in response to the following post content. Keep it positive and concise. Return only the comment text.';
    const basePrompt = customPrompt.trim().length ? customPrompt : defaultPrompt;
    const prompt = `${basePrompt}\n\nTone: ${tone}\n\nPost content:\n${postText}`;

    debugLog('Prompt assembled', {
      tone,
      hasCustomPrompt: Boolean(customPrompt.trim().length),
      promptPreview: prompt.slice(0, 260),
    });

    let comment = '';
    const LM = (globalThis as any).LanguageModel;
    if (typeof LM !== 'undefined' && LM) {
      debugLog('Using LanguageModel API');
      const session = await LM.create();
      try {
        const result = await session.prompt(prompt);
        comment = (result || '').toString().trim();
        debugLog('LanguageModel response received', { commentPreview: comment.slice(0, 180) });
      } finally {
        if (session && typeof session.destroy === 'function') {
          try { await session.destroy(); } catch (e) { /* ignore */ }
        }
      }
    } else {
      const chromeAny = chrome as any;
      if (chromeAny.ai && typeof chromeAny.ai.generate === 'function') {
        debugLog('Using chrome.ai.generate fallback');
        const response = await chromeAny.ai.generate({ model: 'gen-1', prompt, max_output_tokens: 256 });
        if (response && response.output_text) comment = response.output_text.trim();
        else if (response && Array.isArray(response.output) && response.output.length) {
          comment = response.output.map((o: any) => (o.content || []).map((c: any) => c.text || '').join('')).join('\n').trim();
        }
        debugLog('chrome.ai.generate response received', { commentPreview: comment.slice(0, 180) });
      } else {
        debugLog('No compatible built-in AI API available in this context');
        throw new Error('No compatible built-in AI API available');
      }
    }

    if (!comment) {
      debugLog('AI returned an empty comment');
      restoreUI();
      return;
    }

    if (!composer) {
      debugLog('Composer missing before insertion, waiting for it to render');
      composer = await waitForCommentComposer(postEl, 5000);
      debugLog('Composer wait finished', { hasComposer: Boolean(composer) });
    }

    if (!composer) {
      console.warn('Could not find comment composer');
      debugLog('Insertion aborted because the composer was not found');
      restoreUI();
      return;
    }

    try {
      if ((composer as any).isContentEditable) {
        debugLog('Inserting into contenteditable composer');
        (composer as HTMLElement).focus();
        (composer as HTMLElement).innerText = comment;
        composer.dispatchEvent(new InputEvent('input', { bubbles: true }));
      } else if (composer.tagName === 'TEXTAREA' || composer.tagName === 'INPUT') {
        debugLog('Inserting into input/textarea composer');
        (composer as HTMLInputElement).value = comment;
        composer.dispatchEvent(new Event('input', { bubbles: true }));
      } else {
        debugLog('Inserting via textContent fallback');
        composer.textContent = comment as string;
      }
      debugLog('Comment insertion complete', { insertedPreview: comment.slice(0, 180) });
    } catch (e) {
      console.warn('Failed to insert comment into composer', e);
      debugLog('Comment insertion failed', e);
    }
  } catch (err) {
    console.warn('AI generation error:', err);
    debugLog('AI generation failed', err);
  } finally {
    restoreUI();
  }
}

// Observe for comment button clicks across the feed
document.addEventListener('click', (e) => {
  const target = (e.target as HTMLElement | null);
  const btn = target && target.closest ? target.closest('button') as HTMLButtonElement | null : null;
  if (!btn) return;
  if (isCommentButton(btn)) {
    debugLog('Comment button click detected', {
      ariaLabel: btn.getAttribute('aria-label'),
      text: (btn.innerText || btn.textContent || '').slice(0, 120),
    });
    const post = findPostContainer(btn);
    if (post) {
      showTransientNotice('Generating comment...');
      debugLog('Attempting comment generation after click');
      if (!isBuiltinAIAvailable()) {
        debugLog('Built-in AI unavailable check failed');
        showTransientNotice('Chrome built-in AI is unavailable in this context.', 'error');
        showEnableAIModal();
        return;
      }
      debugLog('Built-in AI available, starting generation');
      generateAndInsertComment(post);
    }
  }
}, true);
