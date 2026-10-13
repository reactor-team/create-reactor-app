export type AudioRole = "voice" | "ambience" | "soundtrack";
export type PictureKind = "person" | "object" | "scene";
export type NamedPicture = { name: string; kind: PictureKind; description: string };

export type GuidedScene = {
  action: string;
  camera: string;
  sound: string;
  music: string;
  pictures: NamedPicture[];
  audios: { role: AudioRole; speaker: string }[];
};

function escapePattern(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function pictureTokens(pictures: NamedPicture[]): string[] {
  let subjects = 0;
  let objects = 0;
  return pictures.map((picture, index) => {
    if (picture.kind === "person") return `<Subject ${++subjects}>`;
    if (picture.kind === "object") return `<Object ${++objects}>`;
    return `<Picture ${index + 1}>`;
  });
}

function useNames(text: string, pictures: NamedPicture[], tokens: string[]): string {
  const names = pictures.map(picture => picture.name.trim()).filter(Boolean).sort((a, b) => b.length - a.length);
  if (!names.length) return text;
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}_])(${names.map(escapePattern).join("|")})(?![\\p{L}\\p{N}_])`, "giu");
  return text.replace(pattern, name => tokens[pictures.findIndex(picture => picture.name.trim().toLowerCase() === name.toLowerCase())] ?? name);
}

/** Keep the numbered references in the same order as the uploaded files. */
export function assembleGuidedPrompt(scene: GuidedScene): string {
  const tokens = pictureTokens(scene.pictures);
  const lines: string[] = [];
  scene.pictures.forEach((picture, index) => {
    const name = picture.name.trim();
    const description = picture.description.trim();
    if (picture.kind === "scene") {
      lines.push(`<Picture ${index + 1}> is the scene reference${description ? `: ${description}` : ""}.`);
    } else {
      const details = [name, description].filter(Boolean).join(", ") || `the ${picture.kind} shown`;
      lines.push(`${tokens[index]} is ${details} in <Picture ${index + 1}>.`);
    }
  });
  scene.audios.forEach((audio, index) => {
    const name = `<Audio ${index + 1}>`;
    if (audio.role === "voice") {
      const speaker = audio.speaker.trim();
      const pictureIndex = scene.pictures.findIndex(picture => picture.kind === "person" && picture.name.trim().toLowerCase() === speaker.toLowerCase());
      lines.push(`${name} is the voice of ${pictureIndex >= 0 ? tokens[pictureIndex] : speaker || "the pictured speaker"}.`);
    } else if (audio.role === "soundtrack") {
      lines.push(`${name} is the target video's complete audio track, reused unchanged.`);
    } else {
      lines.push(`${name} supplies ambient sound for this scene.`);
    }
  });
  if (scene.action.trim()) lines.push(useNames(scene.action.trim(), scene.pictures, tokens));
  if (scene.camera.trim()) lines.push(`Camera: ${scene.camera.trim()}`);
  if (!scene.audios.some(audio => audio.role === "soundtrack")) {
    if (scene.sound.trim()) lines.push(`Sound: ${scene.sound.trim()}`);
    if (scene.music.trim()) lines.push(`Music: ${scene.music.trim()}`);
  }
  return lines.filter(Boolean).join("\n");
}
