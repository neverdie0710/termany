/** An agent name is a starting point, not a replacement for a name the user
 * has already chosen. Treat whitespace-only drafts as empty. A suggested
 * "Agent · Host" label is also replaced when the agent or host changes. */
const GENERATED_SEP = " · ";

export function botNameAfterAgentSelection(currentName: string, agentName: string): string {
  return suggestedBotName(currentName, agentName);
}

export function suggestedBotName(currentName: string, agentName: string, hostLabel?: string): string {
  const trimmed = currentName.trim();
  if (!agentName.trim()) return trimmed;
  const generated = hostLabel ? `${agentName}${GENERATED_SEP}${hostLabel}` : agentName;
  if (!trimmed) return generated;
  if (trimmed === agentName) return generated;
  const at = trimmed.indexOf(GENERATED_SEP);
  if (at > 0) {
    const suffix = trimmed.slice(at + GENERATED_SEP.length);
    if (!hostLabel || suffix === hostLabel || trimmed.startsWith(`${agentName}${GENERATED_SEP}`)) {
      return generated;
    }
  }
  return currentName;
}
