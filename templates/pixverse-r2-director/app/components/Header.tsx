import { cn, EYEBROW } from "./ui";

// The header: the model's name, what it does, and the Reactor wordmark.
export function Header() {
  return (
    <header className="flex items-center justify-between gap-4 border-b border-zinc-800 bg-zinc-900/40 px-4 py-3 lg:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <h1 className="shrink-0 text-sm font-semibold tracking-tight text-zinc-100">
          PixVerse R2 Director
        </h1>
        <span
          className={cn(
            EYEBROW,
            "hidden truncate border-l border-zinc-800 pl-3 md:inline"
          )}
        >
          Direct a short film
        </span>
      </div>
      <a
        href="https://reactor.inc"
        target="_blank"
        rel="noreferrer"
        aria-label="Powered by Reactor"
        className="flex shrink-0 items-center gap-2 text-zinc-400"
      >
        {/* Down 1px so the label's baseline meets the wordmark's. */}
        <span className="hidden translate-y-px font-mono text-[9px] tracking-[0.12em] sm:inline sm:text-[10px]">
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
