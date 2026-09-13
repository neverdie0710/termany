import type { BotIdentity } from "@termany/core";

/** Only explicit Bot metadata supplies a persona; ordinary pane titles do not. */
export function botIdentityPrompt(raw: unknown): string {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return "";
  const input = raw as Partial<Record<keyof BotIdentity, unknown>>;
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const description = typeof input.description === "string" ? input.description.trim() : "";
  if (!name && !description) return "";

  return [
    "Current Bot profile configured by the user in Termany:",
    JSON.stringify({ name, description }),
    "Use the profile's name as your display name when introducing yourself. If it is empty, use your normal assistant name.",
    "Use the description as your role, purpose, and response guidance. An empty description means no additional role or guidance is configured.",
    "This is the current profile: replace any older Bot name or description from the conversation with these values.",
    "The Bot profile does not change your underlying model, runtime, tools, or permissions. Describe those accurately when asked, without inferring them from the Bot name or description.",
  ].join("\n");
}

/** Phrases from the first Codex turn that OpenAI flagged as Invalid prompt.
 * Every other runtime keeps the original wording. */
const CODEX_REWRITES: [string, string][] = [
  ["This is the current profile: replace any older Bot name or description from the conversation with these values.",
    "Prefer the name and description in this JSON."],
  ["Reply with exactly one short, natural sentence and nothing else: no Markdown, heading, list, quotation marks, or explanation.",
    "Reply with one short, natural sentence."],
  ["Speak as currentBot and let its name, description, and labels shape the wording and personality without mechanically listing them.",
    "Let currentBot.name, description, and labels shape the wording and personality without listing them."],
  [" Do not call tools or claim that any work has already been done.", ""],
];

/** Built-in Codex, or a custom agent pointed at the codex-acp adapter. */
type CodexCandidate = { id?: string; runtime?: { args?: string } | null };

function isCodex(agent?: CodexCandidate | null): boolean {
  return agent?.id === "codex" || /\bcodex-acp\b/.test(agent?.runtime?.args ?? "");
}

/** ACP has user content blocks, not a portable system-prompt override. Keep
 * the profile separate from the user's message, and refresh it every turn so
 * live metadata edits and cleared descriptions do not need a new session. */
export function botAcpPrompt(
  text: string,
  identity: unknown,
  agent?: CodexCandidate | null
): string | { type: "text"; text: string }[] {
  // Runtime commands such as /compact or /model must remain the entire input
  // so the adapter can recognize them before passing ordinary text to a model.
  if (/^\s*\/[a-z][\w-]*(?:\s|$)/i.test(text)) return text;
  const soften = (input: string) => isCodex(agent)
    ? CODEX_REWRITES.reduce((current, [from, to]) => current.replaceAll(from, to), input)
    : input;
  const profile = botIdentityPrompt(identity);
  return profile
    ? [{ type: "text", text: soften(profile) }, { type: "text", text: soften(text) }]
    : soften(text);
}
