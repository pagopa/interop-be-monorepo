import { bffApi, catalogApi, tenantApi } from "pagopa-interop-api-clients";
import { getLatestTenantMailOfKind } from "pagopa-interop-commons";
import {
  DigestNotificationType,
  NotificationType,
} from "pagopa-interop-models";
import { z } from "zod";

import {
  fromApiTenantMail,
  toBffTenantMail,
} from "../api/tenantApiConverter.js";
import { catalogApiDescriptorState } from "./types.js";

/*
  This file contains commons utility functions
  used to pick or transform data from model to another.
*/

const activeDescriptorStatesFilter: catalogApi.EServiceDescriptorState[] = [
  catalogApiDescriptorState.PUBLISHED,
  catalogApiDescriptorState.SUSPENDED,
  catalogApiDescriptorState.DEPRECATED,
  catalogApiDescriptorState.ARCHIVING,
  catalogApiDescriptorState.ARCHIVING_SUSPENDED,
];

const invalidDescriptorState: catalogApi.EServiceDescriptorState[] = [
  catalogApiDescriptorState.DRAFT,
  catalogApiDescriptorState.WAITING_FOR_APPROVAL,
];

export function getLatestActiveDescriptor(
  eservice: catalogApi.EService,
  includeArchived: boolean = false
): catalogApi.EServiceDescriptor | undefined {
  return eservice.descriptors
    .filter(
      (d) =>
        activeDescriptorStatesFilter.includes(d.state) ||
        (includeArchived && d.state === catalogApiDescriptorState.ARCHIVED)
    )
    .sort((a, b) => Number(a.version) - Number(b.version))
    .at(-1);
}

export function getValidDescriptor(
  eservice: catalogApi.EService
): catalogApi.EServiceDescriptor[] {
  return eservice.descriptors.filter(
    (d) => !invalidDescriptorState.includes(d.state)
  );
}

export function getLastArchivingRequest(
  eservice: catalogApi.EService,
  descriptors: catalogApi.EServiceDescriptor[]
): bffApi.DelegatedArchivingRequest | undefined {
  const descriptorRequests: bffApi.DelegatedArchivingRequest[] = descriptors
    .map((d) =>
      d.delegatedArchivingRequest
        ? d.delegatedArchivingRequest.map((req) => ({
            ...req,
            descriptorId: d.id,
          }))
        : []
    )
    .flat();

  const archivingRequests = descriptorRequests.concat(
    (eservice.delegatedArchivingRequest ?? []).map((req) => ({
      ...req,
      descriptorId: undefined,
    }))
  );

  const lastRequest = archivingRequests
    ?.sort(
      (a, b) =>
        new Date(a.requestedAt).getTime() - new Date(b.requestedAt).getTime()
    )
    .at(-1);

  if (!lastRequest || lastRequest.acceptedAt) {
    return undefined;
  }

  return lastRequest;
}

export function getLatestTenantContactEmail(
  tenant: tenantApi.Tenant
): bffApi.Mail | undefined {
  const mail = getLatestTenantMailOfKind(
    tenant.mails.map(fromApiTenantMail),
    tenantApi.MailKind.Values.CONTACT_EMAIL
  );

  return mail ? toBffTenantMail(mail) : undefined;
}

export type UiSection =
  | "/erogazione"
  | "/erogazione/richieste"
  | "/erogazione/finalita"
  | "/erogazione/template-eservice"
  | "/erogazione/catalogo-template"
  | "/erogazione/e-service"
  | "/erogazione/portachiavi"
  | "/fruizione"
  | "/fruizione/richieste"
  | "/fruizione/finalita"
  | "/analisi-del-rischio"
  | "/catalogo-e-service"
  | "/aderente"
  | "/aderente/deleghe"
  | "/aderente/anagrafica"
  | "/gestione-client"
  | "/gestione-client/api-e-service"
  | "/gestione-client/api-interop"
  | "/notifiche/configurazione";

type NotificationUiPath =
  | UiSection
  | `${UiSection}/:entityId`
  | `${UiSection}/:entityId/dettaglio`;

export const notificationTypeToUiPath: Record<
  NotificationType,
  NotificationUiPath
