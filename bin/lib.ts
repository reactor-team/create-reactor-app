import chalk from "chalk";

// Aliases for cases where a model's public name differs from its template
// folder in the repo. Leave empty when names map 1:1 to folders.
export const MODEL_MAP: Record<string, string> = {};

export function resolveTemplateFolder(name: string): string {
  return MODEL_MAP[name] ?? name;
}

export function formatAvailableModels(repoTemplates: string[]): string {
  const lines: string[] = [];

  // Section 1: explicit name → folder aliases, with the resolved folder
  // shown in a lighter, italic style.
  const mappings = Object.entries(MODEL_MAP).sort(([a], [b]) =>
    a.localeCompare(b)
  );
  for (const [name, folder] of mappings) {
    if (repoTemplates.includes(folder)) {
      lines.push(`  ${name}${chalk.dim.italic(` → ${folder}`)}`);
    }
  }

  // Section 2: remaining folders that aren't already covered by an alias.
  const mappedTargets = new Set(Object.values(MODEL_MAP));
  const remaining = repoTemplates
    .filter((folder) => !mappedTargets.has(folder))
    .sort();
  for (const folder of remaining) {
    lines.push(`  ${folder}`);
  }

  if (lines.length === 0) {
    lines.push("  (none)");
  }

  return lines.join("\n");
}

export function parseArgs(args: string[]): {
  projectName?: string;
  model?: string;
  token?: string;
  help: boolean;
} {
  const result: {
    projectName?: string;
    model?: string;
    token?: string;
    help: boolean;
  } = { help: false };
  const positionalArgs: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--help" || arg === "-h") {
      result.help = true;
    } else if (arg === "--token" || arg === "-t") {
      result.token = args[++i];
    } else if (arg.startsWith("--token=")) {
      result.token = arg.split("=")[1];
    } else if (arg === "--model" || arg === "-m") {
      result.model = args[++i];
    } else if (arg.startsWith("--model=")) {
      result.model = arg.slice("--model=".length);
    } else if (!arg.startsWith("-")) {
      positionalArgs.push(arg);
    }
  }

  result.projectName = positionalArgs[0];

  return result;
}
