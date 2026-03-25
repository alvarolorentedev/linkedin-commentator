function findPostContainer(el: HTMLElement | null): HTMLElement | null {
  for (let current = el; current && current !== document.body; current = current.parentElement) {
    if (
      current.tagName.toLowerCase() === 'article' ||
      current.getAttribute('role') === 'article' ||
      current.getAttribute('role') === 'listitem' ||
      Boolean((current as HTMLElement).dataset?.urn)
    ) {
      return current;
    }
  }

  return null;
}

function extractVisibleText(node: HTMLElement | null): string {
  if (!node) return '';

  const clone = node.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('button, script, style, svg, noscript').forEach((element) => element.remove());
  return (clone.innerText || clone.textContent || '').replace(/\s+/g, ' ').trim();
}

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
    if (text) return text;
  }

  return extractVisibleText(postEl);
}

function findCommentComposer(postEl: HTMLElement | null): HTMLElement | null {
  if (!postEl) return null;

  const selectors = [
    '[data-testid="ui-core-tiptap-text-editor-wrapper"] [contenteditable][role="textbox"]',
    '[data-testid="ui-core-tiptap-text-editor-wrapper"] [contenteditable="true"]',
    '[contenteditable][role="textbox"]',
  ];

  for (const selector of selectors) {
    const composer = postEl.querySelector(selector) as HTMLElement | null;
    if (composer) return composer;
  }

  for (const selector of selectors) {
    const composer = document.querySelector(selector) as HTMLElement | null;
    if (composer) return composer;
  }

  return null;
}

async function waitForCommentComposer(postEl: HTMLElement | null, timeoutMs = 5000): Promise<HTMLElement | null> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const composer = findCommentComposer(postEl);
    if (composer) return composer;
    await new Promise((resolve) => window.setTimeout(resolve, 150));
  }

  return null;
}

function isCommentButton(button: HTMLButtonElement): boolean {
  const ariaLabel = (button.getAttribute('aria-label') || '').toLowerCase();
  if (ariaLabel.includes('comment')) return true;

  const text = (button.innerText || button.textContent || '').toLowerCase();
  if (text.includes('comment')) return true;

  return Boolean(button.querySelector('svg#comment-small'));
}

function setCommentButtonLoadingState(button: HTMLButtonElement) {
  if (button.getAttribute('data-lc-loading') === '1') return;

  button.setAttribute('data-lc-loading', '1');
  button.setAttribute('data-lc-prev-disabled', button.disabled ? '1' : '0');
  button.setAttribute('data-lc-prev-innerhtml', button.innerHTML);
  button.setAttribute('data-lc-prev-aria-label', button.getAttribute('aria-label') || '');
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  button.innerHTML = `
    <span class="lc-commenting-state" aria-hidden="true">
      <span class="lc-spinner" aria-hidden="true"></span>
      <span class="lc-spinner-text">Commenting…</span>
    </span>
  `;
}

function restoreCommentButtonState(button: HTMLButtonElement) {
  const prevDisabled = button.getAttribute('data-lc-prev-disabled');
  const prevInnerHtml = button.getAttribute('data-lc-prev-innerhtml');
  const prevAriaLabel = button.getAttribute('data-lc-prev-aria-label');

  if (prevInnerHtml !== null) button.innerHTML = prevInnerHtml;
  button.disabled = prevDisabled === '1';
  if (prevAriaLabel !== null) button.setAttribute('aria-label', prevAriaLabel);

  button.removeAttribute('data-lc-loading');
  button.removeAttribute('data-lc-prev-disabled');
  button.removeAttribute('data-lc-prev-innerhtml');
  button.removeAttribute('data-lc-prev-aria-label');
  button.removeAttribute('aria-busy');
}

function showTransientNotice(message: string, kind: 'info' | 'error' = 'info') {
  const existing = document.getElementById('lc-transient-notice');
  if (existing) existing.remove();

  if (!document.getElementById('lc-transient-notice-style')) {
    const style = document.createElement('style');
    style.id = 'lc-transient-notice-style';
    style.textContent = `
      #lc-transient-notice { position: fixed; right: 16px; bottom: 16px; z-index: 2147483647; max-width: 340px; padding: 10px 12px; border-radius: 10px; font: 600 13px/1.35 Inter, Roboto, system-ui, -apple-system, 'Segoe UI', Arial; box-shadow: 0 12px 40px rgba(11,37,69,0.18); color: #fff; }
      #lc-transient-notice[data-kind='info'] { background: #0a66c2; }
      #lc-transient-notice[data-kind='error'] { background: #b42318; }
    `;
    document.head.appendChild(style);
  }

  const notice = document.createElement('div');
  notice.id = 'lc-transient-notice';
  notice.setAttribute('data-kind', kind);
  notice.textContent = message;
  document.body.appendChild(notice);

  window.setTimeout(() => notice.remove(), 2500);
}

function isBuiltinAIAvailable(): boolean {
  const globalAny = globalThis as any;
  const chromeAny = chrome as any;
  return Boolean(globalAny.LanguageModel) || Boolean(chromeAny?.ai && typeof chromeAny.ai.generate === 'function');
}

