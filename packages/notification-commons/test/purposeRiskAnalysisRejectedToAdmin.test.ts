import { buildHTMLTemplateService } from "pagopa-interop-commons";
import { describe, expect, it } from "vitest";

import {
  eventMailTemplateType,
  registerEmailTemplatePartials,
  retrieveHTMLTemplate,
} from "../src/templates/email/templates.js";
import { inAppTemplates } from "../src/templates/inApp/inAppTemplates.js";

describe("purposeRiskAnalysisRejectedToAdmin templates", () => {
  it("includes the purpose and eservice names in the in-app message", () => {
    expect(
      inAppTemplates.purposeRiskAnalysisRejectedToAdmin(
        "Finalità test",
        "E-service test"
      )
    ).toBe(
      "L'analisi del rischio per la finalità Finalità test associata all'e-service E-service test è stata rifiutata."
    );
  });

  it("renders the rejection email with escaped names and the purpose link", async () => {
    const templateService = buildHTMLTemplateService();
    registerEmailTemplatePartials(templateService);
    const template = await retrieveHTMLTemplate(
      eventMailTemplateType.purposeRiskAnalysisRejectedToAdminMailTemplate
    );
    const body = templateService.compileHtml(template, {
      title: "Un'analisi del rischio è stata rifiutata",
      purposeTitle: "Finalità <test>",
      eserviceName: "E-service <test>",
      notificationType: "purposeRiskAnalysisRejectedToAdmin",
      entityId: "purpose-id",
      selfcareId: "selfcare-id",
      bffUrl: "https://example.com",
      ctaLabel: "Visualizza finalità",
    });
    expect(body).toContain("Finalità &lt;test&gt;");
    expect(body).toContain("E-service &lt;test&gt;");
    expect(body.replace(/\s+/g, " ")).toContain(
      "è stata rifiutata. Scopri il motivo per cui non è stata approvata."
    );
    expect(body).toContain("purposeRiskAnalysisRejectedToAdmin");
    expect(body).toContain("purpose-id");
    expect(body).toContain("selfcare-id");
    expect(body).toContain("Visualizza finalità");
    expect(body).toContain("{{ recipientName }}");
  });
});
