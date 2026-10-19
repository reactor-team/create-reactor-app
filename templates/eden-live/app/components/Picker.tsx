"use client";
import type { ReactNode } from "react";
import Image from "next/image";

export type PickerItem = {
  id: string;
  title: string;
  blurb: string;
  image: string;
};

// A compact grid of thumbnails; the selected one is highlighted.
export function Picker({
  heading,
  items,
  selected,
  disabled,
  hint,
  onPick,
  onAdd,
  children,
}: {
  heading: string;
  items: readonly PickerItem[];
  selected: string | null;
  disabled: boolean;
  hint: string;
  onPick: (id: string) => void;
  onAdd?: () => void;
  children?: ReactNode;
}) {
  return (
    <section className="panel">
      <h2>{heading}</h2>
      <div className="thumbs">
        {items.map((item) => (
          <button
            key={item.id}
            className="thumb"
            aria-pressed={item.id === selected}
            aria-label={item.title}
            title={item.blurb}
            disabled={disabled}
            onClick={() => onPick(item.id)}
          >
            <Image
              src={item.image}
              alt=""
              width={320}
              height={176}
              sizes="96px"
            />
            <span>{item.title}</span>
          </button>
        ))}
        {onAdd && (
          <button className="thumb add" onClick={onAdd}>
            <i aria-hidden="true">+</i>
            <span>Add your own</span>
          </button>
        )}
      </div>
      <p className="hint">{hint}</p>
      {children}
    </section>
  );
}
