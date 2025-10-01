import { bffApi, catalogApi, tenantApi } from "pagopa-interop-api-clients";
import { getLatestTenantMailOfKind } from "pagopa-interop-commons";
import { NotificationType } from "pagopa-interop-models";
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
];

const invalidDescriptorState: catalogApi.EServiceDescriptorState[] = [
  catalogApiDescriptorState.DRAFT,
  catalogApiDescriptorState.WAITING_FOR_APPROVAL,
];

export function getLatestActiveDescriptor(
  eservice: catalogApi.EService
): catalogApi.EServiceDescriptor | undefined {
  return eservice.descriptors
    .filter((d) => activeDescriptorStatesFilter.includes(d.state))
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
  | "/erogazione/e-service"
  | "/erogazione/portachiavi"
  | "/fruizione"
  | "/fruizione/richieste"
  | "/fruizione/finalita"
  | "/catalogo-e-service"
  | "/aderente"
  | "/aderente/deleghe"
  | "/aderente/anagrafica";

export const notificationTypeToUiSection: Record<NotificationType, UiSection> =
  {
    agreementManagementToProducer: "/erogazione/richieste",
    agreementSuspendedUnsuspendedToProducer: "/erogazione/richieste",
    agreementSuspendedUnsuspendedToConsumer: "/fruizione/richieste",
    clientAddedRemovedToProducer: "/erogazione/finalita",
    purposeStatusChangedToProducer: "/erogazione/finalita",
    templateStatusChangedToProducer: "/erogazione/template-eservice",
    newEserviceTemplateVersionToInstantiator: "/erogazione/e-service",
    eserviceTemplateNameChangedToInstantiator: "/erogazione/e-service",
    eserviceTemplateStatusChangedToInstantiator: "/erogazione/e-service",
    clientKeyAddedDeletedToClientUsers: "/erogazione/portachiavi",
    agreementActivatedRejectedToConsumer: "/fruizione/richieste",
    purposeActivatedRejectedToConsumer: "/fruizione/finalita",
    purposeSuspendedUnsuspendedToConsumer: "/fruizione/finalita",
    eserviceStateChangedToConsumer: "/catalogo-e-service",
    delegationApprovedRejectedToDelegator: "/aderente/deleghe",
    eserviceNewVersionSubmittedToDelegator: "/aderente/deleghe",
    eserviceNewVersionApprovedRejectedToDelegate: "/aderente/deleghe",
    delegationSubmittedRevokedToDelegate: "/aderente/deleghe",
    certifiedVerifiedAttributeAssignedRevokedToAssignee: "/aderente/anagrafica",
  } as const;

export const Category = z.enum([
  "Subscribers",
  "Providers",
  "Delegations",
  "AttributesAndKeys",
]);
export type NotificationCategory = z.infer<typeof Category>;

export const notificationTypeToCategory: Record<
  NotificationType,
  NotificationCategory
> = {
  agreementManagementToProducer: "Providers",
  agreementSuspendedUnsuspendedToProducer: "Providers",
  agreementSuspendedUnsuspendedToConsumer: "Subscribers",
  clientAddedRemovedToProducer: "Providers",
  purposeStatusChangedToProducer: "Providers",
  templateStatusChangedToProducer: "Providers",
  newEserviceTemplateVersionToInstantiator: "Providers",
  eserviceTemplateNameChangedToInstantiator: "Providers",
  eserviceTemplateStatusChangedToInstantiator: "Providers",
  clientKeyAddedDeletedToClientUsers: "Providers",
  agreementActivatedRejectedToConsumer: "Subscribers",
  purposeActivatedRejectedToConsumer: "Subscribers",
  purposeSuspendedUnsuspendedToConsumer: "Subscribers",
  eserviceStateChangedToConsumer: "Subscribers",
  delegationApprovedRejectedToDelegator: "Delegations",
  eserviceNewVersionSubmittedToDelegator: "Delegations",
  eserviceNewVersionApprovedRejectedToDelegate: "Delegations",
  delegationSubmittedRevokedToDelegate: "Delegations",
  certifiedVerifiedAttributeAssignedRevokedToAssignee: "AttributesAndKeys",
};

export const categoryToNotificationTypes: Record<
  NotificationCategory,
  NotificationType[]
> = Object.entries(notificationTypeToCategory).reduce(
  (acc, [type, category]) => ({
    ...acc,
    [category]: [...(acc[category] || []), type as NotificationType],
  }),
  {} as Record<NotificationCategory, NotificationType[]>
);
