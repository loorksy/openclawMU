/**
 * OPENCLAWMU ADDITION: Admin Platform barrel.
 */

export { handleAdminPlatformHttpRequest, createAdminPlatformHttpServer } from "./http.js";
export { resolveAdminPlatformConfig } from "./config.js";
export { createStaff, listStaff, staffCount } from "./staff-store.js";
export { hasPermission, permissionsForRole } from "./permissions.js";
export { hashPassword, verifyPassword } from "./password.js";
export type { AdminRole, AdminPermission, AdminStaffPublic } from "./types.js";
