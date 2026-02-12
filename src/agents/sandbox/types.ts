import type { SandboxBackend } from "./backend.js";
import type { SandboxBwrapConfig } from "./types.bwrap.js";
import type { SandboxDockerConfig } from "./types.docker.js";

export type { SandboxDockerConfig } from "./types.docker.js";
export type { SandboxBwrapConfig } from "./types.bwrap.js";
export type { SandboxBackend } from "./backend.js";

export type SandboxToolPolicy = {
  allow?: string[];
  deny?: string[];
};

export type SandboxToolPolicySource = {
  source: "agent" | "global" | "default";
  /**
   * Config key path hint for humans.
   * (Arrays use `agents.list[].…` form.)
   */
  key: string;
};

export type SandboxToolPolicyResolved = {
  allow: string[];
  deny: string[];
  sources: {
    allow: SandboxToolPolicySource;
    deny: SandboxToolPolicySource;
  };
};

export type SandboxWorkspaceAccess = "none" | "ro" | "rw";

export type SandboxBrowserConfig = {
  enabled: boolean;
  image: string;
  containerPrefix: string;
  cdpPort: number;
  vncPort: number;
  noVncPort: number;
  headless: boolean;
  enableNoVnc: boolean;
  allowHostControl: boolean;
  autoStart: boolean;
  autoStartTimeoutMs: number;
};

export type SandboxPruneConfig = {
  idleHours: number;
  maxAgeDays: number;
};

export type SandboxScope = "session" | "agent" | "shared";

export type SandboxConfig = {
  mode: "off" | "non-main" | "all";
  /** Sandbox backend: "docker", "bwrap", or "auto" (default: "auto"). */
  backend?: SandboxBackend;
  scope: SandboxScope;
  workspaceAccess: SandboxWorkspaceAccess;
  workspaceRoot: string;
  docker: SandboxDockerConfig;
  /** Bubblewrap configuration (used when backend is "bwrap"). */
  bwrap?: Partial<SandboxBwrapConfig>;
  browser: SandboxBrowserConfig;
  tools: SandboxToolPolicy;
  prune: SandboxPruneConfig;
  /** Tenant ID for multi-tenant isolation. */
  tenantId?: string;
};

export type SandboxBrowserContext = {
  bridgeUrl: string;
  noVncUrl?: string;
  containerName: string;
};

export type SandboxContext = {
  enabled: boolean;
  /** Sandbox backend type. */
  backend: "docker" | "bwrap";
  sessionKey: string;
  workspaceDir: string;
  agentWorkspaceDir: string;
  workspaceAccess: SandboxWorkspaceAccess;
  /** Container name (Docker) or scope identifier (bwrap). */
  containerName: string;
  containerWorkdir: string;
  docker: SandboxDockerConfig;
  /** Bubblewrap configuration (when backend is "bwrap"). */
  bwrap?: SandboxBwrapConfig;
  tools: SandboxToolPolicy;
  browserAllowHostControl: boolean;
  browser?: SandboxBrowserContext;
  /** Tenant ID for multi-tenant isolation. */
  tenantId?: string;
  /** Tenant state directory (for bwrap mount). */
  tenantStateDir?: string;
};

export type SandboxWorkspaceInfo = {
  workspaceDir: string;
  containerWorkdir: string;
};
