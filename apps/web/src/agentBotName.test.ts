import assert from "node:assert/strict";
import test from "node:test";
import { botNameAfterAgentSelection, suggestedBotName } from "./agentBotName";

test("selecting an agent fills an empty Bot name", () => {
  assert.equal(botNameAfterAgentSelection("", "Claude"), "Claude");
  assert.equal(botNameAfterAgentSelection("   ", "Codex"), "Codex");
});

test("selecting an agent preserves a custom Bot name", () => {
  assert.equal(botNameAfterAgentSelection("Release reviewer", "Claude"), "Release reviewer");
});

test("a missing agent name leaves the draft unchanged", () => {
  assert.equal(suggestedBotName("", "", "GPU"), "");
  assert.equal(suggestedBotName("Draft", "", "GPU"), "Draft");
});

test("a host label is appended until the user types their own name", () => {
  assert.equal(suggestedBotName("", "Claude", "GPU"), "Claude · GPU");
  assert.equal(suggestedBotName("Claude", "Claude", "GPU"), "Claude · GPU");
  assert.equal(suggestedBotName("Claude · GPU", "Codex", "GPU"), "Codex · GPU");
  assert.equal(suggestedBotName("Claude · GPU", "Claude"), "Claude");
  assert.equal(suggestedBotName("Release reviewer", "Claude", "GPU"), "Release reviewer");
});
