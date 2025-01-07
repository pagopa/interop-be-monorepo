import { DelegationId, EService, Tenant, UserId } from "pagopa-interop-models";

export type DelegationActivationPDFPayload = {
  delegationKindText: string;
  todayDate: string;
  todayTime: string;
  delegationId: DelegationId;
  delegatorName: Tenant["name"];
  delegatorCode: Tenant["externalId"]["value"];
  delegateName: Tenant["name"];
  delegateCode: Tenant["externalId"]["value"];
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
  delegationKindText: string;
  todayDate: string;
  todayTime: string;
  delegationId: DelegationId;
  delegatorName: Tenant["name"];
  delegatorCode: Tenant["externalId"]["value"];
  delegateName: Tenant["name"];
  delegateCode: Tenant["externalId"]["value"];
  eserviceId: EService["id"];
  eserviceName: EService["name"];
  submitterId: UserId;
  revokerId: UserId;
  revocationDate: string;
  revocationTime: string;
};
