"use client";
import { useState, type ReactNode } from "react";

export function ExampleTile({
  title,
  description,
  image,
  gradient,
  imagePosition,
  selected,
  disabled,
  onClick,
  children,
}: {
  title: string;
  description?: string;
  image?: string;
  gradient?: string;
  imagePosition?: string;
  selected?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children?: ReactNode;
}) {
  const [imageBroken, setImageBroken] = useState(false);
  return (
    <button
      onClick={onClick}
      title={description}
      aria-pressed={selected}
      disabled={disabled}
      draggable={false}
      className={`group relative flex aspect-video w-full select-none flex-col justify-end overflow-hidden rounded-md border p-2 text-left transition hover:border-white/30 disabled:pointer-events-none disabled:opacity-40 ${selected ? "border-primary/70" : "border-white/[0.08]"}`}
    >
      <div
        aria-hidden
        className="absolute inset-0 transition group-hover:scale-105"
        style={{ background: gradient }}
      />
      {image && !imageBroken && (
        <img
          src={image}
          alt=""
          aria-hidden
          loading="lazy"
          draggable={false}
          onError={() => setImageBroken(true)}
          style={{ objectPosition: imagePosition }}
          className="absolute inset-0 h-full w-full select-none object-cover transition group-hover:scale-105"
        />
      )}
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent"
      />
      <span className="relative text-[11px] font-medium leading-tight text-white">
        {title}
      </span>
      {children}
    </button>
  );
}
