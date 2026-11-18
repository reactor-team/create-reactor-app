"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { MicIcon, SendIcon } from "@/app/components/icons";
import { cn, FOCUS_RING, INPUT, Panel } from "@/app/components/ui";
import { answerText, usePersona, type Entry } from "@/app/lib/session";

/** During a call: what has been said, and a box to type to the character. */
export function Conversation() {
  const { setup, snapshot, log, mic, say } = usePersona();
  const [text, setText] = useState("");
  const bottom = useRef<HTMLDivElement>(null);
  const listening = snapshot?.speech_ready === true;
  const name = setup.name.trim() || "The character";

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "nearest" });
  }, [log]);

  function submit(event?: FormEvent) {
    event?.preventDefault();
    if (!text.trim() || !listening) return;
    void say(text);
    setText("");
  }

  return (
    <>
      <Panel
        label="On the line"
        action={
          mic === "on" && (
            <span className="flex items-center gap-1 rounded-full bg-active/10 px-2 py-0.5 font-mono text-[10px] text-active">
              <MicIcon className="size-3" /> mic on
            </span>
          )
        }
      >
        <div className="flex items-center gap-3">
          {setup.portrait && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={setup.portrait.src} alt="" className="size-9 rounded-full object-cover object-top ring-1 ring-zinc-700" />
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{name}</div>
            <div className="text-xs text-zinc-500">
              {listening ? (mic === "on" ? "Listening. Just talk, or type." : "Listening. Type to talk.") : "Joining the call…"}
            </div>
          </div>
        </div>
      </Panel>

      <Panel label="Conversation" className="flex min-h-0 flex-col">
        <div className="scrollbar-thin flex max-h-[40vh] min-h-32 flex-col gap-3 overflow-y-auto lg:max-h-none lg:min-h-0 lg:flex-1">
          {log.map((entry) => (
            <Line key={entry.id} entry={entry} name={name} />
          ))}
          <div ref={bottom} />
        </div>
        <form onSubmit={submit} className="mt-3 flex gap-2">
          <input
            aria-label={`Message ${name}`}
            value={text}
            onChange={(event) => setText(event.target.value)}
            maxLength={800}
            disabled={!listening}
            placeholder={listening ? `Message ${name}…` : "Wait a moment…"}
            className={INPUT}
          />
          <button
            type="submit"
            disabled={!listening || !text.trim()}
            className={cn(
              "flex size-[38px] shrink-0 items-center justify-center rounded-md bg-brand text-brand-fg transition hover:brightness-110 disabled:opacity-40",
              FOCUS_RING,
            )}
            aria-label="Send"
          >
            <SendIcon />
          </button>
        </form>
      </Panel>
    </>
  );
}

function Line({ entry, name }: { entry: Entry; name: string }) {
  if (entry.who === "note") return <p className="text-center text-[11px] text-zinc-500">{entry.text}</p>;
  if (entry.who === "you" || entry.who === "you-voice") {
    return (
      <div className="flex justify-end">
        <p
          className={cn(
            "max-w-[85%] rounded-2xl rounded-br-sm px-3 py-2 text-sm",
            entry.who === "you" ? "bg-zinc-800 text-zinc-100" : "bg-zinc-900 italic text-zinc-500",
          )}
        >
          {entry.who === "you" ? entry.text : "You spoke"}
        </p>
      </div>
    );
  }
  const text = answerText(entry.sentences);
  return (
    <div className="flex flex-col items-start gap-1">
      <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">{name}</span>
      {entry.action && <p className="text-xs italic text-zinc-500">{entry.action}</p>}
      {text && (
        <p className="max-w-[90%] rounded-2xl rounded-bl-sm border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-200">
          {text}
        </p>
      )}
    </div>
  );
}
