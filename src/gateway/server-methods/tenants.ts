/**
 * Tenant management gateway methods.
 * OPENCLAWMU ADDITION: multi-tenant control-plane RPC surface.
 *
 * Methods:
 *   tenants.list     - List all tenants (admin only)
 *   tenants.create   - Create a new tenant (admin only)
 *   tenants.get      - Get tenant info (admin or own tenant)
 *   tenants.delete   - Delete a tenant (admin only)
 *   tenants.rotate   - Rotate tenant token (admin or own tenant)
 */

import type { GatewayRequestHandlers, GatewayRequestHandlerOptions } from "./types.js";
import {
  createTenant,
  removeTenant,
  rotateTenantToken,
  listTenants,
  getTenant,
  updateTenant,
  isValidTenantId,
  resolveTenantStateDir,
  backupTenantToS3,
  restoreTenantFromS3,
  listTenantBackups,
  deleteTenantBackup,
  type BackupConfig,
} from "../../tenants/index.js";
import { errorShape, ErrorCodes } from "../protocol/index.js";

/**
 * Checks if the client has admin scope.
 */
function hasAdminScope(opts: GatewayRequestHandlerOptions): boolean {
  const scopes = opts.client?.connect?.scopes ?? [];
  return scopes.includes("operator.admin");
}

/**
 * Checks if the client can access a specific tenant.
 * Admin can access any tenant, tenant token can only access own tenant.
 */
function canAccessTenant(opts: GatewayRequestHandlerOptions, tenantId: string): boolean {
  // Admin can access any tenant
  if (hasAdminScope(opts)) {
    return true;
  }

  // Tenant token can access own tenant only.
  return opts.client?.tenantId === tenantId;
}

/**
 * Tenant management gateway method handlers.
 */
