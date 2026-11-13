// Basic mode's prompt assembly: the user's description plus named reference
// pictures and audio, turned into the definition lines Pika's prompt guide
// recommends. No LLM: plain text interpolation, inspectable in the composer.
//
//   <Subject 1> is Aki, the character from <Picture 1>, retaining appearance and clothing.
//   <Audio 1> is the voice of <Subject 1>.
//   <Subject 1> serves a bowl of ramen …   ← the description, names replaced
//
// Every picture's content becomes a <Subject N> (Pika: "the specific person,
// object, action, style or other content referenced from any asset"), so
// later sentences can refer back to it. <Picture N> and <Audio N> name files.

export type PictureKind = "person" | "object" | "setting" | "style";
export type NamedPicture = { name: string; kind: PictureKind; description: string };

export type AudioRole = "voice" | "sound" | "music" | "soundtrack";
export type NamedAudio = { role: AudioRole; speaker: string };

export type BasicScene = {
  text: string;
  pictures: NamedPicture[];
  audios: NamedAudio[];
};

const RETAIN: Record<PictureKind, string> = {
  person: "the character from {picture}, retaining appearance and clothing",
  object: "the object from {picture}, retaining its shape, colour and materials",
  setting: "the setting from {picture}, retaining its layout and visual style",
  style: "the visual style from {picture}, used only for the look: light, colour and texture",
};

function escapePattern(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** The <Subject N> label each picture's content gets, in upload order. */
export function pictureTokens(pictures: NamedPicture[]): string[] {
  return pictures.map((_, index) => `<Subject ${index + 1}>`);
}

/** Replaces whole-word mentions of each picture's name with its label. */
function useNames(text: string, pictures: NamedPicture[], tokens: string[]): string {
  const named = pictures.map((picture, index) => ({ name: picture.name.trim(), token: tokens[index] })).filter(item => item.name);
  if (!named.length) return text;
  named.sort((a, b) => b.name.length - a.name.length);
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}_])(${named.map(item => escapePattern(item.name)).join("|")})(?![\\p{L}\\p{N}_])`, "giu");
  return text.replace(pattern, match => named.find(item => item.name.toLowerCase() === match.toLowerCase())?.token ?? match);
}

/** Definition lines for the references, in upload order. */
export function definitionLines(pictures: NamedPicture[], audios: NamedAudio[]): string[] {
  const tokens = pictureTokens(pictures);
  const lines: string[] = [];
  pictures.forEach((picture, index) => {
    const name = picture.name.trim();
    const description = picture.description.trim();
    const label = `<Picture ${index + 1}>`;
    const role = RETAIN[picture.kind].replace("{picture}", label);
    const who = [name, description].filter(Boolean).join(", ");
    lines.push(`${tokens[index]} is ${who ? `${who}, ` : ""}${role}.`);
  });
  audios.forEach((audio, index) => {
    const label = `<Audio ${index + 1}>`;
    if (audio.role === "voice") {
      const speaker = audio.speaker.trim();
      const pictureIndex = pictures.findIndex(picture => picture.kind === "person" && picture.name.trim().toLowerCase() === speaker.toLowerCase());
      lines.push(`${label} is the voice of ${pictureIndex >= 0 ? tokens[pictureIndex] : speaker || "the speaker"}.`);
    } else if (audio.role === "soundtrack") {
      lines.push(`${label} is the clip's complete soundtrack; use the whole recording.`);
    } else if (audio.role === "music") {
      lines.push(`${label} is the music for this clip.`);
    } else {
      lines.push(`${label} is a sound effect for this scene.`);
    }
  });
  return lines;
}

/** Basic mode: definition lines, then the description with names replaced by labels. */
export function assembleBasicPrompt(scene: BasicScene): string {
  const tokens = pictureTokens(scene.pictures);
  const text = useNames(scene.text.trim(), scene.pictures, tokens);
  return [...definitionLines(scene.pictures, scene.audios), text].filter(Boolean).join("\n");
}

