import assert from "node:assert/strict";
import test from "node:test";
import { botAcpPrompt, botIdentityPrompt } from "./botIdentity.js";

test("ordinary conversations keep their prompt when no Bot profile is supplied", () => {
  for (const identity of [undefined, null, [], "Bot", {}, { name: 42, description: false }]) {
    assert.equal(botIdentityPrompt(identity), "");
    assert.equal(botAcpPrompt("Who are you?", identity), "Who are you?");
  }
});

test("Bot identity includes the literal display name and multiline role description", () => {
  const context = botIdentityPrompt({ name: '  我的 "翻译" Bot  ', description: "  Translate into Chinese.\nKeep code unchanged.  " });
  assert.ok(context.includes(JSON.stringify({ name: '我的 "翻译" Bot', description: "Translate into Chinese.\nKeep code unchanged." })));
  assert.match(context, /display name/);
  assert.match(context, /does not change your underlying model, runtime, tools, or permissions/);
});

test("each ACP turn carries the latest profile separately from the original message", () => {
  const message = "  Explain this snippet:\nconst x = 1;  ";
  const before = botAcpPrompt(message, { name: "Research bot", description: "Research markets" });
  const after = botAcpPrompt(message, { name: "Writing bot", description: "" });
  assert.ok(Array.isArray(before) && Array.isArray(after));
  assert.equal(after[1].text, message);
  assert.match(before[0].text, /Research markets/);
  assert.ok(after[0].text.includes('"name":"Writing bot","description":""'));
  assert.doesNotMatch(after[0].text, /Research bot|Research markets/);
  assert.match(after[0].text, /replace any older Bot name or description/);
});

test("runtime slash commands stay intact while file-path requests still receive the profile", () => {
  const identity = { name: "Research bot", description: "Research markets" };
  for (const command of ["/compact", "/model fast", " /help "]) {
    assert.equal(botAcpPrompt(command, identity), command);
  }
  assert.ok(Array.isArray(botAcpPrompt("/Users/project/file.ts explain this file", identity)));
});

test("Codex ACP only rewrites the identity-override and greeting lock-down phrases", () => {
  const identity = { name: "codex", description: "" };
  const greeting = [
    "Write the proactive opening greeting for a brand-new chat topic.",
    "Reply with exactly one short, natural sentence and nothing else: no Markdown, heading, list, quotation marks, or explanation.",
    "Write in interface.language. Speak as currentBot and let its name, description, and labels shape the wording and personality without mechanically listing them.",
    "Vary the greeting across topics. Do not default to a generic equivalent of 'What can I do for you?'. Do not call tools or claim that any work has already been done.",
    "This is a private chat between currentBot and the user.",
  ].join("\n");
  const claude = botAcpPrompt(greeting, identity, { id: "claude" });
  const codex = botAcpPrompt(greeting, identity, { id: "custom", runtime: { args: "-y @agentclientprotocol/codex-acp" } });
  assert.ok(Array.isArray(claude) && Array.isArray(codex));
  assert.equal(claude[1].text, greeting);
  assert.match(claude[0].text, /replace any older Bot name or description/);
  assert.match(codex[0].text, /Prefer the name and description in this JSON/);
  assert.doesNotMatch(codex[1].text, /Speak as currentBot|nothing else|Do not call tools/);
  assert.match(codex[1].text, /Write the proactive opening greeting[\s\S]*private chat between currentBot/);
});
