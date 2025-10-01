import {
  AgreementId,
  Delegation,
  DescriptorId,
  EServiceId,
  UserId,
} from "pagopa-interop-models";

export type ActiveDelegations = {
  producerDelegation: Delegation | undefined;
  consumerDelegation: Delegation | undefined;
};

export type AgreementContractPDFPayload = {
  todayDate: string;
  todayTime: string;
  agreementId: AgreementId;
  submitterId: UserId;
  submissionDate: string;
  submissionTime: string;
  activatorId: UserId;
  activationDate: string;
  activationTime: string;
  eserviceId: EServiceId;
  eserviceName: string;
  descriptorId: DescriptorId;
  descriptorVersion: string;
  producerName: string;
  producerIpaCode: string | undefined;
  consumerName: string;
  consumerIpaCode: string | undefined;
  certifiedAttributes: Array<{
    assignmentDate: string;
    assignmentTime: string;
    attributeName: string;
    attributeId: string;
  }>;
  declaredAttributes: Array<{
    assignmentDate: string;
    assignmentTime: string;
    attributeName: string;
    attributeId: string;
    delegationId: string | undefined;
  }>;
  verifiedAttributes: Array<{
    assignmentDate: string;
    assignmentTime: string;
    attributeName: string;
    attributeId: string;
    expirationDate: string | undefined;
    delegationId: string | undefined;
  }>;
  producerDelegationId: string | undefined;
  producerDelegateName: string | undefined;
  producerDelegateIpaCode: string | undefined;
  consumerDelegationId: string | undefined;
  consumerDelegateName: string | undefined;
  consumerDelegateIpaCode: string | undefined;
};
