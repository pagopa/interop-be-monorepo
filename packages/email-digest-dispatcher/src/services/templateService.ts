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
  const filename = fileURLToPath(import.meta.url);
  const dirname = path.dirname(filename);

  // Register icon partials
  const iconPartials = [
    "icon-grid",
    "icon-inbox",
    "icon-purpose",
    "icon-delegation",
    "icon-code",
    "icon-external-link",
    "icon-success",
    "icon-warning",
    "icon-error",
  ];

  iconPartials.forEach((iconName) => {
    const iconPath = `${dirname}/../resources/templates/partials/${iconName}.svg`;
    const iconContent = fs.readFileSync(iconPath).toString();
    templateService.registerPartial(iconName, iconContent);
  });

  // Load digest template
  const digestTemplatePath = `${dirname}/../resources/templates/digest-mail.html`;
  const digestTemplate = fs.readFileSync(digestTemplatePath).toString();

  return {
    compileDigestEmail(data: TenantDigestData): string {
      return templateService.compileHtml(digestTemplate, {
        title: "Riepilogo notifiche",
        ...data,
      });
    },
  };
}
