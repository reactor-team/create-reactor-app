import { cn, EYEBROW } from "./ui";

export function Header() {
  return (
    <header className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/40 px-4 py-3 lg:px-6">
      <div className="flex items-baseline gap-3">
        <h1 className="text-sm font-semibold tracking-tight text-zinc-100">
          XMAX X2.1
        </h1>
        <span
          className={cn(
            EYEBROW,
            "hidden border-l border-zinc-800 pl-3 sm:inline"
          )}
        >
          Real-time video-to-video
        </span>
      </div>
      <a
        href="https://reactor.inc"
        target="_blank"
        rel="noreferrer"
        aria-label="Powered by Reactor"
        className="flex shrink-0 items-center gap-2 text-zinc-400"
      >
        <span className="font-mono text-[9px] tracking-[0.12em] sm:text-[10px]">
          POWERED BY
        </span>
        {/* Use the official wordmark as a mask so it inherits the label color. */}
        <span
          aria-hidden="true"
          className="block h-[10px] w-16 bg-current"
          style={{
            mask: "url('/brand/reactor-wordmark-white.svg') center / contain no-repeat",
            WebkitMask:
              "url('/brand/reactor-wordmark-white.svg') center / contain no-repeat",
          }}
        />
      </a>
    </header>
  );
}
