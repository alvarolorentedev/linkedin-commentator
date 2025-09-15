/// <reference types="chrome" />
import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

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
  const [tone, setTone] = useState<string>('friendly');
  const [promptText, setPromptText] = useState<string>('Write a short, friendly, professional LinkedIn comment (1-2 sentences) in response to the following post content. Keep it positive and concise.');

  // Load saved prompt and tone on popup open
  useEffect(() => {
    chrome.storage.sync.get(
      { commentTone: 'friendly', commentPrompt: promptText },
      (items: any) => {
        if (items.commentTone) setTone(items.commentTone);
        if (items.commentPrompt) setPromptText(items.commentPrompt);
      }
    );
  }, []);

  const saveSettings = () => {
    chrome.storage.sync.set({ commentTone: tone, commentPrompt: promptText }, () => {
      console.log('Saved tone and prompt');
    });
  };

  const resetDefaults = () => {
    const defaultTone = 'friendly';
    const defaultPrompt = 'Write a short, friendly, professional LinkedIn comment (1-2 sentences) in response to the following post content. Keep it positive and concise.';
    setTone(defaultTone);
    setPromptText(defaultPrompt);
    chrome.storage.sync.set({ commentTone: defaultTone, commentPrompt: defaultPrompt }, () => {
      console.log('Reset tone and prompt to defaults');
    });
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>LinkedIn Commentator</div>

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
