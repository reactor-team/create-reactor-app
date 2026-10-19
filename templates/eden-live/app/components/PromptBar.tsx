"use client";

// The scene prompt, edited in the sidebar. Picking a game fills it with that
// game's prompt; Enter applies an edit with `set_prompt`.
export function PromptBar({
  value,
  current,
  disabled,
  onChange,
  onApply,
}: {
  value: string;
  current: string;
  disabled: boolean;
  onChange: (value: string) => void;
  onApply: () => void;
}) {
  const edited = value.trim() !== current;
  return (
    <section className="panel prompt-bar">
      <div className="panel-head">
        <label htmlFor="prompt">Scene prompt</label>
        <span className={`hint ${edited ? "edited" : ""}`}>
          {!current
            ? "Pick a game to load its prompt"
            : edited
              ? "Enter applies · Esc reverts"
              : "In effect"}
        </span>
      </div>
      <textarea
        id="prompt"
        rows={5}
        maxLength={4096}
        value={value}
        disabled={disabled}
        placeholder="Describe the look of the world…"
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (edited && value.trim()) onApply();
          } else if (e.key === "Escape") {
            onChange(current);
          }
        }}
      />
      <p className="hint">
        An edit applies from the next chunk while the world keeps playing, so
        the look shifts over a few seconds rather than cutting.
      </p>
    </section>
  );
}
