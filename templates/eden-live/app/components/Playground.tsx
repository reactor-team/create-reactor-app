"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import dynamic from "next/dynamic";
import {
  GAMES,
  useEdenLive,
  useEdenLiveStateUpdate,
  useReactorClient,
  type Game,
  type StateUpdate,
} from "../lib/model";
import { GAME_INFO } from "../lib/games";
import {
  isExpectedCancellation,
  validateImage,
  type GameKey,
} from "../lib/input";
import { useGameInput } from "../lib/useGameInput";
import type { LocalWorldId } from "../lib/world";
import { LOCAL_WORLDS } from "../lib/world-examples";
import { AddGameDialog } from "./AddGameDialog";
import { ControlMap } from "./ControlMap";
import { Picker, type PickerItem } from "./Picker";
import { PromptBar } from "./PromptBar";
import { Stage } from "./Stage";
import type { WorldHandle } from "./ThreeWorld";

const ThreeWorld = dynamic(
  () => import("./ThreeWorld").then((module) => module.ThreeWorld),
  {
    ssr: false,
    loading: () => <p className="world-loading">Loading your world…</p>,
  }
);

type Mode = "game" | "own";
const GAME_ITEMS: PickerItem[] = GAMES.map((game) => ({
  id: game,
  title: GAME_INFO[game].title,
  blurb: GAME_INFO[game].blurb,
  image: `/games/${game}.webp`,
}));
const WORLD_ITEMS: PickerItem[] = LOCAL_WORLDS.map((world) => ({
  id: world.id,
  title: world.title,
  blurb: world.blurb,
  image: world.reference,
}));
const OWN_ACTIONS: Partial<Record<GameKey, string>> = {
  w: "Move",
  a: "Move",
  s: "Move",
  d: "Move",
  arrowup: "Move",
  arrowdown: "Move",
  arrowleft: "Move",
  arrowright: "Move",
  " ": "Jump",
  shift: "Run",
};

