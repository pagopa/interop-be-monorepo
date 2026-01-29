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
      // Computed boolean flags to conditionally render section groups
      const hasEservicesContent = !!(
        data.newEservices?.totalCount ||
        data.updatedEservices?.totalCount ||
        data.updatedEserviceTemplates?.totalCount ||
        data.popularEserviceTemplates?.totalCount
      );
      const hasSentItemsContent = !!(
        data.acceptedSentAgreements?.totalCount ||
        data.rejectedSentAgreements?.totalCount ||
        data.suspendedSentAgreements?.totalCount ||
        data.publishedSentPurposes?.totalCount ||
        data.rejectedSentPurposes?.totalCount ||
        data.waitingForApprovalSentPurposes?.totalCount
      );
      const hasReceivedItemsContent = !!(
        data.waitingForApprovalReceivedAgreements?.totalCount ||
        data.publishedReceivedPurposes?.totalCount ||
        data.waitingForApprovalReceivedPurposes?.totalCount
      );
      const hasDelegationsContent = !!(
        data.activeSentDelegations?.totalCount ||
        data.rejectedSentDelegations?.totalCount ||
        data.waitingForApprovalReceivedDelegations?.totalCount ||
        data.revokedReceivedDelegations?.totalCount
      );
      const hasAttributesContent = !!(
        data.receivedAttributes?.totalCount ||
        data.revokedAttributes?.totalCount
      );

      // Singular flags for conditional text (singular vs plural forms)
      const newEservicesSingular = data.newEservices?.totalCount === 1;
      const updatedEservicesSingular = data.updatedEservices?.totalCount === 1;
      const updatedEserviceTemplatesSingular =
        data.updatedEserviceTemplates?.totalCount === 1;
      const popularEserviceTemplatesSingular =
        data.popularEserviceTemplates?.totalCount === 1;
      const acceptedSentAgreementsSingular =
        data.acceptedSentAgreements?.totalCount === 1;
      const rejectedSentAgreementsSingular =
        data.rejectedSentAgreements?.totalCount === 1;
      const suspendedSentAgreementsSingular =
        data.suspendedSentAgreements?.totalCount === 1;
      const publishedSentPurposesSingular =
        data.publishedSentPurposes?.totalCount === 1;
      const rejectedSentPurposesSingular =
        data.rejectedSentPurposes?.totalCount === 1;
      const waitingForApprovalReceivedAgreementsSingular =
        data.waitingForApprovalReceivedAgreements?.totalCount === 1;
      const waitingForApprovalReceivedDelegationsSingular =
        data.waitingForApprovalReceivedDelegations?.totalCount === 1;
      const revokedReceivedDelegationsSingular =
        data.revokedReceivedDelegations?.totalCount === 1;
      const activeSentDelegationsSingular =
        data.activeSentDelegations?.totalCount === 1;
      const rejectedSentDelegationsSingular =
        data.rejectedSentDelegations?.totalCount === 1;
      const receivedAttributesSingular =
        data.receivedAttributes?.totalCount === 1;
      const revokedAttributesSingular =
        data.revokedAttributes?.totalCount === 1;

      return templateService.compileHtml(digestTemplate, {
        title: "Riepilogo notifiche",
        ...data,
        hasEservicesContent,
        hasSentItemsContent,
        hasReceivedItemsContent,
        hasDelegationsContent,
        hasAttributesContent,
        newEservicesSingular,
        updatedEservicesSingular,
        updatedEserviceTemplatesSingular,
        popularEserviceTemplatesSingular,
        acceptedSentAgreementsSingular,
        rejectedSentAgreementsSingular,
        suspendedSentAgreementsSingular,
        publishedSentPurposesSingular,
        rejectedSentPurposesSingular,
        waitingForApprovalReceivedAgreementsSingular,
        waitingForApprovalReceivedDelegationsSingular,
        revokedReceivedDelegationsSingular,
        activeSentDelegationsSingular,
        rejectedSentDelegationsSingular,
        receivedAttributesSingular,
        revokedAttributesSingular,
      });
    },
  };
}
