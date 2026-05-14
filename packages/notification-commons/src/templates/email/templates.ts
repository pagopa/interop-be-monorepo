import { fileURLToPath } from "url";
import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import { z } from "zod";
import { HtmlTemplateService } from "pagopa-interop-commons";
import { htmlTemplateNotFound } from "../../models/errors.js";

export const eventMailTemplateType = {
  agreementActivatedToConsumerMailTemplate:
    "agreement-activated-to-consumer-mail",
  agreementActivatedToProducerMailTemplate:
    "agreement-activated-to-producer-mail",
  agreementSubmittedMailTemplate: "agreement-submitted-mail",
  agreementRejectedMailTemplate: "agreement-rejected-mail",
  agreementUpgradedMailTemplate: "agreement-upgraded-mail",
  eserviceDescriptorSuspendedMailTemplate: "eservice-descriptor-suspended-mail",
  eserviceDescriptorActivatedMailTemplate: "eservice-descriptor-activated-mail",
  eserviceDescriptorPublishedMailTemplate: "eservice-descriptor-published-mail",
  producerKeychainEserviceAddedMailTemplate:
    "producer-keychain-eservice-added-mail",
  agreementSuspendedByConsumerMailTemplate:
    "agreement-suspended-by-consumer-mail",
  agreementSuspendedByPlatformToProducerMailTemplate:
    "agreement-suspended-by-platform-to-producer-mail",
  agreementUnsuspendedByConsumerMailTemplate:
    "agreement-unsuspended-by-consumer-mail",
  agreementUnsuspendedByPlatformToProducerMailTemplate:
    "agreement-unsuspended-by-platform-to-producer-mail",
  agreementSuspendedByPlatformToConsumerMailTemplate:
    "agreement-suspended-by-platform-to-consumer-mail",
  agreementUnsuspendedByPlatformToConsumerMailTemplate:
    "agreement-unsuspended-by-platform-to-consumer-mail",
  agreementSuspendedByProducerMailTemplate:
    "agreement-suspended-by-producer-mail",
  agreementUnsuspendedByProducerMailTemplate:
    "agreement-unsuspended-by-producer-mail",
  agreementArchivedByConsumerMailTemplate:
    "agreement-archived-by-consumer-mail",
  clientPurposeAddedMailTemplate: "client-purpose-added-mail",
  clientPurposeRemovedMailTemplate: "client-purpose-removed-mail",
  purposeVersionSuspendedByConsumerMailTemplate:
    "purpose-version-suspended-by-consumer-mail",
  purposeVersionUnsuspendedByConsumerMailTemplate:
    "purpose-version-unsuspended-by-consumer-mail",
  purposeArchivedMailTemplate: "purpose-archived-mail",
  purposeVersionActivatedMailTemplate: "purpose-version-activated-mail",
  purposeVersionRejectedMailTemplate: "purpose-version-rejected-mail",
  purposeVersionSuspendedByProducerMailTemplate:
    "purpose-version-suspended-by-producer-mail",
  purposeVersionUnsuspendedByProducerMailTemplate:
    "purpose-version-unsuspended-by-producer-mail",
  newPurposeVersionWaitingForApprovalMailTemplate:
    "new-purpose-version-waiting-for-approval-mail",
  eserviceTemplateVersionSuspendedToCreatorMailTemplate:
    "eservice-template-version-suspended-to-creator-mail",
  eserviceTemplateVersionPublishedMailTemplate:
    "eservice-template-version-published-mail",
  eserviceTemplateNameUpdatedMailTemplate:
    "eservice-template-name-updated-mail",
  eserviceTemplateVersionSuspendedToInstantiatorMailTemplate:
    "eservice-template-version-suspended-to-instantiator-mail",
  consumerDelegationApprovedMailTemplate: "consumer-delegation-approved-mail",
  consumerDelegationRejectedMailTemplate: "consumer-delegation-rejected-mail",
  consumerDelegationRevokedMailTemplate: "consumer-delegation-revoked-mail",
  consumerDelegationSubmittedMailTemplate: "consumer-delegation-submitted-mail",
  eserviceDescriptorApprovedByDelegatorMailTemplate:
    "eservice-descriptor-approved-by-delegator-mail",
  eserviceDescriptorRejectedByDelegatorMailTemplate:
    "eservice-descriptor-rejected-by-delegator-mail",
  eserviceDescriptorSubmittedByDelegateMailTemplate:
    "eservice-descriptor-submitted-by-delegate-mail",
  eserviceStateChangedMailTemplate: "eservice-state-changed-mail",
  producerDelegationApprovedMailTemplate: "producer-delegation-approved-mail",
  producerDelegationRejectedMailTemplate: "producer-delegation-rejected-mail",
  producerDelegationRevokedMailTemplate: "producer-delegation-revoked-mail",
  producerDelegationSubmittedMailTemplate: "producer-delegation-submitted-mail",
  tenantCertifiedAttributeAssignedMailTemplate:
    "tenant-certified-attribute-assigned-mail",
  tenantCertifiedAttributeRevokedMailTemplate:
    "tenant-certified-attribute-revoked-mail",
  tenantVerifiedAttributeAssignedMailTemplate:
    "tenant-verified-attribute-assigned-mail",
  tenantVerifiedAttributeRevokedMailTemplate:
    "tenant-verified-attribute-revoked-mail",
  producerKeychainKeyDeletedMailTemplate: "producer-keychain-key-deleted-mail",
  producerKeychainDeletedMailTemplate: "producer-keychain-deleted-mail",
  clientKeyDeletedMailTemplate: "client-key-deleted-mail",
  clientUserDeletedMailTemplate: "client-user-deleted-mail",
  producerKeychainUserDeletedMailTemplate:
    "producer-keychain-user-deleted-mail",
  clientKeyAddedMailTemplate: "client-key-added-mail",
  producerKeychainKeyAddedMailTemplate: "producer-keychain-key-added-mail",
  newPurposeVersionQuotaAdjustmentRequestMailTemplate:
    "new-purpose-version-quota-adjustment-request-mail",
  purposeQuotaAdjustmentRequestMailTemplate:
    "purpose-quota-adjustment-request-mail",
  purposeQuotaOverthresholdMailTemplate: "purpose-quota-overthreshold-mail",
  purposeQuotaAdjustmentResponseMailTemplate:
    "purpose-quota-adjustment-response-mail",
  eserviceArchivingStartedDescriptorToProducerMailTemplate:
    "eservice-archiving-started-descriptor-to-producer-mail",
  eserviceArchivingStartedDescriptorToConsumerMailTemplate:
    "eservice-archiving-started-descriptor-to-consumer-mail",
  eserviceArchivingStartedEserviceToProducerMailTemplate:
    "eservice-archiving-started-eservice-to-producer-mail",
  eserviceArchivingStartedEserviceToConsumerMailTemplate:
    "eservice-archiving-started-eservice-to-consumer-mail",
  eserviceArchivingCompletedDescriptorToProducerMailTemplate:
    "eservice-archiving-completed-descriptor-to-producer-mail",
  eserviceArchivingCompletedDescriptorToConsumerMailTemplate:
    "eservice-archiving-completed-descriptor-to-consumer-mail",
  eserviceArchivingCompletedEserviceToProducerMailTemplate:
    "eservice-archiving-completed-eservice-to-producer-mail",
  eserviceArchivingCompletedEserviceToConsumerMailTemplate:
    "eservice-archiving-completed-eservice-to-consumer-mail",
  eserviceArchivingEarlyArchivedToProducerMailTemplate:
    "eservice-archiving-early-archived-to-producer-mail",
  eserviceArchivingEarlyArchivedToConsumerMailTemplate:
    "eservice-archiving-early-archived-to-consumer-mail",
} as const;