export function Playground() {
  const model = useEdenLive();
  const reactor = useReactorClient();
  const [mode, setMode] = useState<Mode>("game");
  const [worldId, setWorldId] = useState<LocalWorldId>("courtyard");
  const [snapshot, setSnapshot] = useState<StateUpdate | null>(null);
  const latest = useRef<StateUpdate | null>(null);
  const [prompt, setPrompt] = useState("");
  const promptDirty = useRef(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const locked = useRef(false);
  const cancelled = useRef(false);
  const world = useRef<WorldHandle | null>(null);
  const [worldStreaming, setWorldStreaming] = useState(false);
  const [worldHeld, setWorldHeld] = useState<string[]>([]);
  const stagedSession = useRef<string | null>(null);
  const [adding, setAdding] = useState(false);
  const closeAdding = useCallback(() => setAdding(false), []);
  const connection = useRef({ status: model.status, id: model.sessionId });
  connection.current = { status: model.status, id: model.sessionId };
  const onError = useCallback((value: unknown) => {
    const message = value instanceof Error ? value.message : String(value);
    if (isExpectedCancellation(message, cancelled.current)) return;
    setError(message);
  }, []);
  const accept = (state: StateUpdate) => {
    if (connection.current.status !== "ready") return;
    latest.current = state;
    setSnapshot(state);
    if (!promptDirty.current) setPrompt(state.prompt);
  };
  useEdenLiveStateUpdate(accept);
  useEffect(() => {
    const handler = (failure: Error) => onError(failure);
    reactor.on("error", handler);
    return () => reactor.off("error", handler);
  }, [reactor, onError]);
  useEffect(() => {
    if (model.status !== "ready") {
      latest.current = null;
      stagedSession.current = null;
      setSnapshot(null);
      setPrompt("");
      promptDirty.current = false;
    }
  }, [model.status]);

  const ready = model.status === "ready";
  const playing = Boolean(
    snapshot?.started && !snapshot.paused && !snapshot.ended
  );
  const input = useGameInput(
    mode === "game" && ready && playing && !busy,
    onError
  );

  // Await a typed command and adopt its `state_update` reply. A refused or
  // failed command resolves `undefined`; the SDK's last error carries the
  // model's code and message (for example `pause_required`).
  async function command(
    name: string,
    call: () => Promise<StateUpdate | undefined>
  ): Promise<StateUpdate> {
    if (connection.current.status !== "ready")
      throw new Error("Connect before sending commands.");
    const session = connection.current.id;
    const reply = await call();
    if (
      connection.current.status !== "ready" ||
      connection.current.id !== session
    )
      throw new Error("Session changed. Connect and try again.");
    if (!reply)
      throw new Error(
        reactor.getLastError()?.message ?? `${name} was not accepted.`
      );
    accept(reply);
    return reply;
  }
  async function run(label: string, action: () => Promise<unknown>) {
    if (locked.current) return;
    locked.current = true;
    setBusy(label);
    setError("");
    try {
      await action();
    } catch (failure) {
      onError(failure);
    } finally {
      locked.current = false;
      setBusy("");
    }
  }
  // `select_game` and `set_image` need a paused world, and both end it. Any
  // command replies with the full state, so an empty `set_keys` reads it.
  async function pauseFirst() {
    const state =
      latest.current ??
      (await command("set_keys", () => model.setKeys({ keys: [] })));
    if (state.paused) return state;
    await input.clear();
    return command("set_paused", () => model.setPaused({ paused: true }));
  }
  async function uploadImage(file: File) {
    validateImage(file, 1, 1);
    const decoded = await createImageBitmap(file);
    try {
      validateImage(file, decoded.width, decoded.height);
    } finally {
      decoded.close();
    }
    const image = await model.uploadFile(file);
    await pauseFirst();
    await command("set_image", () => model.setImage({ image }));
  }
  async function pickGame(game: Game) {
    await pauseFirst();
    promptDirty.current = false;
    const state = await command("select_game", () =>
      model.selectGame({ game })
    );
    if (state.source !== "game")
      await command("set_source", () => model.setSource({ source: "game" }));
  }
  // Your own game: the local scene is the draft, styled by the world's
  // reference image and prompt.
  async function stageWorld(id: LocalWorldId) {
    const example = LOCAL_WORLDS.find((item) => item.id === id)!;
    const response = await fetch(example.reference);
    if (!response.ok)
      throw new Error("The world's reference image could not be loaded.");
    const blob = await response.blob();
    const state = await pauseFirst();
    if (state.source !== "client")
      await command("set_source", () => model.setSource({ source: "client" }));
    const image = await model.uploadFile(
      new File([blob], `${id}.png`, { type: blob.type })
    );
    await command("set_image", () => model.setImage({ image }));
    promptDirty.current = false;
    await command("set_prompt", () =>
      model.setPrompt({ prompt: example.prompt })
    );
  }
  useEffect(() => {
    if (!ready || busy || mode !== "own") return;
    if (stagedSession.current === model.sessionId) return;
    stagedSession.current = model.sessionId ?? null;
    void run("Loading your world", () => stageWorld(worldId));
  });
  function switchMode(next: Mode) {
    if (next === mode || busy) return;
    setMode(next);
    if (!ready) return;
    if (next === "own") {
      stagedSession.current = model.sessionId ?? null;
      void run("Loading your world", () => stageWorld(worldId));
    } else {
      const game = latest.current?.game as Game | undefined;
      void run("Loading game", async () => {
        if (game) await pickGame(game);
        else await pauseFirst();
      });
    }
  }
  async function start() {
    await input.clear();
    if (mode === "own") await world.current?.reset();
    const text = prompt.trim();
    if (text && text !== latest.current?.prompt)
      await command("set_prompt", () => model.setPrompt({ prompt: text }));
    promptDirty.current = false;
    await command("start", () => model.start({}));
  }

  const game = (snapshot?.game || null) as Game | null;
  const sourceMatches =
    snapshot?.source === (mode === "own" ? "client" : "game");
  const canStart =
    ready &&
    !busy &&
    sourceMatches &&
    Boolean(prompt.trim() || snapshot?.prompt) &&
    (mode === "own"
      ? worldStreaming && Boolean(snapshot?.image_name)
      : Boolean(game));
  const localPaused = Boolean(ready && snapshot?.started && snapshot.paused);
  const localWorld = LOCAL_WORLDS.find((item) => item.id === worldId)!;
  const selected =
    mode === "own" ? localWorld : game ? GAME_INFO[game] : undefined;
  const ownLabel =
    snapshot?.image_name &&
    snapshot.image_name !== `${worldId}.png` &&
    !snapshot.image_name.endsWith("/cover.png")
      ? `Using: ${snapshot.image_name}`
      : "";
  const status = snapshot?.ended
    ? "Round over. Start a new world to play again."
    : snapshot?.started
      ? snapshot.paused
        ? "Paused. Resume to keep playing."
        : ""
      : !ready
        ? mode === "own"
          ? "Play your world here now; connect to render it."
          : "Connect, then choose a game."
        : mode === "own"
          ? worldStreaming
            ? "Your game is streaming. Start to render it."
            : "Connecting your game…"
          : game
            ? "Previewing the opening scene. Start to play."
            : "";
  const worldControls = (
    <div className="transport">
      {selected && (
        <div className="now">
          <strong>{selected.title}</strong>
          <p>{selected.blurb}</p>
        </div>
      )}
      {status && <p className="status-line">{status}</p>}
      <div className="row">
        <button
          disabled={
            !ready ||
            !snapshot?.started ||
            snapshot.ended ||
            Boolean(busy)
          }
          onClick={() =>
            void run(
              snapshot?.paused ? "Resuming" : "Pausing",
              async () => {
                await input.clear();
                await command("set_paused", () =>
                  model.setPaused({ paused: !snapshot?.paused })
                );
              }
            )
          }
        >
          {snapshot?.paused && snapshot.started ? "Resume" : "Pause"}
        </button>
        <button
          className="primary"
          disabled={!canStart}
          onClick={() => void run("Starting world", start)}
        >
          {snapshot?.started ? "Start new world" : "Start world"}
        </button>
      </div>
      {mode === "own" && (
        <div className="row">
          <button
            disabled={localPaused}
            onClick={() => void world.current?.reset()}
          >
            Reset player
          </button>
          <button
            title="Download the frame your game sends, to make a reference image from it"
            onClick={() =>
              void world.current
                ?.captureFrame()
                .then((blob) => {
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement("a");
                  link.href = url;
                  link.download = `${worldId}-frame.png`;
                  link.click();
                  setTimeout(() => URL.revokeObjectURL(url), 1000);
                })
                .catch(onError)
            }
          >
            Save frame
          </button>
        </div>
      )}
    </div>
  );
  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <h1>EdenLive</h1>
          <p>Play a game and watch it rendered as a new world in real time.</p>
        </div>
        <span className="brand-mark">
          <Image
            src="/brand/reactor-symbol-white.svg"
            alt="Reactor"
            width={512}
            height={362}
            className="brand-symbol"
          />
          <Image
            src="/brand/reactor-logo-white.png"
            alt="Reactor"
            width={1600}
            height={184}
            className="brand-logo"
          />
        </span>
      </header>
      {error && (
        <div role="alert" className="error">
          <span>{error}</span>
          <button onClick={() => setError("")} aria-label="Dismiss error">
            ×
          </button>
        </div>
      )}
      <main className="workspace">
        <aside aria-label="Session">
          <section className="panel connection">
            <span className={`status ${ready ? "ready" : ""}`}>
              <i />
              {ready
                ? "Connected"
                : model.status === "waiting"
                  ? "Waiting for GPU…"
                  : model.status === "connecting"
                    ? "Connecting…"
                    : "Offline"}
            </span>
            {model.status === "disconnected" ? (
              <button
                className="primary"
                disabled={Boolean(busy)}
                onClick={() => {
                  cancelled.current = false;
                  void run("Connecting", () => model.connect());
                }}
              >
                Connect
              </button>
            ) : (
              <button
                onClick={() => {
                  cancelled.current = true;
                  void input.clear();
                  void model.disconnect().catch(onError);
                }}
              >
                {ready ? "Disconnect" : "Cancel"}
              </button>
            )}
          </section>
          <div className="modes" role="group" aria-label="Mode">
            <button
              aria-pressed={mode === "game"}
              disabled={Boolean(busy)}
              onClick={() => switchMode("game")}
            >
              Built-in games
            </button>
            <button
              aria-pressed={mode === "own"}
              disabled={Boolean(busy)}
              onClick={() => switchMode("own")}
            >
              Your own game
            </button>
          </div>
          {mode === "game" ? (
            <Picker
              heading="Choose a game"
              items={GAME_ITEMS}
              selected={game}
              disabled={!ready || Boolean(busy)}
              hint="The model runs the game; picking one ends the current world."
              onPick={(next) =>
                void run("Loading game", () => pickGame(next as Game))
              }
              onAdd={() => setAdding(true)}
            >
              {worldControls}
            </Picker>
          ) : (
            <Picker
              heading="Choose a world"
              items={WORLD_ITEMS}
              selected={worldId}
              disabled={Boolean(busy)}
              hint="It runs in this page and streams to the model as your game."
              onPick={(next) => {
                setWorldId(next as LocalWorldId);
                if (ready)
                  void run("Loading your world", () =>
                    stageWorld(next as LocalWorldId)
                  );
              }}
              onAdd={() => setAdding(true)}
            >
              {worldControls}
            </Picker>
          )}
          <PromptBar
            value={prompt}
            current={snapshot?.prompt ?? ""}
            disabled={!ready || Boolean(busy)}
            onChange={(value) => {
              promptDirty.current = value.trim() !== snapshot?.prompt;
              setPrompt(value);
            }}
            onApply={() =>
              void run("Applying prompt", async () => {
                await command("set_prompt", () =>
                  model.setPrompt({ prompt: prompt.trim() })
                );
                promptDirty.current = false;
              })
            }
          />
          <section className="panel">
            <h2>Your own look</h2>
            <label
              className={`button upload ${!ready || busy || !snapshot?.image_name ? "disabled" : ""}`}
            >
              Upload a reference image
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                disabled={!ready || Boolean(busy) || !snapshot?.image_name}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) void run("Uploading image", () => uploadImage(file));
                }}
              />
            </label>
            <p className="hint">
              Restyles the world in place of its reference. PNG, JPEG, or WebP,
              up to 25 MiB and 16 MP. Ends the current world.
              {ownLabel && (
                <>
                  <br />
                  {ownLabel}
                </>
              )}
            </p>
          </section>
          <p aria-live="polite" className="operation">
            {busy ? `${busy}…` : ""}
          </p>
        </aside>
        <div className="play">
          <Stage
            ready={ready}
            snapshot={snapshot}
            playable={mode === "game" && ready && playing && !busy}
            mouseLook={input.mouseLook}
            hint={
              mode === "own"
                ? localPaused
                  ? ""
                  : "WASD to move · Space to jump"
                : ready && playing && !busy
                  ? input.mouseLook
                    ? "Mouse look on · Esc releases"
                    : "Click to play · keys and mouse"
                  : ""
            }
            draft={
              mode === "own" ? (
                <ThreeWorld
                  worldId={worldId}
                  apiRef={world}
                  paused={localPaused}
                  onReady={setWorldStreaming}
                  onHeld={setWorldHeld}
                  onError={onError}
                />
              ) : undefined
            }
            surfaceProps={input.surfaceProps}
          />
          {mode === "game" ? (
            <ControlMap
              actions={game ? GAME_INFO[game].actions : {}}
              held={input.held}
              enabled={ready && playing && !busy}
              mouse
              mouseLook={input.mouseLook}
              idle={
                ready && playing
                  ? "Click the world to play"
                  : "Start a world to play"
              }
              hint="Hold a key until the world reacts; a quick tap can fall between frames. Clicking the world locks the mouse for looking; Esc releases it."
              onPress={input.press}
              onRelease={input.release}
            />
          ) : (
            <ControlMap
              actions={OWN_ACTIONS}
              held={worldHeld}
              enabled={!localPaused}
              mouse={false}
              mouseLook={false}
              idle={localPaused ? "Paused" : "Keys play your world"}
              hint="Keys move your game in this page, anywhere outside a text field. Scroll over the inset to zoom."
              onPress={(key) => world.current?.press(key)}
              onRelease={(key) => world.current?.release(key)}
            />
          )}
        </div>
      </main>
      {adding && <AddGameDialog onClose={closeAdding} />}
      <footer>
        <span>EdenLive / Reactor JS SDK</span>
        <span>main_video with the draft as picture-in-picture</span>
      </footer>
    </div>
  );
}
