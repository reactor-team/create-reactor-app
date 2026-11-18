"use client";

import type { ReactNode } from "react";

/**
 * A box of the given aspect ratio, as large as fits in the space it is given,
 * centred. Everything the stage shows (video and overlays) goes inside.
 * On a phone the frame takes a fixed share of the viewport; on a desktop it
 * fills whatever the page frame leaves it.
 */
export function StageFrame({
  aspect,
  children,
}: {
  aspect: "16:9" | "9:16";
  children: ReactNode;
}) {
  const ratio = aspect === "16:9" ? 16 / 9 : 9 / 16;
  return (
    <div
      className="relative min-h-0 max-lg:h-(--stage-h) lg:flex-1"
      style={{
        containerType: "size",
        // On a phone: as wide as the viewport allows, never taller than
        // 46vh, so a 16:9 world takes a short strip and a 9:16 character
        // a tall one. Ignored on lg, where the flex frame decides.
        ["--stage-h" as string]: `min(46vh, calc((100vw - 2rem) / ${ratio}))`,
      }}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className="relative overflow-hidden rounded-lg border border-zinc-800 bg-black"
          style={{
            width: `min(100cqw, calc(100cqh * ${ratio}))`,
            aspectRatio: aspect.replace(":", " / "),
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
