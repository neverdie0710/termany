import assert from "node:assert/strict";
import test from "node:test";
import { remoteAcpLaunch } from "./acpRuntime.js";
import type { AgentConfig } from "./agentConfig.js";

test("remote custom ACP agents launch over non-interactive SSH with quoted arguments", () => {
  const agent: AgentConfig = {
    id: "custom",
    name: "Remote custom",
    command: "unused",
    args: "",
    enabled: true,
    builtIn: false,
    runtime: {
      protocol: "acp",
      command: "/opt/my agent/bin/acp",
      args: "serve --label 'research bot'",
      distribution: "custom",
      modelSource: "agent",
    },
  };

  const launch = remoteAcpLaunch(agent, "/srv/team's repo", { type: "ssh", target: "dev@example.com:2222" });
  assert.equal(launch.command, "ssh");
  assert.deepEqual(launch.args.slice(0, 4), ["-p", "2222", "-T", "-o"]);
  assert.equal(launch.args[4], "BatchMode=yes");
  assert.equal(launch.args[5], "dev@example.com");
  assert.match(launch.args[6], /^sh -lc '/);
  assert.match(launch.args[6], /research bot/);
  assert.match(launch.args[6], /team/);
});

test("managed Codex uses its ACP bridge on the remote host", () => {
  const agent: AgentConfig = {
    id: "codex",
    name: "Codex",
    command: "codex",
    args: "",
    enabled: true,
    builtIn: true,
    runtime: {
      protocol: "acp",
      command: "codex-acp",
      args: "",
      distribution: "managed",
      modelSource: "agent",
    },
  };
  const launch = remoteAcpLaunch(agent, ".", { type: "ssh", target: "example.com" });
  assert.match(launch.args.at(-1) ?? "", /@agentclientprotocol\/codex-acp/);
});
