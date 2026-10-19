import type { GameKey } from "./input";
import type { Game } from "./model";

export type GameInfo = {
  title: string;
  blurb: string;
  // What each key does in this game. Keys not listed do nothing there.
  actions: Partial<Record<GameKey, string>>;
};

const WALK = { w: "Move", a: "Move", s: "Move", d: "Move" } as const;
const LOOK = {
  arrowup: "Look",
  arrowdown: "Look",
  arrowleft: "Look",
  arrowright: "Look",
} as const;

export const GAME_INFO: Record<Game, GameInfo> = {
  freeze: {
    title: "Cryo Crossing",
    blurb: "Freeze a path of stones across a volcanic cavern.",
    actions: { ...WALK, ...LOOK, f: "Freeze", " ": "Jump" },
  },
  spiders: {
    title: "Spider Hollow",
    blurb: "Clear a torch-lit cave of spiders with an axe.",
    actions: { ...WALK, ...LOOK, f: "Swing", " ": "Jump" },
  },
  tracer: {
    title: "Pulse Skirmish",
    blurb: "Dual-pistol fight against robots in a sunlit street.",
    actions: {
      ...WALK,
      ...LOOK,
      f: "Fire",
      " ": "Jump",
      shift: "Blink",
      e: "Recall",
      r: "Reload",
    },
  },
  bioshock: {
    title: "Deepwater Shock",
    blurb: "A wrench and electric bolts in a flooded machine room.",
    actions: { ...WALK, ...LOOK, f: "Wrench", e: "Bolt", " ": "Jump" },
  },
  godzilla: {
    title: "Kaiju Rampage",
    blurb: "A giant monster against the towers of a miniature city.",
    actions: { ...WALK, ...LOOK, f: "Breath", " ": "Stomp" },
  },
  arcadeduel: {
    title: "Arcade Duel",
    blurb: "Two fighters, one arena, one round.",
    actions: {
      a: "Move",
      d: "Move",
      f: "Combo",
      g: "Guard",
      e: "Uppercut",
      r: "Wave",
      shift: "Dash",
      " ": "Jump",
    },
  },
  dust2: {
    title: "Desert Crossfire",
    blurb: "Rifle combat through a desert courtyard.",
    actions: {
      ...WALK,
      ...LOOK,
      f: "Fire",
      e: "Flashbang",
      r: "Reload",
      " ": "Jump",
    },
  },
};
