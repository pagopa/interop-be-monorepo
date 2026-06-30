import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(currentDir, "../../..");

const templatePaths = [
  join(
    repoRoot,
    "packages/notification-commons/src/templates/email/resources/templates/headers/common-header.hbs"
  ),
  join(
    repoRoot,
    "packages/email-digest-dispatcher/src/resources/templates/digest-mail.html"
  ),
  ...readdirSync(
    join(repoRoot, "packages/notification-email-sender/src/resources/templates")
  )
    .filter((fileName) => fileName.endsWith(".html"))
    .map((fileName) =>
      join(
        repoRoot,
        "packages/notification-email-sender/src/resources/templates",
        fileName
      )
    ),
];

describe("email template font styles", () => {
  it.each(
    templatePaths.map((path) => [path.replace(`${repoRoot}/`, ""), path])
  )(
    "inlines font styles without relying on the SelfCare stylesheet integrity: %s",
    (_templateName, templatePath) => {
      const template = readFileSync(templatePath, "utf8");

      expect(template).not.toContain(
        "https://selfcare.pagopa.it/assets/font/selfhostedfonts.css"
      );
      expect(template).not.toContain("sha384-pTEX27xRwV9gE3zi2iAdapYn6pEZ");
      expect(template).not.toContain('crossorigin="anonymous"');
      expect(template).toContain("@font-face");
      expect(template).toMatch(/font-family:\s*["']Titillium Web["']/);
    }
  );
});
