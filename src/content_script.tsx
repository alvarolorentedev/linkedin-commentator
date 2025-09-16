// content script injected into LinkedIn pages (translated to TypeScript)
console.log('LinkedIn Commentator content script loaded');

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
      (cur.tagName.toLowerCase() === 'article' || cur.getAttribute('role') === 'article' || (cur as any).dataset?.urn)
    ) {
      return cur;
    }
    cur = cur.parentElement;
  }
  return null;
}

// Extract visible text content from a post container
function extractPostText(postEl: HTMLElement | null): string {
  if (!postEl) return '';
  const desc = postEl.querySelector('.feed-shared-update-v2__description');
  if (desc) {
    const clone = desc.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('button, a, script, style').forEach(n => n.remove());
    const text = clone.textContent || '';
    return text.replace(/\s+/g, ' ').trim();
  }

  const clone = postEl.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('button, a, script, style').forEach(n => n.remove());
  const text = clone.textContent || '';
  return text.replace(/\s+/g, ' ').trim();
}

// Find or create the comment input area within a post
function findCommentComposer(postEl: HTMLElement | null): HTMLElement | null {
  if (!postEl) return null;
  const composer = postEl.querySelector('[contenteditable][role="textbox"]') as HTMLElement | null;
  if (composer) return composer;
  return document.querySelector('[contenteditable][role="textbox"]');
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
  if (!postText) return;

  const buttons = Array.from((postEl || document).querySelectorAll('button')) as HTMLButtonElement[];
  const commentBtn = buttons.find(b => {
    const a = (b.getAttribute && b.getAttribute('aria-label')) || '';
    const text = ((b.innerText || '') + ' ' + a).toLowerCase();
    return text.includes('comment');
  });

  const composer = findCommentComposer(postEl);

  if (!document.getElementById('lc-spinner-style')) {
    const s = document.createElement('style');
    s.id = 'lc-spinner-style';
    s.textContent = `
      .lc-spinner-container { display:inline-flex; align-items:center; gap:6px; margin-left:8px; font-size:12px; color:#0a66c2; }
      .lc-spinner { display:inline-block; width:14px; height:14px; border:2px solid rgba(0,0,0,0.15); border-top-color:currentColor; border-radius:50%; animation:lc-spin 800ms linear infinite; vertical-align:middle; }
      .lc-spinner-text { display:inline-block; line-height:1; }
      @keyframes lc-spin { to { transform: rotate(360deg); } }
    `;
    document.head.appendChild(s);
  }

  const spinnerContainer = document.createElement('span');
  spinnerContainer.className = 'lc-spinner-container';
  spinnerContainer.setAttribute('aria-hidden', 'true');
  const innerSpinner = document.createElement('span');
  innerSpinner.className = 'lc-spinner';
  innerSpinner.setAttribute('aria-hidden', 'true');
  const textSpan = document.createElement('span');
  textSpan.className = 'lc-spinner-text';
  textSpan.textContent = 'Generating…';
  spinnerContainer.appendChild(innerSpinner);
  spinnerContainer.appendChild(textSpan);

  if (commentBtn) {
    try {
      commentBtn.setAttribute('data-lc-prev-disabled', commentBtn.disabled ? '1' : '0');
      commentBtn.disabled = true;
      commentBtn.setAttribute('data-lc-disabled', '1');
      commentBtn.setAttribute('aria-busy', 'true');
    } catch (e) { /* ignore */ }
  }

  if (composer) {
    try {
      if ((composer as any).isContentEditable) {
        composer.setAttribute('data-lc-prev-contenteditable', 'true');
        composer.setAttribute('contenteditable', 'false');
      } else if (composer.tagName === 'TEXTAREA' || composer.tagName === 'INPUT') {
        composer.setAttribute('data-lc-prev-disabled', (composer as HTMLInputElement).disabled ? '1' : '0');
        (composer as HTMLInputElement).disabled = true;
      }
      try {
        const parent = composer.parentElement || composer;
        if (!parent.querySelector('.lc-spinner-container')) {
          if (composer.nextSibling) parent.insertBefore(spinnerContainer, composer.nextSibling);
          else parent.appendChild(spinnerContainer);
        }
      } catch (e) { /* ignore spinner insertion errors */ }
    } catch (e) { /* ignore */ }
  }

  if (!composer && commentBtn) {
    try {
      if (!commentBtn.querySelector('.lc-spinner-container')) commentBtn.appendChild(spinnerContainer);
    } catch (e) { /* ignore */ }
  }

  chrome.runtime.sendMessage({ action: 'generate_comment', postText }, (resp: any) => {
    const restoreUI = () => {
      if (commentBtn) {
        try {
          const prev = commentBtn.getAttribute('data-lc-prev-disabled');
          if (prev === '1') commentBtn.disabled = true; else commentBtn.disabled = false;
          commentBtn.removeAttribute('data-lc-disabled');
          commentBtn.removeAttribute('data-lc-prev-disabled');
          commentBtn.removeAttribute('aria-busy');
          const btnSp = commentBtn.querySelector('.lc-spinner-container');
          if (btnSp) btnSp.remove();
        } catch (e) { /* ignore */ }
      }

      if (composer) {
        try {
          if ((composer as any).isContentEditable !== undefined) {
            if (composer.getAttribute('data-lc-prev-contenteditable') === 'true') composer.setAttribute('contenteditable', 'true');
            composer.removeAttribute('data-lc-prev-contenteditable');
          }
          if (composer.tagName === 'TEXTAREA' || composer.tagName === 'INPUT') {
            const prev = composer.getAttribute('data-lc-prev-disabled');
            if (prev === '1') (composer as HTMLInputElement).disabled = true; else (composer as HTMLInputElement).disabled = false;
            composer.removeAttribute('data-lc-prev-disabled');
          }
          try {
            const parent = composer.parentElement || composer;
            const sp = parent.querySelector('.lc-spinner-container');
            if (sp) sp.remove();
          } catch (e) { /* ignore */ }
        } catch (e) { /* ignore */ }
      }
    };

    if (!resp) { restoreUI(); return; }
    if (resp.error) {
      console.warn('AI generation error:', resp.error);
      restoreUI();
      return;
    }
    const comment = resp.comment || resp;
    if (!comment) { restoreUI(); return; }

    if (!composer) {
      console.warn('Could not find comment composer');
      restoreUI();
      return;
    }

    try {
      if ((composer as any).isContentEditable) {
        (composer as HTMLElement).focus();
        (composer as HTMLElement).innerText = comment;
        composer.dispatchEvent(new InputEvent('input', { bubbles: true }));
      } else if (composer.tagName === 'TEXTAREA' || composer.tagName === 'INPUT') {
        (composer as HTMLInputElement).value = comment;
        composer.dispatchEvent(new Event('input', { bubbles: true }));
      } else {
        composer.textContent = comment as string;
      }
    } catch (e) {
      console.warn('Failed to insert comment into composer', e);
    }

    restoreUI();
  });
}

// Observe for comment button clicks across the feed
document.addEventListener('click', (e) => {
  const target = (e.target as HTMLElement | null);
  const btn = target && target.closest ? target.closest('button[aria-label]') as HTMLButtonElement | null : null;
  if (!btn) return;
  const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
  if (aria === 'comment' || aria.includes('comment')) {
    const post = findPostContainer(btn);
    if (post) {
      setTimeout(() => {
        if (!isBuiltinAIAvailable()) {
          showEnableAIModal();
          return;
        }
        generateAndInsertComment(post);
      }, 600);
    }
  }
});
