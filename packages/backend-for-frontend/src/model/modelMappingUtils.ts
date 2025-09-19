import { bffApi, catalogApi, tenantApi } from "pagopa-interop-api-clients";
import { getLatestTenantMailOfKind } from "pagopa-interop-commons";
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

export const uiSectionToNotificationTypes = {
  erogazione: {
    richieste: [
      "agreementManagementToProducer",
      "agreementSuspendedUnsuspendedToProducer",
    ],
    finalita: [
      "clientAddedRemovedToProducer",
      "purposeStatusChangedToProducer",
    ],
    "template-eservice": ["templateStatusChangedToProducer"],
    "e-service": [
      "newEserviceTemplateVersionToInstantiator",
      "eserviceTemplateNameChangedToInstantiator",
      "eserviceTemplateStatusChangedToInstantiator",
    ],
    portachiavi: ["clientKeyAddedDeletedToClientUsers"],
  },
  fruizione: {
    richieste: [
      "agreementActivatedRejectedToConsumer",
      "agreementSuspendedUnsuspendedToConsumer",
    ],
    finalita: [
      "purposeActivatedRejectedToConsumer",
      "purposeSuspendedUnsuspendedToConsumer",
    ],
  },
  "catalogo-e-service": ["eserviceStateChangedToConsumer"],
  aderente: {
    deleghe: [
      "delegationApprovedRejectedToDelegator",
      "eserviceNewVersionSubmittedToDelegator",
      "eserviceNewVersionApprovedRejectedToDelegate",
      "delegationSubmittedRevokedToDelegate",
    ],
    anagrafica: ["certifiedVerifiedAttributeAssignedRevokedToAssignee"],
  },
  "gestione-client": {
    "api-e-service": ["clientKeyAddedDeletedToClientUsers"],
  },
} as const;

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
