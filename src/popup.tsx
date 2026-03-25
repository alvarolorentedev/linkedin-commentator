/// <reference types="chrome" />
import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";

const DEFAULT_TONE = 'friendly';
const DEFAULT_PROMPT = 'Write a short, friendly, professional LinkedIn comment (1-2 sentences) in response to the following post content. Keep it positive and concise.';

const styles = {
  container: {
    fontFamily: 'Inter, Roboto, system-ui, -apple-system, "Segoe UI", Arial',
    padding: 16,
    width: 360,
    boxSizing: 'border-box' as const,
    color: '#0b2545',
  },
  card: {
    background: '#fff',
    borderRadius: 8,
    boxShadow: '0 6px 18px rgba(11,37,69,0.08)',
    padding: 14,
  },
  notice: {
    marginBottom: 12,
    padding: '10px 12px',
    borderRadius: 8,
    background: '#f3f6fb',
    color: '#16325c',
    fontSize: 13,
    lineHeight: 1.4,
  },
  header: {
    fontSize: 16,
    fontWeight: 600,
    marginBottom: 8,
  },
  label: {
    display: 'block',
    fontSize: 13,
    marginBottom: 6,
    color: '#16325c',
  },
  select: {
    padding: '6px 8px',
    borderRadius: 6,
    border: '1px solid #dfe7f3',
    fontSize: 13,
  },
  textarea: {
    width: '100%',
    minHeight: 96,
    padding: 8,
    borderRadius: 8,
    border: '1px solid #e6eef9',
    fontSize: 13,
    resize: 'vertical' as const,
  },
  controls: {
    marginTop: 12,
    display: 'flex',
    gap: 8,
  },
  btnPrimary: {
    background: '#0a66c2',
    color: '#fff',
    border: 'none',
    padding: '8px 12px',
    borderRadius: 6,
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: 13,
  },
  btnSecondary: {
    background: '#f3f6fb',
    color: '#0b2545',
    border: '1px solid #e6eef9',
    padding: '8px 12px',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 13,
  },
};

const Popup = () => {
  const [tone, setTone] = useState<string>(DEFAULT_TONE);
  const [promptText, setPromptText] = useState<string>(DEFAULT_PROMPT);
  const [aiAvailable, setAIAvailable] = useState<boolean | null>(null);
  const [status, setStatus] = useState('');
  const statusTimerRef = useRef<number | null>(null);

  useEffect(() => {
    chrome.storage.sync.get(
      { commentTone: DEFAULT_TONE, commentPrompt: DEFAULT_PROMPT },
      (items: any) => {
        setTone(items.commentTone || DEFAULT_TONE);
        setPromptText(items.commentPrompt || DEFAULT_PROMPT);
      }
    );
  }, []);

  useEffect(() => {
    try {
      const globalAny = globalThis as any;
      const available = (typeof globalAny.LanguageModel !== 'undefined' && globalAny.LanguageModel) || ((chrome as any)?.ai && typeof (chrome as any).ai.generate === 'function');
      setAIAvailable(Boolean(available));
    } catch {
      setAIAvailable(false);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (statusTimerRef.current) window.clearTimeout(statusTimerRef.current);
    };
  }, []);

  const flashStatus = (message: string) => {
    setStatus(message);
    if (statusTimerRef.current) window.clearTimeout(statusTimerRef.current);
    statusTimerRef.current = window.setTimeout(() => setStatus(''), 1500);
  };

  const saveSettings = () => {
    flashStatus('Settings saved.');
    chrome.storage.sync.set({ commentTone: tone, commentPrompt: promptText }, () => {
    });
  };

  const resetDefaults = () => {
    setTone(DEFAULT_TONE);
    setPromptText(DEFAULT_PROMPT);
    flashStatus('Settings reset to defaults.');
    chrome.storage.sync.set({ commentTone: DEFAULT_TONE, commentPrompt: DEFAULT_PROMPT }, () => {
    });
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>LinkedIn Commentator</div>
        {aiAvailable === false && (
          <div style={styles.notice}>
            Chrome built-in AI is unavailable in this context. You can still edit and save settings here.
          </div>
        )}

        <div>
          <label style={styles.label}>Tone</label>
          <select style={styles.select} value={tone} onChange={(e) => setTone(e.target.value)}>
            <option value="friendly">Friendly</option>
            <option value="professional">Professional</option>
            <option value="witty">Witty</option>
            <option value="concise">Concise</option>
            <option value="enthusiastic">Enthusiastic</option>
          </select>
        </div>

        <div style={{ marginTop: 12 }}>
          <label style={styles.label}>Custom prompt</label>
          <textarea
            style={styles.textarea}
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
          />
        </div>

        <div style={styles.controls}>
          <button style={styles.btnPrimary} onClick={saveSettings}>Save</button>
          <button style={styles.btnSecondary} onClick={resetDefaults}>Reset</button>
        </div>
        {status && (
          <div style={{ marginTop: 10, padding: '8px 10px', background: '#e6fbf1', color: '#0b6b3a', borderRadius: 6, fontSize: 13, fontWeight: 600 }}>
            {status}
          </div>
        )}
      </div>
    </div>
  );
};

const root = createRoot(document.getElementById("root")!);

root.render(
  <React.StrictMode>
    <Popup />
  </React.StrictMode>
);
