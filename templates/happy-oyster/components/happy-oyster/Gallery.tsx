"use client";

// Featured worlds as sidebar quick-prompts (the "Try a prompt" pattern the
// other Reactor templates use), grouped by experience mode. Each tile
// resolves to a WorldIntent: attach when the world has a pinned pre-built id
// (instant), otherwise create from its prompt (~30s build).

import { ExampleTile } from "./ExampleTile";
import {
  FEATURED_WORLDS,
  modeName,
  type FeaturedWorld,
  type WorldIntent,
} from "@/lib/worlds";
import { SectionLabel } from "./ui";

export function Gallery({
  onIntent,
}: {
  onIntent: (intent: WorldIntent) => void;
}) {
  const adventure = FEATURED_WORLDS.filter((world) => world.mode === 1);
  const directing = FEATURED_WORLDS.filter((world) => world.mode === 2);
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <SectionLabel>Example worlds</SectionLabel>
      <ModeGroup label="Adventure" worlds={adventure} onIntent={onIntent} />
      <ModeGroup label="Directing" worlds={directing} onIntent={onIntent} />
    </div>
  );
}

function ModeGroup({
  label,
  worlds,
  onIntent,
}: {
  label: string;
  worlds: FeaturedWorld[];
  onIntent: (intent: WorldIntent) => void;
}) {
  if (worlds.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-mono text-[10px] uppercase tracking-tight text-white/35">
        {label}
      </span>
      <div className="grid grid-cols-2 gap-1.5">
        {worlds.map((world) => (
          <WorldTile key={world.key} world={world} onIntent={onIntent} />
        ))}
      </div>
    </div>
  );
}

function WorldTile({
  world,
  onIntent,
}: {
  world: FeaturedWorld;
  onIntent: (intent: WorldIntent) => void;
}) {
  return (
    <ExampleTile
      title={world.title}
      description={world.prompt}
      image={world.image}
      gradient={world.gradient}
      onClick={() =>
        onIntent(
          world.encryptedWorldId
            ? {
                kind: "attach",
                mode: modeName(world.mode),
                encryptedWorldId: world.encryptedWorldId,
                title: world.title,
              }
            : {
                kind: "create",
                mode: modeName(world.mode),
                params: { prompt: world.prompt },
                title: world.title,
              }
        )
      }
    >
      {world.encryptedWorldId && (
        <span className="relative font-mono text-[9px] uppercase tracking-tight text-white/60">
          instant
        </span>
      )}
    </ExampleTile>
  );
}
