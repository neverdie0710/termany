import { textInputProps } from "../textInputProps";
import { defaultAgentRuntime } from "@termany/core";
import { useEffect, useRef, useState } from "react";
import { apiPath } from "../api";
import {
  agentCommand,
  createCustomAgent,
  detectAgentConfigs,
  loadAgentConfigs,
  saveAgentConfigs,
  syncAgentConfigs,
  type AgentConfig,
  type AgentRuntimeConfig,
} from "../agents";
import { runtimeForProtocol } from "../remoteAgent";
import { agentInstallCommand, enableAgentAfterInstallLaunch } from "../agentInstall";
import termanyIcon from "../assets/agents/termany.png?url";
import { useI18n } from "../i18n";
import { fetchConfiguredDefaultModelLabel } from "../modelConfig";
import { AgentAvatarEditor } from "./AgentIdentityFields";
import { AgentLogo } from "./AgentLogo";
import { AgentIcon, ChevronIcon, CloseIcon, PlusIcon, RefreshIcon } from "./icons";

function AgentAvatar({ agent }: { agent: AgentConfig }) {
  return (
    <span
      className={`agent-settings-icon ${agent.icon ? "" : "fallback"}`}
      data-agent-id={agent.id}
      aria-hidden="true"
    >
      {agent.icon ? <AgentLogo src={agent.icon} /> : <AgentIcon />}
    </span>
  );
}

