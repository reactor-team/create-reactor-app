"use client";
import { useEffect, useRef, useState } from "react";
import { useAbotWorldHalo } from "@reactor-models/abot-world-halo";
import { Button, Panel } from "./ui";
import { appliedOf, settingsOf, useWorld } from "../lib/world";
import { describeRefusal } from "../lib/refusals";

/** The sidebar while a world plays: its state, Pause and Reset, and the live scene. */
export function WorldControls() {
  const api = useAbotWorldHalo();
  const { status, lastError } = api;
  const commands = useRef(api);
  commands.current = api;
  const { snapshot, lastChunk } = useWorld();
  const active =
    status === "ready" && (snapshot?.state === "running" || snapshot?.state === "paused");
  const prompt = snapshot ? settingsOf(snapshot).prompt ?? "" : "";

  const [sceneText, setSceneText] = useState("");
  const [busy, setBusy] = useState(false);
  // A refused scene switch is shown beside the form, not only at the top.
  const [sceneError, setSceneError] = useState<string | null>(null);
  const sceneSent = useRef<number | null>(null);

  // The scene field starts from the scene the world was started with.
  useEffect(() => {
    if (active) setSceneText(prompt);
    else setSceneError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  useEffect(() => {
    if (!lastError || lastError.operation !== "sendCommand" || sceneSent.current === null) return;
    if (Date.now() - sceneSent.current < 5000)
      setSceneError(describeRefusal(lastError.code, lastError.message));
    sceneSent.current = null;
  }, [lastError]);

  if (!active || !snapshot) return null;
  const paused = snapshot.state === "paused";
  // A live scene is refused (`not_ready`) until the first chunk has been made.
  const sceneReady = appliedOf(snapshot).scene_max_tokens != null;

  async function run(work: () => Promise<unknown>) {
    setBusy(true);
    try {
      await work();
    } finally {
      setBusy(false);
    }
  }
  function switchScene() {
    const text = sceneText.trim();
    if (!text) return;
    setSceneError(null);
    sceneSent.current = Date.now();
    void run(() => commands.current.setPrompt({ prompt: text }));
  }

  return (
    <Panel variant="section" className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="eyebrow">Play</p>
          <h2 className="mt-1 text-sm font-medium capitalize" role="status">
            {!lastChunk && !paused ? "Building world…" : snapshot.state}
          </h2>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={() => void run(() => commands.current.setPaused({ paused: !paused }))}
          >
            {paused ? "Resume" : "Pause"}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={() => void run(() => commands.current.reset())}
          >
            Reset
          </Button>
        </div>
      </div>
      <form
        className="space-y-2 border-t border-zinc-800 pt-3"
        onSubmit={(event) => {
          event.preventDefault();
          switchScene();
        }}
      >
        <label className="block text-xs text-zinc-300">
          Scene
          <textarea
            className="mt-2"
            rows={5}
            maxLength={4000}
            value={sceneText}
            onChange={(event) => setSceneText(event.target.value)}
          />
        </label>
        <p className="text-[11px] text-zinc-500">Change the scene to adjust the world.</p>
        <Button
          variant="secondary"
          size="sm"
          className="w-full"
          disabled={busy || !sceneReady || !sceneText.trim() || sceneText.trim() === prompt}
        >
          {sceneReady ? "Switch scene" : "Available after the first chunk"}
        </Button>
      </form>
      {sceneError && (
        <p className="error" role="alert">
          {sceneError}
        </p>
      )}
    </Panel>
  );
}
