import fs from "fs";
import { HtmlTemplateService } from "pagopa-interop-commons";
import path from "path";
import { fileURLToPath } from "url";

import {
  DigestSection,
  computeGroupFlags,
} from "../utils/digestAdmittedRoles.js";
import { TenantDigestData } from "./digestDataService.js";

type DigestTemplateService = {
  compileDigestEmail: (
    data: TenantDigestData,
    visibility: Record<DigestSection, boolean>
  ) => string;
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

  const SECTION_CARD_LIMIT = 6;
  const SECTION_ITEMS_LIMIT = 5;

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
      const waitingForApprovalSentPurposesSingular =
        data.waitingForApprovalSentPurposes?.totalCount === 1;
      const publishedReceivedPurposesSingular =
        data.publishedReceivedPurposes?.totalCount === 1;
      const waitingForApprovalReceivedPurposesSingular =
        data.waitingForApprovalReceivedPurposes?.totalCount === 1;
      const waitingForApprovalReceivedAgreementsSingular =
        data.waitingForApprovalReceivedAgreements?.totalCount === 1;
      const waitingForApprovalReceivedDelegationsSingular =
        data.waitingForApprovalReceivedDelegations?.totalCount === 1;
      const revokedReceivedDelegationsSingular =
        data.revokedReceivedDelegations?.totalCount === 1;
      const receivedAttributesSingular =
        data.receivedAttributes?.totalCount === 1;
      const revokedAttributesSingular =
        data.revokedAttributes?.totalCount === 1;
      const archivingImminentEservicesSingular =
        data.archivingImminentEservices?.totalCount === 1;
      const archivingInProgressEservicesSingular =
        data.archivingInProgressEservices?.totalCount === 1;
      const archivingInProgressRemainder = Math.max(
        (data.archivingInProgressEservices?.totalCount ?? 0) -
          (data.archivingInProgressEservices?.items.length ?? 0),
        0
      );
      const archivingConsumerImminentEservicesSingular =
        data.archivingConsumerImminentEservices?.totalCount === 1;
      const archivingConsumerInProgressEservicesSingular =
        data.archivingConsumerInProgressEservices?.totalCount === 1;
      const archivingConsumerInProgressRemainder = Math.max(
        (data.archivingConsumerInProgressEservices?.totalCount ?? 0) -
          (data.archivingConsumerInProgressEservices?.items.length ?? 0),
        0
      );
      // Consumer stat cards with a zero count are hidden: the remaining ones share the row.
      const archivingConsumerVisibleCardsCount = [
        data.archivingConsumerImminentEservices?.totalCount,
        data.archivingConsumerEserviceScopeCount,
        data.archivingConsumerDescriptorScopeCount,
      ].filter(Boolean).length;
      const archivingConsumerCardWidth = `${Math.floor(
        100 / Math.max(archivingConsumerVisibleCardsCount, 1)
      )}%`;

      // Count for items that exceeded list or card limits
      const newEservicesExceededItemsCount =
        data.newEservices && data.newEservices.totalCount > SECTION_CARD_LIMIT
          ? data.newEservices.totalCount - SECTION_CARD_LIMIT
          : 0;
      const updatedEservicesExceededItemsCount =
        data.updatedEservices &&
        data.updatedEservices.totalCount > SECTION_CARD_LIMIT
          ? data.updatedEservices.totalCount - SECTION_CARD_LIMIT
          : 0;
      const updatedEserviceTemplatesExceededItemsCount =
        data.updatedEserviceTemplates &&
        data.updatedEserviceTemplates.totalCount > SECTION_CARD_LIMIT
          ? data.updatedEserviceTemplates.totalCount - SECTION_CARD_LIMIT
          : 0;
      const acceptedSentAgreementsExceededItemsCount =
        data.acceptedSentAgreements &&
        data.acceptedSentAgreements.totalCount > SECTION_ITEMS_LIMIT
          ? data.acceptedSentAgreements.totalCount - SECTION_ITEMS_LIMIT
          : 0;
      const rejectedSentAgreementsExceededItemsCount =
        data.rejectedSentAgreements &&
        data.rejectedSentAgreements.totalCount > SECTION_ITEMS_LIMIT
          ? data.rejectedSentAgreements.totalCount - SECTION_ITEMS_LIMIT
          : 0;
      const suspendedSentAgreementsExceededItemsCount =
        data.suspendedSentAgreements &&
        data.suspendedSentAgreements.totalCount > SECTION_ITEMS_LIMIT
          ? data.suspendedSentAgreements.totalCount - SECTION_ITEMS_LIMIT
          : 0;
      const publishedSentPurposesExceededItemsCount =
        data.publishedSentPurposes &&
        data.publishedSentPurposes.totalCount > SECTION_ITEMS_LIMIT
          ? data.publishedSentPurposes.totalCount - SECTION_ITEMS_LIMIT
          : 0;
      const rejectedSentPurposesExceededItemsCount =
        data.rejectedSentPurposes &&
        data.rejectedSentPurposes.totalCount > SECTION_ITEMS_LIMIT
          ? data.rejectedSentPurposes.totalCount - SECTION_ITEMS_LIMIT
          : 0;
      const waitingForApprovalSentPurposesExceededItemsCount =
        data.waitingForApprovalSentPurposes &&
        data.waitingForApprovalSentPurposes.totalCount > SECTION_ITEMS_LIMIT
          ? data.waitingForApprovalSentPurposes.totalCount - SECTION_ITEMS_LIMIT
          : 0;
      const waitingForApprovalReceivedAgreementsExceededItemsCount =
        data.waitingForApprovalReceivedAgreements &&
        data.waitingForApprovalReceivedAgreements.totalCount >
          SECTION_ITEMS_LIMIT
          ? data.waitingForApprovalReceivedAgreements.totalCount -
            SECTION_ITEMS_LIMIT
          : 0;
      const publishedReceivedPurposesExceededItemsCount =
        data.publishedReceivedPurposes &&
        data.publishedReceivedPurposes.totalCount > SECTION_ITEMS_LIMIT
          ? data.publishedReceivedPurposes.totalCount - SECTION_ITEMS_LIMIT
          : 0;
      const waitingForApprovalReceivedPurposesExceededItemsCount =
        data.waitingForApprovalReceivedPurposes &&
        data.waitingForApprovalReceivedPurposes.totalCount > SECTION_ITEMS_LIMIT
          ? data.waitingForApprovalReceivedPurposes.totalCount -
            SECTION_ITEMS_LIMIT
          : 0;
      const waitingForApprovalReceivedDelegationsExceededItemsCount =
        data.waitingForApprovalReceivedDelegations &&
        data.waitingForApprovalReceivedDelegations.totalCount >
          SECTION_ITEMS_LIMIT
          ? data.waitingForApprovalReceivedDelegations.totalCount -
            SECTION_ITEMS_LIMIT
          : 0;
      const revokedReceivedDelegationsExceededItemsCount =
        data.revokedReceivedDelegations &&
        data.revokedReceivedDelegations.totalCount > SECTION_ITEMS_LIMIT
          ? data.revokedReceivedDelegations.totalCount - SECTION_ITEMS_LIMIT
          : 0;
      const receivedAttributesExceededItemsCount =
        data.receivedAttributes &&
        data.receivedAttributes.totalCount > SECTION_ITEMS_LIMIT
          ? data.receivedAttributes.totalCount - SECTION_ITEMS_LIMIT
          : 0;
      const revokedAttributesExceededItemsCount =
        data.revokedAttributes &&
        data.revokedAttributes.totalCount > SECTION_ITEMS_LIMIT
          ? data.revokedAttributes.totalCount - SECTION_ITEMS_LIMIT
          : 0;

      return templateService.compileHtml(digestTemplate, {
        title: "Riepilogo notifiche",
        ...data,
        ...computeGroupFlags(data, visibility),
        showNewEservices: visibility.newEservices,
        showUpdatedEservices: visibility.updatedEservices,
        showUpdatedEserviceTemplates: visibility.updatedEserviceTemplates,
        showSentAgreements: visibility.sentAgreements,
        showReceivedAgreements: visibility.receivedAgreements,
        showSentPurposes: visibility.sentPurposes,
        showReceivedPurposes: visibility.receivedPurposes,
        showDelegations: visibility.delegations,
        showAttributes: visibility.attributes,
        showArchivingProducer: visibility.archivingProducer,
        showArchivingConsumer: visibility.archivingConsumer,
        newEservicesSingular,
        updatedEservicesSingular,
        updatedEserviceTemplatesSingular,
        acceptedSentAgreementsSingular,
        rejectedSentAgreementsSingular,
        suspendedSentAgreementsSingular,
        publishedSentPurposesSingular,
        rejectedSentPurposesSingular,
        publishedReceivedPurposesSingular,
        waitingForApprovalReceivedPurposesSingular,
        waitingForApprovalSentPurposesSingular,
        waitingForApprovalReceivedAgreementsSingular,
        waitingForApprovalReceivedDelegationsSingular,
        revokedReceivedDelegationsSingular,
        receivedAttributesSingular,
        revokedAttributesSingular,
        archivingImminentEservicesSingular,
        archivingInProgressEservicesSingular,
        archivingInProgressRemainder,
        archivingConsumerImminentEservicesSingular,
        archivingConsumerInProgressEservicesSingular,
        archivingConsumerInProgressRemainder,
        archivingConsumerCardWidth,
        newEservicesExceededItemsCount,
        updatedEservicesExceededItemsCount,
        updatedEserviceTemplatesExceededItemsCount,
        acceptedSentAgreementsExceededItemsCount,
        rejectedSentAgreementsExceededItemsCount,
        suspendedSentAgreementsExceededItemsCount,
        publishedSentPurposesExceededItemsCount,
        rejectedSentPurposesExceededItemsCount,
        waitingForApprovalSentPurposesExceededItemsCount,
        waitingForApprovalReceivedAgreementsExceededItemsCount,
        publishedReceivedPurposesExceededItemsCount,
        waitingForApprovalReceivedPurposesExceededItemsCount,
        waitingForApprovalReceivedDelegationsExceededItemsCount,
        revokedReceivedDelegationsExceededItemsCount,
        receivedAttributesExceededItemsCount,
        revokedAttributesExceededItemsCount,
      });
    },
  };
}
