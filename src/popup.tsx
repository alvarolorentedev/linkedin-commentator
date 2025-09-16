/// <reference types="chrome" />
import React, { useEffect, useState, useRef } from "react";
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
  const [aiAvailable, setAIAvailable] = useState<boolean | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [status, setStatus] = useState<string>("");
  const statusTimerRef = useRef<number | null>(null);

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

  // Check built-in AI availability for this browser and show instructions if missing
  useEffect(() => {
    try {
      const gg = (globalThis as any);
      const available = (typeof gg.LanguageModel !== 'undefined' && gg.LanguageModel) || ((chrome as any)?.ai && typeof (chrome as any).ai.generate === 'function');
      setAIAvailable(Boolean(available));
    } catch (e) {
      setAIAvailable(false);
    }
  }, []);

  const saveSettings = () => {
    // optimistic feedback: show immediately so user sees a response even if storage is slow
    setStatus('Settings saved.');
    if (statusTimerRef.current) window.clearTimeout(statusTimerRef.current);
    statusTimerRef.current = window.setTimeout(() => setStatus(''), 1500);
    chrome.storage.sync.set({ commentTone: tone, commentPrompt: promptText }, () => {
      console.log('Saved tone and prompt');
    });
  };

  const resetDefaults = () => {
    const defaultTone = 'friendly';
    const defaultPrompt = 'Write a short, friendly, professional LinkedIn comment (1-2 sentences) in response to the following post content. Keep it positive and concise.';
    setTone(defaultTone);
    setPromptText(defaultPrompt);
    // optimistic feedback for reset as well
    setStatus('Settings reset to defaults.');
    if (statusTimerRef.current) window.clearTimeout(statusTimerRef.current);
    statusTimerRef.current = window.setTimeout(() => setStatus(''), 1500);
    chrome.storage.sync.set({ commentTone: defaultTone, commentPrompt: defaultPrompt }, () => {
      console.log('Reset tone and prompt to defaults');
    });
  };

  useEffect(() => {
    return () => {
      if (statusTimerRef.current) window.clearTimeout(statusTimerRef.current);
    };
  }, []);
  // If AI is unavailable and the user hasn't dismissed the notice, render only the instructions.
  if (aiAvailable === false && !dismissed) {
    return (
      <div style={{ ...styles.container, width: 420 }}>
        <div style={styles.card}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>Enable Chrome built-in AI features</div>
          <div style={{ fontSize: 13, marginBottom: 12 }}>This extension requires Chrome's built-in Translation API and Gemini Nano AI (Chrome v138+). Please enable the platform flags and components listed below, then restart Chrome.</div>

          <ol style={{ fontSize: 13, lineHeight: 1.4, paddingLeft: 18 }}>
            <li>Download and install a Chrome build that includes built-in AI (v138+).</li>
            <li>Open <code>chrome://flags/#enable-experimental-web-platform-features</code> and enable "Experimental Web Platform features".</li>
            <li>Open <code>chrome://flags/#translation-api</code> and enable the Translation API flag.</li>
            <li>Open <code>chrome://flags/#language-detection-api</code> and enable the Language Detection API flag.</li>
            <li>Open <code>chrome://flags/#prompt-api-for-gemini-nano</code> and enable the Prompt API for Gemini Nano.</li>
            <li>Open <code>chrome://flags/#optimization-guide-on-device-model</code> and enable the Optimization Guide on Device Model flag.</li>
            <li>Visit <code>chrome://components</code>, locate "Optimization Guide On Device Model" (or similar) and update it if an update is available.</li>
            <li>Restart Chrome to apply all changes.</li>
          </ol>
        </div>
      </div>
    );
  }

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