> = {
  agreementManagementToProducer: "/erogazione/richieste/:entityId",
  agreementSuspendedUnsuspendedToProducer: "/erogazione/richieste/:entityId",
  agreementSuspendedUnsuspendedToConsumer: "/fruizione/richieste/:entityId",
  clientAddedRemovedToProducer: "/erogazione/finalita/:entityId",
  purposeStatusChangedToProducer: "/erogazione/finalita/:entityId",
  templateStatusChangedToProducer: "/erogazione/template-eservice/:entityId",
  eserviceStateChangedToProducer: "/erogazione/e-service/:entityId",
  newEserviceTemplateVersionToInstantiator: "/erogazione/e-service/:entityId",
  eserviceTemplateNameChangedToInstantiator: "/erogazione/e-service/:entityId",
  eserviceTemplateStatusChangedToInstantiator:
    "/erogazione/e-service/:entityId",
  clientKeyAddedDeletedToClientUsers: "/gestione-client/api-interop/:entityId",
  clientKeyConsumerAddedDeletedToClientUsers:
    "/gestione-client/api-e-service/:entityId",
  agreementActivatedRejectedToConsumer: "/fruizione/richieste/:entityId",
  purposeActivatedRejectedToConsumer: "/fruizione/finalita/:entityId",
  purposeSuspendedUnsuspendedToConsumer: "/fruizione/finalita/:entityId",
  eserviceStateChangedToConsumer: "/catalogo-e-service/:entityId",
  delegationApprovedRejectedToDelegator: "/aderente/deleghe/:entityId",
  eserviceNewVersionSubmittedToDelegator: "/aderente/deleghe/:entityId",
  eserviceNewVersionApprovedRejectedToDelegate: "/aderente/deleghe/:entityId",
  delegationSubmittedRevokedToDelegate: "/aderente/deleghe/:entityId",
  certifiedVerifiedAttributeAssignedRevokedToAssignee: "/aderente/anagrafica",
  producerKeychainKeyAddedDeletedToClientUsers:
    "/erogazione/portachiavi/:entityId",
  purposeQuotaAdjustmentRequestToProducer: "/erogazione/finalita/:entityId",
  purposeOverQuotaStateToConsumer: "/fruizione/finalita/:entityId",
  purposeRiskAnalysisAssignedForSigningToReviewer:
    "/analisi-del-rischio/:entityId",
  purposeRiskAnalysisAssignedForWritingAndSigningToReviewer:
    "/analisi-del-rischio/:entityId",
  purposePublishedWithRiskAnalysisToReviewer:
    "/analisi-del-rischio/:entityId/dettaglio",
  draftPurposeDeletedWithRiskAnalysisToReviewer: "/analisi-del-rischio",
  purposeRiskAnalysisAssignmentRemovedToReviewer: "/analisi-del-rischio",
  purposeRiskAnalysisSignedToReviewer:
    "/analisi-del-rischio/:entityId/dettaglio",
  purposeRiskAnalysisSignedToAdmin: "/fruizione/finalita/:entityId",
  purposeRiskAnalysisRejectedToAdmin: "/fruizione/finalita/:entityId",
  eserviceArchivingRequestedToDelegator: "/erogazione/e-service/:entityId",
  eserviceArchivingApprovedRejectedToDelegate:
    "/erogazione/e-service/:entityId",
} as const;

export function getNotificationDeepLink(
  notificationType: NotificationType,
  entityId: string
): string {
  return notificationTypeToUiPath[notificationType].replace(
    ":entityId",
    entityId
  );
}

export const Category = z.enum([
  "Subscribers",
  "Providers",
  "Delegations",
  "AttributesAndKeys",
]);
export type Category = z.infer<typeof Category>;

export const notificationTypeToCategory: Record<NotificationType, Category> = {
  agreementManagementToProducer: "Providers",
  agreementSuspendedUnsuspendedToProducer: "Providers",
  agreementSuspendedUnsuspendedToConsumer: "Subscribers",
  clientAddedRemovedToProducer: "Providers",
  purposeStatusChangedToProducer: "Providers",
  templateStatusChangedToProducer: "Providers",
  eserviceStateChangedToProducer: "Providers",
  newEserviceTemplateVersionToInstantiator: "Providers",
  eserviceTemplateNameChangedToInstantiator: "Providers",
  eserviceTemplateStatusChangedToInstantiator: "Providers",
  clientKeyAddedDeletedToClientUsers: "Providers",
  clientKeyConsumerAddedDeletedToClientUsers: "Providers",
  agreementActivatedRejectedToConsumer: "Subscribers",
  purposeActivatedRejectedToConsumer: "Subscribers",
  purposeSuspendedUnsuspendedToConsumer: "Subscribers",
  eserviceStateChangedToConsumer: "Subscribers",
  delegationApprovedRejectedToDelegator: "Delegations",
  eserviceNewVersionSubmittedToDelegator: "Delegations",
  eserviceNewVersionApprovedRejectedToDelegate: "Delegations",
  delegationSubmittedRevokedToDelegate: "Delegations",
  certifiedVerifiedAttributeAssignedRevokedToAssignee: "AttributesAndKeys",
  producerKeychainKeyAddedDeletedToClientUsers: "AttributesAndKeys",
  purposeQuotaAdjustmentRequestToProducer: "Providers",
  purposeOverQuotaStateToConsumer: "Subscribers",
  purposeRiskAnalysisAssignedForSigningToReviewer: "Subscribers",
  purposeRiskAnalysisAssignedForWritingAndSigningToReviewer: "Subscribers",
  purposePublishedWithRiskAnalysisToReviewer: "Subscribers",
  draftPurposeDeletedWithRiskAnalysisToReviewer: "Subscribers",
  purposeRiskAnalysisAssignmentRemovedToReviewer: "Subscribers",
  purposeRiskAnalysisSignedToReviewer: "Subscribers",
  purposeRiskAnalysisSignedToAdmin: "Subscribers",
  purposeRiskAnalysisRejectedToAdmin: "Subscribers",
  eserviceArchivingRequestedToDelegator: "Delegations",
  eserviceArchivingApprovedRejectedToDelegate: "Delegations",
};

export const categoryToNotificationTypes: Record<Category, NotificationType[]> =
  Object.entries(notificationTypeToCategory).reduce(
    (acc, [type, category]) => ({
      ...acc,
      [category]: [...(acc[category] || []), type as NotificationType],
    }),
    {} as Record<Category, NotificationType[]>
  );

export const digestNotificationTypeToUiSection: Record<
  DigestNotificationType,
  UiSection
> = {
  eserviceCatalog: "/catalogo-e-service",
  eserviceTemplateToCreator: "/erogazione/template-eservice",
  eserviceTemplateToInstantiator: "/erogazione/catalogo-template",
  agreementToProducer: "/erogazione/richieste",
  agreementToConsumer: "/fruizione/richieste",
  purposeToProducer: "/erogazione/finalita",
  purposeToConsumer: "/fruizione/finalita",
  delegation: "/aderente/deleghe",
  attribute: "/aderente/anagrafica",
  notificationSettings: "/notifiche/configurazione",
} as const;