export const tenantMethods: GatewayRequestHandlers = {
  /**
   * Lists all tenants.
   * Requires admin scope.
   */
  "tenants.list": async (opts) => {
    if (!hasAdminScope(opts)) {
      opts.respond(false, undefined, errorShape(ErrorCodes.UNAUTHORIZED, "Admin access required"));
      return;
    }

    const tenantIds = listTenants();
    const tenants = tenantIds.map((id) => {
      const entry = getTenant(id);
      return {
        tenantId: id,
        displayName: entry?.displayName,
        createdAt: entry?.createdAt,
        lastSeenAt: entry?.lastSeenAt,
        disabled: entry?.disabled,
      };
    });

    opts.respond(true, { tenants });
  },

  /**
   * Creates a new tenant.
   * Requires admin scope.
   */
  "tenants.create": async (opts) => {
    if (!hasAdminScope(opts)) {
      opts.respond(false, undefined, errorShape(ErrorCodes.UNAUTHORIZED, "Admin access required"));
      return;
    }

    const params = opts.params as { tenantId?: string; displayName?: string };
    const tenantId = params.tenantId;

    if (!tenantId || typeof tenantId !== "string") {
      opts.respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, "tenantId is required"),
      );
      return;
    }

    if (!isValidTenantId(tenantId)) {
      opts.respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          "Invalid tenant ID format. Must be lowercase alphanumeric with hyphens/underscores, 1-32 chars.",
        ),
      );
      return;
    }

    try {
      const result = createTenant(tenantId, { displayName: params.displayName });
      opts.respond(true, {
        tenantId: result.tenantId,
        token: result.token,
        createdAt: result.createdAt,
        stateDir: resolveTenantStateDir(result.tenantId),
      });
    } catch (err) {
      opts.respond(
        false,
        undefined,
        errorShape(ErrorCodes.UNAVAILABLE, err instanceof Error ? err.message : String(err)),
      );
    }
  },

  /**
   * Gets tenant information.
   * Admin can access any tenant.
   */
  "tenants.get": async (opts) => {
    const params = opts.params as { tenantId?: string };
    const tenantId = params.tenantId;

    if (!tenantId || typeof tenantId !== "string") {
      opts.respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, "tenantId is required"),
      );
      return;
    }

    if (!canAccessTenant(opts, tenantId)) {
      opts.respond(false, undefined, errorShape(ErrorCodes.UNAUTHORIZED, "Access denied"));
      return;
    }

    const tenant = getTenant(tenantId);
    if (!tenant) {
      opts.respond(false, undefined, errorShape(ErrorCodes.NOT_FOUND, "Tenant not found"));
      return;
    }

    opts.respond(true, {
      tenantId,
      displayName: tenant.displayName,
      createdAt: tenant.createdAt,
      lastSeenAt: tenant.lastSeenAt,
      disabled: tenant.disabled,
      stateDir: resolveTenantStateDir(tenantId),
    });
  },

  /**
   * Deletes a tenant.
   * Requires admin scope.
   */
  "tenants.delete": async (opts) => {
    if (!hasAdminScope(opts)) {
      opts.respond(false, undefined, errorShape(ErrorCodes.UNAUTHORIZED, "Admin access required"));
      return;
    }

    const params = opts.params as { tenantId?: string; deleteData?: boolean };
    const tenantId = params.tenantId;

    if (!tenantId || typeof tenantId !== "string") {
      opts.respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, "tenantId is required"),
      );
      return;
    }

    try {
      removeTenant(tenantId, { deleteData: params.deleteData });
      opts.respond(true, { deleted: true, tenantId });
    } catch (err) {
      opts.respond(
        false,
        undefined,
        errorShape(ErrorCodes.UNAVAILABLE, err instanceof Error ? err.message : String(err)),
      );
    }
  },

  /**
   * Rotates a tenant's authentication token.
   * Admin can rotate any tenant's token.
   */
  "tenants.rotate": async (opts) => {
    const params = opts.params as { tenantId?: string };
    const tenantId = params.tenantId;

    if (!tenantId || typeof tenantId !== "string") {
      opts.respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, "tenantId is required"),
      );
      return;
    }

    if (!canAccessTenant(opts, tenantId)) {
      opts.respond(false, undefined, errorShape(ErrorCodes.UNAUTHORIZED, "Access denied"));
      return;
    }

    try {
      const result = rotateTenantToken(tenantId);
      opts.respond(true, {
        tenantId: result.tenantId,
        token: result.token,
      });
    } catch (err) {
      opts.respond(
        false,
        undefined,
        errorShape(ErrorCodes.UNAVAILABLE, err instanceof Error ? err.message : String(err)),
      );
    }
  },

  /**
   * Updates tenant properties.
   * Requires admin scope.
   */
  "tenants.update": async (opts) => {
    if (!hasAdminScope(opts)) {
      opts.respond(false, undefined, errorShape(ErrorCodes.UNAUTHORIZED, "Admin access required"));
      return;
    }

    const params = opts.params as { tenantId?: string; displayName?: string; disabled?: boolean };
    const tenantId = params.tenantId;

    if (!tenantId || typeof tenantId !== "string") {
      opts.respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, "tenantId is required"),
      );
      return;
    }

    try {
      updateTenant(tenantId, {
        displayName: params.displayName,
        disabled: params.disabled,
      });
      opts.respond(true, { updated: true, tenantId });
    } catch (err) {
      opts.respond(
        false,
        undefined,
        errorShape(ErrorCodes.UNAVAILABLE, err instanceof Error ? err.message : String(err)),
      );
    }
  },

  /**
   * Backs up a tenant to S3.
   * Admin can backup any tenant, tenant can backup own.
   */
  "tenants.backup": async (opts) => {
    const params = opts.params as {
      tenantId?: string;
      bucket?: string;
      endpoint?: string;
      region?: string;
      prefix?: string;
      accessKeyId?: string;
      secretAccessKey?: string;
    };
    const tenantId = params.tenantId;

    if (!tenantId || typeof tenantId !== "string") {
      opts.respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, "tenantId is required"),
      );
      return;
    }

    if (!canAccessTenant(opts, tenantId)) {
      opts.respond(false, undefined, errorShape(ErrorCodes.UNAUTHORIZED, "Access denied"));
      return;
    }

    if (!params.bucket) {
      opts.respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "bucket is required"));
      return;
    }

    const config: BackupConfig = {
      bucket: params.bucket,
      endpoint: params.endpoint,
      region: params.region,
      prefix: params.prefix,
      accessKeyId: params.accessKeyId,
      secretAccessKey: params.secretAccessKey,
    };

    try {
      const result = await backupTenantToS3({ tenantId, config });
      opts.respond(true, {
        key: result.key,
        tenantId: result.tenantId,
        timestamp: result.timestamp,
        size: result.size,
      });
    } catch (err) {
      opts.respond(
        false,
        undefined,
        errorShape(ErrorCodes.UNAVAILABLE, err instanceof Error ? err.message : String(err)),
      );
    }
  },

  /**
   * Restores a tenant from S3 backup.
   * Requires admin scope.
   */
  "tenants.restore": async (opts) => {
    if (!hasAdminScope(opts)) {
      opts.respond(false, undefined, errorShape(ErrorCodes.UNAUTHORIZED, "Admin access required"));
      return;
    }

    const params = opts.params as {
      tenantId?: string;
      key?: string;
      bucket?: string;
      endpoint?: string;
      region?: string;
      accessKeyId?: string;
      secretAccessKey?: string;
      createIfMissing?: boolean;
    };
    const tenantId = params.tenantId;

    if (!tenantId || typeof tenantId !== "string") {
      opts.respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, "tenantId is required"),
      );
      return;
    }

    if (!params.key) {
      opts.respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "key is required"));
      return;
    }

    if (!params.bucket) {
      opts.respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "bucket is required"));
      return;
    }

    const config: BackupConfig = {
      bucket: params.bucket,
      endpoint: params.endpoint,
      region: params.region,
      accessKeyId: params.accessKeyId,
      secretAccessKey: params.secretAccessKey,
    };

    try {
      const result = await restoreTenantFromS3({
        tenantId,
        config,
        key: params.key,
        createIfMissing: params.createIfMissing,
      });
      opts.respond(true, {
        tenantId: result.tenantId,
        restoredAt: result.restoredAt,
        sourceKey: result.sourceKey,
      });
    } catch (err) {
      opts.respond(
        false,
        undefined,
        errorShape(ErrorCodes.UNAVAILABLE, err instanceof Error ? err.message : String(err)),
      );
    }
  },

  /**
   * Lists backups for a tenant.
   * Admin can list any tenant's backups, tenant can list own.
   */
  "tenants.backups.list": async (opts) => {
    const params = opts.params as {
      tenantId?: string;
      bucket?: string;
      endpoint?: string;
      region?: string;
      prefix?: string;
      accessKeyId?: string;
      secretAccessKey?: string;
    };
    const tenantId = params.tenantId;

    if (!tenantId || typeof tenantId !== "string") {
      opts.respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, "tenantId is required"),
      );
      return;
    }

    if (!canAccessTenant(opts, tenantId)) {
      opts.respond(false, undefined, errorShape(ErrorCodes.UNAUTHORIZED, "Access denied"));
      return;
    }

    if (!params.bucket) {
      opts.respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "bucket is required"));
      return;
    }

    const config: BackupConfig = {
      bucket: params.bucket,
      endpoint: params.endpoint,
      region: params.region,
      prefix: params.prefix,
      accessKeyId: params.accessKeyId,
      secretAccessKey: params.secretAccessKey,
    };

    try {
      const backups = await listTenantBackups({ tenantId, config });
      opts.respond(true, { backups });
    } catch (err) {
      opts.respond(
        false,
        undefined,
        errorShape(ErrorCodes.UNAVAILABLE, err instanceof Error ? err.message : String(err)),
      );
    }
  },

  /**
   * Deletes a backup from S3.
   * Requires admin scope.
   */
  "tenants.backups.delete": async (opts) => {
    if (!hasAdminScope(opts)) {
      opts.respond(false, undefined, errorShape(ErrorCodes.UNAUTHORIZED, "Admin access required"));
      return;
    }

    const params = opts.params as {
      key?: string;
      bucket?: string;
      endpoint?: string;
      region?: string;
      accessKeyId?: string;
      secretAccessKey?: string;
    };

    if (!params.key) {
      opts.respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "key is required"));
      return;
    }

    if (!params.bucket) {
      opts.respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "bucket is required"));
      return;
    }

    const config: BackupConfig = {
      bucket: params.bucket,
      endpoint: params.endpoint,
      region: params.region,
      accessKeyId: params.accessKeyId,
      secretAccessKey: params.secretAccessKey,
    };

    try {
      await deleteTenantBackup({ key: params.key, config });
      opts.respond(true, { deleted: true, key: params.key });
    } catch (err) {
      opts.respond(
        false,
        undefined,
        errorShape(ErrorCodes.UNAVAILABLE, err instanceof Error ? err.message : String(err)),
      );
    }
  },
};

/**
 * List of tenant method names for registration.
 */
export const TENANT_METHODS = Object.keys(tenantMethods);
