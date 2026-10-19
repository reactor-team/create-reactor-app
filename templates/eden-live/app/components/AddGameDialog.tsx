"use client";
import { useEffect, useState } from "react";

// Hands the own-game skill to the user's coding agent. The text comes from
// skill/own-game.md through /api/own-game-skill.
export function AddGameDialog({ onClose }: { onClose: () => void }) {
  const [skill, setSkill] = useState("");
  const [copied, setCopied] = useState<"" | "done" | "manual">("");
  useEffect(() => {
    let live = true;
    fetch("/api/own-game-skill")
      .then((response) => (response.ok ? response.text() : ""))
      .then((text) => live && setSkill(text))
      .catch(() => undefined);
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", close);
    return () => {
      live = false;
      window.removeEventListener("keydown", close);
    };
  }, [onClose]);
  async function copy() {
    try {
      await navigator.clipboard.writeText(skill);
      setCopied("done");
    } catch {
      setCopied("manual");
    }
  }
  return (
    <div className="backdrop" onClick={onClose}>
      <div
        className="dialog panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-game-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="panel-head">
          <h2 id="add-game-title">Add your own game</h2>
          <button className="close" aria-label="Close" onClick={onClose}>
            ×
          </button>
        </div>
        <p>
          Build your own game with your coding agent, such as Cursor, Codex, or
          Claude Code, and add it to this app. EdenLive renders it like the
          built-in games.
        </p>
        <ol>
          <li>Copy the skill.</li>
          <li>Paste it into your coding agent in this project.</li>
          <li>
            Describe the game you want. The agent builds it and adds it as your
            own game.
          </li>
        </ol>
        {copied === "manual" && (
          <textarea
            readOnly
            rows={8}
            value={skill}
            aria-label="Own-game skill"
            onFocus={(e) => e.currentTarget.select()}
          />
        )}
        <div className="row">
          <button
            className="primary"
            disabled={!skill}
            onClick={() => void copy()}
          >
            {copied === "done" ? "Copied" : "Copy skill"}
          </button>
          <span className="hint">
            {copied === "manual"
              ? "The clipboard is unavailable here. Select the text above and copy it."
              : "skill/own-game.md"}
          </span>
        </div>
      </div>
    </div>
  );
}