function showEnableAIModal() {
  if (document.getElementById('lc-enable-ai-modal')) return;

  let style: HTMLStyleElement | null = null;
  if (!document.getElementById('lc-enable-ai-style')) {
    style = document.createElement('style');
    style.id = 'lc-enable-ai-style';
    style.textContent = `
      #lc-enable-ai-modal { position: fixed; left: 12px; right: 12px; top: 80px; max-width: 720px; margin: 0 auto; z-index: 2147483647; }
      .lc-enable-ai-card { background: #fff; border-radius: 8px; box-shadow: 0 12px 40px rgba(11,37,69,0.12); padding: 16px; color: #0b2545; font-family: Inter, Roboto, system-ui, -apple-system, 'Segoe UI', Arial; }
      .lc-enable-ai-card h3 { margin: 0 0 8px 0; font-size: 16px; }
      .lc-enable-ai-card p { margin: 6px 0; font-size: 13px; line-height: 1.3; }
      .lc-enable-ai-card pre { background: #f6f9ff; padding: 10px; border-radius: 6px; overflow: auto; font-size: 12px; }
      .lc-enable-ai-close { display: inline-block; margin-top: 8px; padding: 6px 10px; border-radius: 6px; background: #0a66c2; color: #fff; cursor: pointer; border: none; float: right; }
    `;
    document.head.appendChild(style);
  }

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

  const closeButton = document.createElement('button');
  closeButton.className = 'lc-enable-ai-close';
  closeButton.textContent = 'Close';
  closeButton.onclick = () => {
    modal.remove();
    style?.remove();
  };
  card.appendChild(closeButton);

  modal.appendChild(card);
  document.body.appendChild(modal);
  closeButton.focus();
}

function extractGeneratedText(response: any): string {
  if (response?.output_text) return response.output_text.trim();
  if (response && Array.isArray(response.output) && response.output.length) {
    return response.output
      .map((outputItem: any) => (outputItem.content || []).map((contentItem: any) => contentItem.text || '').join(''))
      .join('\n')
      .trim();
  }

  return '';
}

async function generateAndInsertComment(postEl: HTMLElement | null) {
  const postText = extractPostText(postEl);
  if (!postText) return;

  const buttons = Array.from((postEl || document).querySelectorAll('button')) as HTMLButtonElement[];
  const commentButton = buttons.find(isCommentButton);
  let composer = findCommentComposer(postEl);

  if (!document.getElementById('lc-spinner-style')) {
    const style = document.createElement('style');
    style.id = 'lc-spinner-style';
    style.textContent = `
      .lc-commenting-state { display: inline-flex; align-items: center; gap: 6px; font-size: inherit; color: inherit; }
      .lc-spinner { display: inline-block; width: 14px; height: 14px; border: 2px solid rgba(0,0,0,0.15); border-top-color: currentColor; border-radius: 50%; animation: lc-spin 800ms linear infinite; vertical-align: middle; }
      .lc-spinner-text { display: inline-block; line-height: 1; }
      @keyframes lc-spin { to { transform: rotate(360deg); } }
    `;
    document.head.appendChild(style);
  }

  if (commentButton) setCommentButtonLoadingState(commentButton);

  const restoreUI = () => {
    if (commentButton) restoreCommentButtonState(commentButton);
  };

  try {
    const settings = await new Promise<{ commentTone?: string; commentPrompt?: string }>((resolve) => {
      try {
        chrome.storage.sync.get({ commentTone: 'friendly', commentPrompt: '' }, (items: any) => resolve(items || {}));
      } catch {
        resolve({ commentTone: 'friendly', commentPrompt: '' });
      }
    });

    const tone = settings.commentTone || 'friendly';
    const customPrompt = settings.commentPrompt || '';
    const defaultPrompt = 'Write a short, friendly, professional LinkedIn comment (1-2 sentences) in response to the following post content. Keep it positive and concise. Return only the comment text.';
    const prompt = `${customPrompt.trim().length ? customPrompt : defaultPrompt}\n\nTone: ${tone}\n\nPost content:\n${postText}`;

    let comment = '';
    const globalAny = globalThis as any;
    const languageModel = globalAny.LanguageModel;

    if (typeof languageModel !== 'undefined' && languageModel) {
      const session = await languageModel.create();
      try {
        const result = await session.prompt(prompt);
        comment = (result || '').toString().trim();
      } finally {
        if (session && typeof session.destroy === 'function') {
          try {
            await session.destroy();
          } catch {
          }
        }
      }
    } else {
      const chromeAny = chrome as any;
      if (chromeAny.ai && typeof chromeAny.ai.generate === 'function') {
        const response = await chromeAny.ai.generate({ model: 'gen-1', prompt, max_output_tokens: 256 });
        comment = extractGeneratedText(response);
      } else {
        throw new Error('No compatible built-in AI API available');
      }
    }

    if (!comment) {
      restoreUI();
      return;
    }

    if (!composer) {
      composer = await waitForCommentComposer(postEl, 5000);
    }

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
    } catch (error) {
      console.warn('Failed to insert comment into composer', error);
    }
  } catch (error) {
    console.warn('AI generation error:', error);
  } finally {
    restoreUI();
  }
}

document.addEventListener('click', (event) => {
  const target = event.target as HTMLElement | null;
  const button = target?.closest ? (target.closest('button') as HTMLButtonElement | null) : null;
  if (!button || !isCommentButton(button)) return;

  const post = findPostContainer(button);
  if (!post) return;

  showTransientNotice('Generating comment...');

  if (!isBuiltinAIAvailable()) {
    showTransientNotice('Chrome built-in AI is unavailable in this context.', 'error');
    showEnableAIModal();
    return;
  }

  generateAndInsertComment(post);
}, true);
