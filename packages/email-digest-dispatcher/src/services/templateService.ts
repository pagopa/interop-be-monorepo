import { fileURLToPath } from "url";
import fs from "fs";
import path from "path";
import { HtmlTemplateService } from "pagopa-interop-commons";
import { DigestSection } from "../utils/digestAdmittedRoles.js";
import { TenantDigestData } from "./digestDataService.js";

export type DigestTemplateService = {
  compileDigestEmail: (
    data: TenantDigestData,
    visibility: Record<DigestSection, boolean>
  ) => string;
};

/**
 * Computes group-level flags: a group is shown when it has data
 * AND at least one of its sub-sections is visible for the user's roles.
 */
// eslint-disable-next-line complexity
function computeGroupFlags(
  data: TenantDigestData,
  v: Record<DigestSection, boolean>
): Record<string, boolean> {
  return {
    hasEservicesContent: !!(
      (v.newEservices && data.newEservices?.totalCount) ||
      (v.updatedEservices && data.updatedEservices?.totalCount) ||
      (v.updatedEserviceTemplates &&
        data.updatedEserviceTemplates?.totalCount) ||
      (v.popularEserviceTemplates && data.popularEserviceTemplates?.totalCount)
    ),
    hasSentItemsContent: !!(
      (v.sentAgreements &&
        (data.acceptedSentAgreements?.totalCount ||
          data.rejectedSentAgreements?.totalCount ||
          data.suspendedSentAgreements?.totalCount)) ||
      (v.sentPurposes &&
        (data.publishedSentPurposes?.totalCount ||
          data.rejectedSentPurposes?.totalCount ||
          data.waitingForApprovalSentPurposes?.totalCount))
    ),
    hasReceivedItemsContent: !!(
      (v.receivedAgreements &&
        data.waitingForApprovalReceivedAgreements?.totalCount) ||
      (v.receivedPurposes &&
        (data.publishedReceivedPurposes?.totalCount ||
          data.waitingForApprovalReceivedPurposes?.totalCount))
    ),
    hasDelegationsContent: !!(
      v.delegations &&
      (data.activeSentDelegations?.totalCount ||
        data.rejectedSentDelegations?.totalCount ||
        data.waitingForApprovalReceivedDelegations?.totalCount ||
        data.revokedReceivedDelegations?.totalCount)
    ),
    hasAttributesContent: !!(
      v.attributes &&
      (data.receivedAttributes?.totalCount ||
        data.revokedAttributes?.totalCount)
    ),
  };
}

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
    compileDigestEmail(
      data: TenantDigestData,
      visibility: Record<DigestSection, boolean>
    ): string {
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
        showNewEservices: visibility.newEservices,
        showUpdatedEservices: visibility.updatedEservices,
        showUpdatedEserviceTemplates: visibility.updatedEserviceTemplates,
        showPopularEserviceTemplates: visibility.popularEserviceTemplates,
        showSentAgreements: visibility.sentAgreements,
        showReceivedAgreements: visibility.receivedAgreements,
        showSentPurposes: visibility.sentPurposes,
        showReceivedPurposes: visibility.receivedPurposes,
        showDelegations: visibility.delegations,
        showAttributes: visibility.attributes,
        ...computeGroupFlags(data, visibility),
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