export function AgentSettings({
  initialAgentId,
  onInstallAgent,
  onConfigureModels,
}: {
  initialAgentId?: string;
  onInstallAgent?: (agentName: string, command: string) => boolean;
  onConfigureModels?: () => void;
}) {
  const { t } = useI18n();
  const [agents, setAgents] = useState(loadAgentConfigs);
  const [expanded, setExpanded] = useState<string | null>(initialAgentId ?? null);
  const initialAgentRef = useRef<HTMLDivElement>(null);
  const [detecting, setDetecting] = useState(false);
  const [detectionComplete, setDetectionComplete] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [termanyModel, setTermanyModel] = useState<string | null>(null);
  const [sshConnections, setSshConnections] = useState<Array<{ target: string; label?: string; hostname?: string }>>([]);

  const commit = (next: AgentConfig[]) => {
    setAgents(next);
    saveAgentConfigs(next);
  };

  const updateAgent = (id: string, patch: Partial<AgentConfig>) => {
    commit(agents.map((agent) => (agent.id === id ? { ...agent, ...patch } : agent)));
  };

  const updateRuntime = (agent: AgentConfig, patch: Record<string, unknown>) => {
    if (!agent.runtime) return;
    updateAgent(agent.id, { runtime: { ...agent.runtime, ...patch } as AgentRuntimeConfig });
  };

  const changeRuntimeProtocol = (agent: AgentConfig, protocol: AgentRuntimeConfig["protocol"]) => {
    updateAgent(agent.id, { runtime: runtimeForProtocol(agent, protocol) });
  };

  const toggleRuntime = (agent: AgentConfig, enabled: boolean) => {
    updateAgent(agent.id, {
      runtime: enabled
        ? agent.runtime ?? (agent.builtIn ? defaultAgentRuntime(agent.id) : undefined) ?? {
            protocol: "acp",
            command: agent.command,
            args: "acp",
            distribution: "system",
            modelSource: "agent",
          }
        : undefined,
    });
  };

  const detect = async (source = agents) => {
    setDetecting(true);
    setStatus(null);
    try {
      const next = await detectAgentConfigs(source);
      setAgents(next);
      saveAgentConfigs(next);
    } catch (e) {
      setStatus(`${t("agents.detectFailed")}: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setDetecting(false);
      setDetectionComplete(true);
    }
  };

  useEffect(() => {
    void syncAgentConfigs()
      .then((next) => detect(next))
      .catch(() => detect(loadAgentConfigs()));
    // Detect once when the settings section opens; manual refresh stays explicit after that.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let live = true;
    void fetchConfiguredDefaultModelLabel()
      .then((model) => {
        if (live) setTermanyModel(model);
      })
      .catch(() => {
        if (live) setTermanyModel("");
      });
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    if (!initialAgentId) return;
    initialAgentRef.current?.scrollIntoView({ block: "nearest" });
  }, [initialAgentId]);

  useEffect(() => {
    const abort = new AbortController();
    fetch(apiPath("/api/ssh/connections"), { signal: abort.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const payload = await res.json();
        setSshConnections(Array.isArray(payload.connections) ? payload.connections : []);
      })
      .catch((reason) => {
        if (reason?.name !== "AbortError") setSshConnections([]);
      });
    return () => abort.abort();
  }, []);

  const addCustom = () => {
    const agent = createCustomAgent();
    const next = [agent, ...agents];
    commit(next);
    setExpanded(agent.id);
  };

  const removeCustom = (id: string) => {
    const next = agents.filter((agent) => agent.id !== id);
    commit(next);
    if (expanded === id) setExpanded(next[0]?.id ?? null);
  };

  const installAgent = (agent: AgentConfig, command: string) => {
    if (!onInstallAgent?.(agent.name, command)) {
      setStatus(t("agents.installTerminalFailed"));
      return;
    }
    commit(enableAgentAfterInstallLaunch(agents, agent.id));
  };

  return (
    <div className="agent-settings">
      <div className="agent-settings-head">
        <div className="settings-section-title">{t("agents.title")}</div>
        <div className="agent-settings-head-actions">
          <button className="agent-refresh-btn" onClick={addCustom}>
            <PlusIcon />
            {t("agents.add")}
          </button>
          <button className="agent-refresh-btn" onClick={() => detect()} disabled={detecting}>
            <RefreshIcon />
            {detecting ? "..." : t("agents.refresh")}
          </button>
        </div>
      </div>
      {status && <div className="agent-settings-status">{status}</div>}

      <div className="agent-settings-list">
        <div className="agent-settings-row agent-settings-termany-row">
          <div className="agent-settings-main">
            <span className="agent-settings-icon" data-agent-id="termany" aria-hidden="true">
              <AgentLogo src={termanyIcon} />
            </span>
            <div className="agent-settings-meta">
              <div className="agent-settings-name">Termany</div>
              <div
                className="agent-settings-command agent-settings-termany-description"
                title={termanyModel || undefined}
              >
                <span className="agent-settings-built-in">{t("models.builtIn")}</span>
                <span className="agent-settings-model-name">
                  {termanyModel === null ? "…" : termanyModel || t("agentChat.modelNone")}
                </span>
              </div>
            </div>
            <div className="agent-settings-actions">
              <button
                type="button"
                className="agent-model-action"
                title={t("models.configure")}
                onClick={onConfigureModels}
                disabled={!onConfigureModels}
              >
                {t("models.configure")}
              </button>
            </div>
          </div>
        </div>
        {agents.map((agent) => {
          const isExpanded = expanded === agent.id;
          const installCommand = agent.builtIn ? agentInstallCommand(agent.id) : undefined;
          const needsInstall = Boolean(installCommand) && agent.terminalDetected === false;
          const checkingInstall = agent.builtIn
            && agent.terminalDetected === undefined
            && !detectionComplete;
          const sshRuntime = agent.runtime?.protocol === "acp-ssh" ? agent.runtime : undefined;
          return (
            <div
              key={agent.id}
              ref={agent.id === initialAgentId ? initialAgentRef : undefined}
              className="agent-settings-row"
            >
              <div className="agent-settings-main">
                <AgentAvatar agent={agent} />
                <div className="agent-settings-meta">
                  <div className="agent-settings-name">{agent.name}</div>
                  <div className="agent-settings-command" title={agent.terminalDetectedPath ?? agentCommand(agent)}>
                    {agentCommand(agent) || t("agents.commandMissing")}
                  </div>
                </div>

                <div className="agent-settings-actions">
                  {needsInstall ? (
                    <button
                      className="agent-install-btn"
                      title={installCommand}
                      onClick={() => {
                        if (installCommand) installAgent(agent, installCommand);
                      }}
                    >
                      {t("agents.install")}
                    </button>
                  ) : checkingInstall ? (
                    <button className="agent-install-btn is-pending" disabled>
                      {t("agents.detecting")}
                    </button>
                  ) : (
                    <div className="agent-enable-toggle" aria-label={`${agent.name} enabled state`}>
                      <button
                        className={agent.enabled ? "active" : ""}
                        onClick={() => updateAgent(agent.id, { enabled: true })}
                      >
                        {t("agents.enabled")}
                      </button>
                      <button
                        className={!agent.enabled ? "active" : ""}
                        onClick={() => updateAgent(agent.id, { enabled: false })}
                      >
                        {t("agents.disabled")}
                      </button>
                    </div>
                  )}
                  <button
                    className="agent-expand-btn"
                    title={isExpanded ? "Collapse" : "Expand"}
                    onClick={() => setExpanded(isExpanded ? null : agent.id)}
                  >
                    <ChevronIcon dir={isExpanded ? "up" : "down"} />
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className="agent-settings-edit">
                  <label className="agent-field">
                    <span>{t("agents.name")}</span>
                    <input
                      {...textInputProps}
                      value={agent.name}
                      onChange={(e) => updateAgent(agent.id, { name: e.target.value })}
                    />
                  </label>
                  {!agent.builtIn && (
                    <div className="agent-field agent-custom-icon-field">
                      <span>{t("agentGroup.avatar")}</span>
                      <AgentAvatarEditor
                        avatar={agent.icon}
                        fallback={<AgentIcon />}
                        onAvatarChange={(icon) => updateAgent(agent.id, { icon: icon || undefined })}
                      />
                    </div>
                  )}
                  <section className={`agent-config-card agent-terminal-card${agent.enabled ? " is-enabled" : ""}`}>
                    <div className="agent-config-card-head">
                      <div>
                        <div className="agent-config-card-title">{t("agents.terminal")}</div>
                        <div className="agent-config-card-description">{t("agents.terminalHelp")}</div>
                      </div>
                    </div>
                    <div className="agent-config-card-body">
                      <label className="agent-field">
                        <span>{t("agents.command")}</span>
                        <input
                          {...textInputProps}
                          value={agent.command}
                          onChange={(e) => updateAgent(agent.id, { command: e.target.value })}
                        />
                      </label>
                      <label className="agent-field">
                        <span>{t("agents.args")}</span>
                        <input
                          {...textInputProps}
                          value={agent.args}
                          onChange={(e) => updateAgent(agent.id, { args: e.target.value })}
                        />
                      </label>
                    </div>
                  </section>
                  <section className={`agent-config-card agent-runtime-card${agent.runtime ? " is-enabled" : ""}`}>
                    <div className="agent-config-card-head">
                      <div>
                        <div className="agent-config-card-title">{t("agents.runtime")}</div>
                        <div className="agent-config-card-description">{t("agents.runtimeHelp")}</div>
                      </div>
                      <input
                        className="agent-config-checkbox"
                        type="checkbox"
                        aria-label={t("agents.runtime")}
                        checked={Boolean(agent.runtime)}
                        onChange={(event) => toggleRuntime(agent, event.target.checked)}
                      />
                    </div>
                    {agent.runtime && (
                      <div className="agent-runtime-fields">
                        <label className="agent-field">
                          <span>{t("agents.runtimeProtocol")}</span>
                          <select
                            value={agent.runtime.protocol}
                            disabled={agent.builtIn}
                            onChange={(event) => changeRuntimeProtocol(agent, event.target.value as AgentRuntimeConfig["protocol"])}
                          >
                            <option value="acp">{t("agents.runtimeAcp")}</option>
                            {(agent.runtime.protocol === "acp-http" || agent.id === "fastclaw") && (
                              <option value="acp-http">{t("agents.runtimeAcpHttp")}</option>
                            )}
                            {(!agent.builtIn || agent.runtime.protocol === "acp-ssh") && (
                              <option value="acp-ssh">{t("agents.runtimeAcpSsh")}</option>
                            )}
                          </select>
                        </label>
                        {agent.runtime.protocol === "acp-http" ? (
                          <>
                            <label className="agent-field">
                              <span>ACP endpoint</span>
                              <input
                                {...textInputProps}
                                value={agent.runtime.endpoint}
                                placeholder="http://127.0.0.1:18953/acp"
                                onChange={(event) => updateRuntime(agent, { endpoint: event.target.value })}
                              />
                            </label>
                            <label className="agent-field">
                              <span>{t("models.form.apiKey")}</span>
                              <input
                                {...textInputProps}
                                type="password"
                                value={agent.runtime.apiKey}
                                placeholder="FASTCLAW_API_KEY"
                                autoComplete="off"
                                onChange={(event) => updateRuntime(agent, { apiKey: event.target.value })}
                              />
                            </label>
                          </>
                        ) : sshRuntime ? (
                          <>
                            <label className="agent-field">
                              <span>{t("agents.runtimeSshTarget")}</span>
                              <select
                                value={sshConnections.some((connection) => connection.target === sshRuntime.sshTarget)
                                  ? sshRuntime.sshTarget
                                  : sshRuntime.sshTarget ? "__custom__" : ""}
                                onChange={(event) => {
                                  if (event.target.value === "__custom__") return;
                                  updateRuntime(agent, { sshTarget: event.target.value });
                                }}
                              >
                                <option value="">{t("agentWorkspace.selectHost")}</option>
                                {sshConnections.map((connection) => (
                                  <option key={connection.target} value={connection.target}>
                                    {connection.label ?? connection.hostname ?? connection.target}
                                  </option>
                                ))}
                                {sshRuntime.sshTarget
                                  && !sshConnections.some((connection) => connection.target === sshRuntime.sshTarget)
                                  && (
                                    <option value="__custom__">{sshRuntime.sshTarget}</option>
                                  )}
                              </select>
                            </label>
                            {(!sshConnections.length || (sshRuntime.sshTarget && !sshConnections.some((connection) => connection.target === sshRuntime.sshTarget))) && (
                              <label className="agent-field">
                                <span>{t("agents.runtimeSshTarget")}</span>
                                <input
                                  {...textInputProps}
                                  value={sshRuntime.sshTarget}
                                  placeholder="profile:xxx or user@host:port"
                                  onChange={(event) => updateRuntime(agent, { sshTarget: event.target.value })}
                                />
                              </label>
                            )}
                            <label className="agent-field">
                              <span>{t("agents.runtimeCommand")}</span>
                              <input
                                {...textInputProps}
                                value={sshRuntime.command}
                                onChange={(event) => updateRuntime(agent, { command: event.target.value })}
                              />
                            </label>
                            <label className="agent-field">
                              <span>{t("agents.runtimeArgs")}</span>
                              <input
                                {...textInputProps}
                                value={sshRuntime.args}
                                onChange={(event) => updateRuntime(agent, { args: event.target.value })}
                              />
                            </label>
                            <label className="agent-field">
                              <span>{t("agents.runtimeModels")}</span>
                              <select
                                value={sshRuntime.modelSource}
                                onChange={(event) => updateRuntime(agent, { modelSource: event.target.value })}
                              >
                                <option value="agent">{t("agents.runtimeModelsAgent")}</option>
                                <option value="termany" disabled>{t("agents.runtimeModelsTermany")}</option>
                              </select>
                            </label>
                          </>
                        ) : (
                          <>
                            <label className="agent-field">
                              <span>{t("agents.runtimeCommand")}</span>
                              <input
                                {...textInputProps}
                                value={agent.runtime.command}
                                disabled={agent.runtime.protocol === "acp" && agent.runtime.distribution === "managed"}
                                onChange={(event) => updateRuntime(agent, { command: event.target.value })}
                              />
                            </label>
                            <label className="agent-field">
                              <span>{t("agents.runtimeArgs")}</span>
                              <input
                                {...textInputProps}
                                value={agent.runtime.args}
                                disabled={agent.runtime.protocol === "acp" && agent.runtime.distribution === "managed"}
                                onChange={(event) => updateRuntime(agent, { args: event.target.value })}
                              />
                            </label>
                            {agent.runtime.protocol === "acp" && (
                              <label className="agent-field">
                                <span>{t("agents.runtimeDistribution")}</span>
                                <select
                                  value={agent.runtime.distribution}
                                  onChange={(event) => updateRuntime(agent, { distribution: event.target.value })}
                                >
                                  <option value="system">{t("agents.runtimeSystem")}</option>
                                  <option value="managed" disabled={agent.id !== "claude" && agent.id !== "codex"}>
                                    {t("agents.runtimeManaged")}
                                  </option>
                                  <option value="custom">{t("agents.runtimeCustom")}</option>
                                </select>
                              </label>
                            )}
                            <label className="agent-field">
                              <span>{t("agents.runtimeModels")}</span>
                              <select
                                value={agent.runtime.modelSource}
                                onChange={(event) => updateRuntime(agent, { modelSource: event.target.value })}
                              >
                                <option value="agent">{t("agents.runtimeModelsAgent")}</option>
                                <option value="termany" disabled>{t("agents.runtimeModelsTermany")}</option>
                              </select>
                            </label>
                          </>
                        )}
                      </div>
                    )}
                  </section>
                  {!agent.builtIn && (
                    <div className="agent-settings-edit-foot">
                      <button className="agent-remove-btn" onClick={() => removeCustom(agent.id)}>
                        <CloseIcon />
                        {t("agents.remove")}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
