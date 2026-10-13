export type QueuedClip = {
  clipId: string;
  prompt: string;
  continued: boolean;
};

export type QueueSnapshot = {
  generation: QueuedClip[];
  playout: QueuedClip[];
};

export function QueuePanel({ queue, canContinue }: { queue: QueueSnapshot | null; canContinue: boolean }) {
  if (!queue) return null;
  const clips = [
    ...queue.playout.map(clip => ({ ...clip, ready: true })),
    ...queue.generation.map(clip => ({ ...clip, ready: false })),
  ];
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
      <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-500">Queue <span className="font-mono normal-case">{queue.generation.length} building · {queue.playout.length} ready</span></h2>
      {clips.length === 0 ? (
        <p className="mt-1.5 text-xs text-zinc-600">{canContinue ? "Nothing queued. Add the next beat when you’re ready." : "Nothing queued. Compose a scene to start."}</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {clips.map(clip => (
            <li key={clip.clipId} className="flex items-center gap-2 text-xs">
              <span className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] ${clip.ready ? "bg-active/20 text-active" : "bg-zinc-800 text-zinc-400"}`}>{clip.ready ? "ready" : "building"}</span>
              <span className="min-w-0 flex-1 truncate text-zinc-300" title={clip.prompt}>{clip.prompt || clip.clipId.slice(0, 8)}{clip.continued && <span className="text-zinc-600"> · continued</span>}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
