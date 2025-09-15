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
      setTimeout(() => generateAndInsertComment(post), 600);
    }
  }
});
