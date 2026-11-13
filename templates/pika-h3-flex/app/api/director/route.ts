import { NextResponse } from "next/server";
import { DIRECTOR_SYSTEM, cleanedPrompt, directorMessage, parseDirectorRequest } from "../../lib/director";
import { LlmError, complete, directorInfo } from "../../lib/llm";

// Writes the next clip's prompt for the live director. The browser sends the
// scene, the last few clips and its direction; the LLM key stays here.

const TIMEOUT_MS = 30_000;

function failure(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!directorInfo()) return failure("No LLM is configured. Set LLM_PROVIDER and LLM_API_KEY in .env.local, then restart the server.", 503);
  const body = parseDirectorRequest(await request.json().catch(() => null));
  if (!body) return failure("Malformed director request.", 400);
  const { stable, changing } = directorMessage(body);
  try {
    const raw = await complete(DIRECTOR_SYSTEM, stable, changing, AbortSignal.any([request.signal, AbortSignal.timeout(TIMEOUT_MS)]));
    const prompt = cleanedPrompt(raw);
    if (!prompt) return failure("The LLM returned no usable prompt.", 502);
    return NextResponse.json({ prompt }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof LlmError) return failure(error.message, 502);
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) return failure("The LLM took too long to answer.", 504);
    console.error("director", error);
    return failure("The LLM call failed.", 502);
  }
}