// First and last frames (Pika's FL2VA). The API never inserts these lines, so
// the prompt must open with the one Pika's guide gives for the frames sent,
// then a blank line. The first frame is <Picture 1>; the last frame is
// <Picture 2>, or <Picture 1> when it is the only one. A frame continuation
// opens like a first frame: the previous clip's last frame is <Picture 1>.

export type FrameSet = "first" | "last" | "both";

export const FIRST_FRAME_LINE = "For the target video, at 0.00 seconds into the target video, <Picture 1> (from [Shot 1]) is fully referenced.";

/** The alignment line for the frames sent; `seconds` is the clip length. */
export function frameAlignmentLine(frames: FrameSet, seconds: number): string {
  const end = seconds.toFixed(2);
  if (frames === "first") return FIRST_FRAME_LINE;
  if (frames === "last") return `How the reference pictures align with the target video — <Picture 1> (from [Shot 1]) aligns with the ${end}-second mark of the target video.`;
  return `How the reference pictures align with the target video — <Picture 1> (from [Shot 1]) aligns with the 0.00-second mark of the target video; <Picture 2> (from [Shot 1]) aligns with the ${end}-second mark of the target video.`;
}

export function frameSet(first: boolean, last: boolean): FrameSet | null {
  return first && last ? "both" : first ? "first" : last ? "last" : null;
}

/** An independent frame clip: the alignment line, a blank line, the description. */
export function assembleFramePrompt(text: string, frames: FrameSet, seconds: number): string {
  return [frameAlignmentLine(frames, seconds), "", text.trim()].join("\n");
}

const SUBJECT_DEFINITION = /^<Subject (\d+)> is (.+)$/;
const OTHER_DEFINITION = /^<(?:Audio|Picture|Video) \d+> is /;
const ALIGNMENT = /^(?:For the target video, at |How the reference pictures align)/;

/**
 * "Marcy, curly red hair, the character from <Picture 1>, …" -> "Marcy";
 * "the setting from <Picture 2>, …" -> "the setting".
 */
function subjectName(definition: string): string {
  const role = definition.match(/(?:^|,? )the (character|object|setting|visual style) from </);
  const before = role ? definition.slice(0, role.index) : definition;
  const name = before.split(",")[0].trim();
  if (name && !name.startsWith("<")) return name;
  return role ? `the ${role[1]}` : "the subject";
}

/**
 * A scene prompt without its references, for a frame continuation, which
 * sends none: definition and alignment lines go, and each <Subject N> becomes
 * the name its definition gave it.
 */
export function withoutReferences(prompt: string): string {
  const names = new Map<string, string>();
  const kept: string[] = [];
  for (const line of prompt.split("\n")) {
    const subject = line.trim().match(SUBJECT_DEFINITION);
    if (subject) {
      names.set(subject[1], subjectName(subject[2]));
      continue;
    }
    if (OTHER_DEFINITION.test(line.trim()) || ALIGNMENT.test(line.trim())) continue;
    kept.push(line);
  }
  return kept.join("\n")
    .replace(/<Subject (\d+)>/g, (_, index: string) => names.get(index) ?? "the subject")
    .replace(/<(?:Picture|Audio|Video) \d+>/g, "the reference")
    .trim();
}

/** A frame continuation's prompt: the opening line, then the scene without references and the next beat. */
export function frameContinuationPrompt(scene: string, action: string): string {
  return [FIRST_FRAME_LINE, "", withoutReferences(scene), `Next beat: ${action.trim()}`].join("\n");
}

/**
 * A frame continuation from a description someone else wrote (the live
 * director): any alignment, definition or label line it slipped in goes, and
 * the first-frame line opens it like every frame continuation.
 */
export function frameContinuationFromWritten(text: string): string {
  return [FIRST_FRAME_LINE, "", withoutReferences(text)].join("\n");
}
