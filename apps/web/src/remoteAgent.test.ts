import assert from "node:assert/strict";
import test from "node:test";
import {
  agentSupportsRemote,
  buildRemoteAgent,
  findMatchingRemoteAgent,
  remoteRuntimeForAgent,
  runtimeForProtocol,
} from "./remoteAgent";

const claude = {
  id: "claude",
  name: "Claude",
  command: "claude",
  args: "--dangerously-skip-permissions",
  enabled: true,
  builtIn: true,
  runtime: { protocol: "acp" as const, command: "claude-agent-acp", args: "", distribution: "managed" as const, modelSource: "agent" as const },
};

const gemini = {
  id: "gemini",
  name: "Gemini",
  command: "gemini",
  args: "--yolo",
  enabled: true,
  builtIn: true,
  runtime: { protocol: "acp" as const, command: "gemini", args: "--acp", distribution: "system" as const, modelSource: "agent" as const },
};

const fastclaw = {
  id: "fastclaw",
  name: "FastClaw",
  command: "fastclaw",
  args: "",
  enabled: true,
  builtIn: true,
  runtime: { protocol: "acp-http" as const, endpoint: "http://127.0.0.1:18953/acp", apiKey: "" },
};

test("remote hosts can run stdio ACP agents but not HTTP gateways", () => {
  assert.equal(agentSupportsRemote(claude), true);
  assert.equal(agentSupportsRemote(gemini), true);
  assert.equal(agentSupportsRemote(fastclaw), false);
  assert.equal(agentSupportsRemote({ runtime: undefined }), false);
});

test("managed Claude/Codex launch the ACP adapter on the remote host", () => {
  assert.deepEqual(remoteRuntimeForAgent(claude, "profile:abc"), {
    protocol: "acp-ssh",
    sshTarget: "profile:abc",
    command: "npx",
    args: "-y @agentclientprotocol/claude-agent-acp",
    modelSource: "agent",
  });
});

test("system ACP agents reuse their local runtime command over SSH", () => {
  assert.deepEqual(remoteRuntimeForAgent(gemini, "user@gpu:22"), {
    protocol: "acp-ssh",
    sshTarget: "user@gpu:22",
    command: "gemini",
    args: "--acp",
    modelSource: "agent",
  });
});

test("HTTP runtimes and empty targets cannot be wrapped in SSH", () => {
  assert.equal(remoteRuntimeForAgent(fastclaw, "profile:abc"), undefined);
  assert.equal(remoteRuntimeForAgent(claude, "  "), undefined);
});

test("matching reuses an existing SSH agent instead of cloning", () => {
  const runtime = remoteRuntimeForAgent(claude, "profile:abc")!;
  const created = buildRemoteAgent(claude, runtime, "GPU");
  assert.equal(created.builtIn, false);
  assert.equal(created.enabled, true);
  assert.equal(created.name, "Claude · GPU");
  assert.equal(created.runtime?.protocol, "acp-ssh");
  assert.equal(findMatchingRemoteAgent([claude, created], runtime)?.id, created.id);
  assert.equal(findMatchingRemoteAgent([claude], runtime), undefined);
});

test("switching protocol rebuilds the runtime instead of mixing fields", () => {
  const ssh = runtimeForProtocol(claude, "acp-ssh");
  assert.equal(ssh.protocol, "acp-ssh");
  if (ssh.protocol === "acp-ssh") {
    assert.equal(ssh.sshTarget, "");
    assert.equal(ssh.command, "claude-agent-acp");
  }
  const back = runtimeForProtocol({ ...claude, runtime: ssh }, "acp");
  assert.equal(back.protocol, "acp");
  if (back.protocol === "acp") {
    assert.equal(back.distribution, "custom");
    assert.equal(back.command, "claude-agent-acp");
  }
});
