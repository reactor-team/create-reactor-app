import { readFile } from "node:fs/promises";
import path from "node:path";

// Serves skill/own-game.md as written, so the "Add your own game" dialog
// copies the same text the repository ships.
export const dynamic = "force-static";

export async function GET() {
  const text = await readFile(
    path.join(process.cwd(), "skill", "own-game.md"),
    "utf8"
  );
  return new Response(text, {
    headers: { "Content-Type": "text/markdown; charset=utf-8" },
  });
}
