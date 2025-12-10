import { fileURLToPath } from "url";
import fs from "fs";
import path from "path";
import { HtmlTemplateService } from "pagopa-interop-commons";
import { TenantDigestData } from "./digestDataService.js";

export type DigestTemplateService = {
  compileDigestEmail: (data: TenantDigestData) => string;
};

export function digestTemplateServiceBuilder(
  templateService: HtmlTemplateService
): DigestTemplateService {
  // Register partials
  const filename = fileURLToPath(import.meta.url);
  const dirname = path.dirname(filename);

  function registerPartial(name: string, partialPath: string): void {
    const buffer = fs.readFileSync(`${dirname}/../${partialPath}`);
    templateService.registerPartial(name, buffer.toString());
  }

  // Register common partials
  registerPartial(
    "common-header",
    "resources/templates/headers/common-header.hbs"
  );
  registerPartial(
    "common-footer",
    "resources/templates/footers/common-footer.hbs"
  );

  // Load digest template
  const digestTemplatePath = `${dirname}/../resources/templates/digest-mail.html`;
  const digestTemplate = fs.readFileSync(digestTemplatePath).toString();

  return {
    compileDigestEmail(data: TenantDigestData): string {
      return templateService.compileHtml(digestTemplate, {
        title: "Riepilogo notifiche",
        tenantName: data.tenantName,
        summaryItems: data.summaryItems,
      });
    },
  };
}
