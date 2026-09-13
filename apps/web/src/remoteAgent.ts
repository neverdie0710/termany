import type { AgentRuntimeConfig } from "@termany/core";

type RemoteAgentSource = {
  id: string;
  name: string;
  command: string;
  args: string;
  icon?: string;
  runtime?: AgentRuntimeConfig;
};

const MANAGED_REMOTE_PACKAGES: Record<string, string> = {
  claude: "@agentclientprotocol/claude-agent-acp",
  codex: "@agentclientprotocol/codex-acp",
};

/** Termany Chat and HTTP ACP gateways have no CLI to run on a remote host. */
export function agentSupportsRemote(agent: Pick<RemoteAgentSource, "runtime"> | undefined): boolean {
  const protocol = agent?.runtime?.protocol;
  return protocol === "acp" || protocol === "acp-ssh";
}

export function remoteRuntimeForAgent(agent: RemoteAgentSource, sshTarget: string): Extract<AgentRuntimeConfig, { protocol: "acp-ssh" }> | undefined {
  const target = sshTarget.trim();
  const runtime = agent.runtime;
  if (!target || !runtime) return undefined;
  if (runtime.protocol === "acp-ssh") {
    return { ...runtime, sshTarget: target };
  }
  if (runtime.protocol !== "acp") return undefined;

  const managedPackage = runtime.distribution === "managed" ? MANAGED_REMOTE_PACKAGES[agent.id] : undefined;
  if (managedPackage) {
    return {
      protocol: "acp-ssh",
      sshTarget: target,
      command: "npx",
      args: `-y ${managedPackage}`,
      modelSource: "agent",
    };
  }

  return {
    protocol: "acp-ssh",
    sshTarget: target,
    command: runtime.command,
    args: runtime.args,
    modelSource: runtime.modelSource,
  };
}

export function findMatchingRemoteAgent<T extends RemoteAgentSource>(
  agents: T[],
  runtime: Extract<AgentRuntimeConfig, { protocol: "acp-ssh" }>
): T | undefined {
  return agents.find((agent) => {
    const current = agent.runtime;
    return current?.protocol === "acp-ssh"
      && current.sshTarget === runtime.sshTarget
      && current.command === runtime.command
      && current.args === runtime.args;
  });
}

export function buildRemoteAgent(
  source: RemoteAgentSource,
  runtime: Extract<AgentRuntimeConfig, { protocol: "acp-ssh" }>,
  hostLabel: string
): RemoteAgentSource & { enabled: boolean; builtIn: boolean } {
  const label = hostLabel.trim();
  return {
    id: crypto.randomUUID(),
    name: label ? `${source.name} · ${label}` : source.name,
    command: source.command,
    args: source.args,
    enabled: true,
    builtIn: false,
    icon: source.icon,
    runtime,
  };
}

export function runtimeForProtocol(agent: RemoteAgentSource, protocol: AgentRuntimeConfig["protocol"]): AgentRuntimeConfig {
  const current = agent.runtime;
  if (protocol === "acp-ssh") {
    const command = current && "command" in current ? current.command : agent.command;
    const args = current && "args" in current ? current.args : "";
    return {
      protocol: "acp-ssh",
      sshTarget: current && current.protocol === "acp-ssh" ? current.sshTarget : "",
      command: command || agent.command,
      args,
      modelSource: current && "modelSource" in current ? current.modelSource : "agent",
    };
  }
  if (protocol === "acp-http") {
    return current?.protocol === "acp-http"
      ? current
      : { protocol: "acp-http", endpoint: "http://127.0.0.1:18953/acp", apiKey: "" };
  }
  const command = current && "command" in current ? current.command : agent.command;
  const args = current && "args" in current ? current.args : "acp";
  return {
    protocol: "acp",
    command: command || agent.command,
    args,
    distribution: current && current.protocol === "acp" ? current.distribution : "custom",
    modelSource: current && "modelSource" in current ? current.modelSource : "agent",
  };
}
