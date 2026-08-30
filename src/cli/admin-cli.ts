import type { Command } from "commander";
import { createStaff, listStaff, staffCount } from "../admin-platform/staff-store.js";
import { defaultRuntime } from "../runtime.js";
import { formatDocsLink } from "../terminal/links.js";
import { theme } from "../terminal/theme.js";

type BootstrapOptions = {
  email?: string;
  password?: string;
  name?: string;
  json?: boolean;
};

export function registerAdminCli(program: Command) {
  const admin = program
    .command("admin")
    .description("Admin Platform (staff bootstrap and listing)")
    .addHelpText(
      "after",
      () =>
        `\n${theme.muted("Docs:")} ${formatDocsLink("/admin/index", "docs.openclaw.ai/admin")}\n`,
    );

  admin
    .command("bootstrap")
    .description("Create the first Super Admin account")
    .requiredOption("--email <email>", "Super Admin email")
    .requiredOption("--password <password>", "Password (min 12 characters)")
    .option("--name <name>", "Display name", "Super Admin")
    .option("--json", "Print JSON", false)
    .action(async (opts: BootstrapOptions) => {
      if (staffCount() > 0) {
        defaultRuntime.error("Staff store already initialized. Use the Admin UI to add accounts.");
        defaultRuntime.exit(1);
        return;
      }
      const staff = await createStaff({
        email: String(opts.email ?? ""),
        password: String(opts.password ?? ""),
        name: String(opts.name ?? "Super Admin"),
        role: "super_admin",
      });
      if (opts.json) {
        defaultRuntime.log(JSON.stringify(staff, null, 2));
        return;
      }
      defaultRuntime.log(`Created Super Admin ${staff.email} (${staff.id})`);
    });

  admin
    .command("staff")
    .description("List Admin Platform staff (emails and roles only)")
    .option("--json", "Print JSON", false)
    .action((opts: { json?: boolean }) => {
      const staff = listStaff();
      if (opts.json) {
        defaultRuntime.log(JSON.stringify({ staff }, null, 2));
        return;
      }
      if (staff.length === 0) {
        defaultRuntime.log(
          "No staff accounts. Run: openclaw admin bootstrap --email … --password …",
        );
        return;
      }
      for (const row of staff) {
        defaultRuntime.log(`${row.email}\t${row.role}\t${row.disabled ? "disabled" : "active"}`);
      }
    });
}
