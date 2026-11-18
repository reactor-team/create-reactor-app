"use client";

import type { ReactNode } from "react";

/**
 * A box of the given aspect ratio, as large as fits in the space it is given.
 * Everything the stage shows (video and overlays) goes inside. On a desktop,
 * `below` sits under the box at the same width, and the two are centred
 * together. On a phone the frame takes a fixed share of the viewport and
 * `below` is not shown here.
 */
export function StageFrame({
  aspect,
  below,
  children,
}: {
  aspect: "16:9" | "9:16";
  below?: ReactNode;
  children: ReactNode;
}) {
  const ratio = aspect === "16:9" ? 16 / 9 : 9 / 16;
  const width = `min(100cqw, calc((100cqh - var(--below)) * ${ratio}))`;
  return (
    <div
      // --below is the height `below` takes on a desktop: the 96px shot reel
      // and the 12px gap above it.
      className={`relative min-h-0 [--below:0px] max-lg:h-(--stage-h) lg:flex-1 ${below ? "lg:[--below:108px]" : ""}`}
      style={{
        containerType: "size",
        // On a phone: as wide as the viewport allows, never taller than
        // 46vh, so 16:9 takes a short strip and 9:16 a tall one. Ignored on
        // lg, where the flex frame decides.
        ["--stage-h" as string]: `min(46vh, calc((100vw - 2rem) / ${ratio}))`,
      }}
    >
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
        <div
          className="relative shrink-0 overflow-hidden rounded-lg border border-zinc-800 bg-black"
          style={{ width, aspectRatio: aspect.replace(":", " / ") }}
        >
          {children}
        </div>
        {below && (
          <div className="hidden shrink-0 lg:block" style={{ width }}>
            {below}
          </div>
        )}
      </div>
    </div>
  );
}