const EventMailTemplateType = z.enum([
  Object.values(eventMailTemplateType)[0],
  ...Object.values(eventMailTemplateType).slice(1),
]);

type EventMailTemplateType = z.infer<typeof EventMailTemplateType>;

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);
const resourcesPath = "resources/templates";

export async function retrieveHTMLTemplate(
  templateKind: EventMailTemplateType
): Promise<string> {
  const templatePath = `${resourcesPath}/${templateKind}.html`;

  try {
    const htmlTemplateBuffer = await fs.readFile(`${dirname}/${templatePath}`);
    return htmlTemplateBuffer.toString();
  } catch {
    throw htmlTemplateNotFound(`/${templatePath}`);
  }
}

function registerPartial(
  templateService: HtmlTemplateService,
  name: string,
  partialPath: string
): void {
  const buffer = fsSync.readFileSync(`${dirname}/${partialPath}`);
  templateService.registerPartial(name, buffer.toString());
}

export function registerEmailTemplatePartials(
  templateService: HtmlTemplateService
): void {
  registerPartial(
    templateService,
    "common-header",
    `${resourcesPath}/headers/common-header.hbs`
  );
  registerPartial(
    templateService,
    "common-footer",
    `${resourcesPath}/footers/common-footer.hbs`
  );
}
