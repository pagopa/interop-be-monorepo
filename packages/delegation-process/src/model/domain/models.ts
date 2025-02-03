import {
  DelegationId,
  DelegationKind,
  DelegationState,
  EService,
  EServiceId,
  Tenant,
  TenantId,
  UserId,
} from "pagopa-interop-models";

export type GetDelegationsFilters = {
  eserviceId?: EServiceId;
  delegatorId?: TenantId;
  delegateId?: TenantId;
  delegationKind?: DelegationKind;
  states?: DelegationState[];
};

export type DelegationActivationPDFPayload = {
  todayDate: string;
  todayTime: string;
  delegationId: DelegationId;
  delegatorName: Tenant["name"];
  delegatorIpaCode: Tenant["externalId"]["value"] | undefined;
  delegateName: Tenant["name"];
  delegateIpaCode: Tenant["externalId"]["value"] | undefined;
  eserviceId: EService["id"];
  eserviceName: EService["name"];
  submitterId: UserId;
  submissionDate: string;
  submissionTime: string;
  activatorId: UserId;
  activationDate: string;
  activationTime: string;
};

export type DelegationRevocationPDFPayload = {
  todayDate: string;
  todayTime: string;
  delegationId: DelegationId;
  delegatorName: Tenant["name"];
  delegatorIpaCode: Tenant["externalId"]["value"] | undefined;
  delegateName: Tenant["name"];
  delegateIpaCode: Tenant["externalId"]["value"] | undefined;
  eserviceId: EService["id"];
  eserviceName: EService["name"];
  submitterId: UserId;
  revokerId: UserId;
  revocationDate: string;
  revocationTime: string;
};
