/// <reference types="chrome" />
import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

const Popup = () => {
  const [count, setCount] = useState(0);
  const [currentURL, setCurrentURL] = useState<string>();
  const [tone, setTone] = useState<string>('friendly');
  const [promptText, setPromptText] = useState<string>('Write a short, friendly, professional LinkedIn comment (1-2 sentences) in response to the following post content. Keep it positive and concise.');

  useEffect(() => {
    chrome.action.setBadgeText({ text: count.toString() });
  }, [count]);

  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs: chrome.tabs.Tab[]) {
      setCurrentURL(tabs[0].url);
    });
  }, []);

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

  const changeBackground = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs: chrome.tabs.Tab[]) {
      const tab = tabs[0];
      if (tab.id) {
        chrome.tabs.sendMessage(
          tab.id,
          {
            color: "#555555",
          },
          (msg: any) => {
            console.log("result message:", msg);
          }
        );
      }
    });
  };

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
    <>
      <ul style={{ minWidth: "700px" }}>
        <li>Current URL: {currentURL}</li>
        <li>Current Time: {new Date().toLocaleTimeString()}</li>
      </ul>

      <div style={{ marginTop: 10 }}>
        <label>
          Tone:{' '}
          <select value={tone} onChange={(e) => setTone(e.target.value)}>
            <option value="friendly">Friendly</option>
            <option value="professional">Professional</option>
            <option value="witty">Witty</option>
            <option value="concise">Concise</option>
            <option value="enthusiastic">Enthusiastic</option>
          </select>
        </label>
      </div>

      <div style={{ marginTop: 10 }}>
        <label>
          Custom prompt:
          <br />
          <textarea
            style={{ width: '100%', minHeight: 80 }}
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
          />
        </label>
      </div>

      <div style={{ marginTop: 8 }}>
        <button onClick={saveSettings} style={{ marginRight: 8 }}>
          Save settings
        </button>
        <button onClick={resetDefaults}>Reset defaults</button>
      </div>
      <button
        onClick={() => setCount(count + 1)}
        style={{ marginRight: "5px" }}
      >
        count up
      </button>
      <button onClick={changeBackground}>change background</button>
    </>
  );
};

const root = createRoot(document.getElementById("root")!);

root.render(
  <React.StrictMode>
    <Popup />
  </React.StrictMode>
);
