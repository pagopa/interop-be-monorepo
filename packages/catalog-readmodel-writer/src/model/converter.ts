import {
  AgreementApprovalPolicy,
  AgreementApprovalPolicyV1,
  EServiceAttribute,
  Descriptor,
  DescriptorState,
  Document,
  EService,
  EServiceAttributeV1,
  EServiceDescriptorStateV1,
  EServiceDescriptorV1,
  EServiceDocumentV1,
  EServiceTechnologyV1,
  EServiceV1,
  Technology,
  agreementApprovalPolicy,
  descriptorState,
  technology,
} from "pagopa-interop-models";
import { P, match } from "ts-pattern";

export const fromAgreementApprovalPolicyV1 = (
  input: AgreementApprovalPolicyV1 | undefined
): AgreementApprovalPolicy | undefined => {
  if (input == null) {
    return undefined;
  }

  switch (input) {
    case AgreementApprovalPolicyV1.MANUAL:
      return agreementApprovalPolicy.manual;
    case AgreementApprovalPolicyV1.AUTOMATIC:
      return agreementApprovalPolicy.automatic;
    case AgreementApprovalPolicyV1.UNSPECIFIED$:
      throw new Error("Unspecified agreement approval policy");
  }
};

export const fromEServiceDescriptorStateV1 = (
  input: EServiceDescriptorStateV1
): DescriptorState => {
  switch (input) {
    case EServiceDescriptorStateV1.DRAFT:
      return descriptorState.draft;
    case EServiceDescriptorStateV1.SUSPENDED:
      return descriptorState.suspended;
    case EServiceDescriptorStateV1.ARCHIVED:
      return descriptorState.archived;
    case EServiceDescriptorStateV1.PUBLISHED:
      return descriptorState.published;
    case EServiceDescriptorStateV1.DEPRECATED:
      return descriptorState.deprecated;
    case EServiceDescriptorStateV1.UNSPECIFIED$:
      throw new Error("Unspecified descriptor state");
  }
};

export const fromEServiceTechnologyV1 = (
  input: EServiceTechnologyV1
): Technology => {
  switch (input) {
    case EServiceTechnologyV1.REST:
      return technology.rest;
    case EServiceTechnologyV1.SOAP:
      return technology.soap;
    case EServiceTechnologyV1.UNSPECIFIED$:
      throw new Error("Unspecified technology");
  }
};

export const fromEServiceAttributeV1 = (
  input: EServiceAttributeV1
): EServiceAttribute[] =>
  match<EServiceAttributeV1, EServiceAttribute[]>(input)
    .with(
      {
        single: P.not(P.nullish),
      },
      ({ single }) => [single]
    )
    .otherwise(() => input.group);

export const fromDocumentV1 = (input: EServiceDocumentV1): Document => ({
  ...input,
  uploadDate: new Date(input.uploadDate),
});

export const fromDescriptorV1 = (input: EServiceDescriptorV1): Descriptor => ({
  ...input,
  attributes:
    input.attributes != null
      ? {
          certified: input.attributes.certified.map(fromEServiceAttributeV1),
          declared: input.attributes.declared.map(fromEServiceAttributeV1),
          verified: input.attributes.verified.map(fromEServiceAttributeV1),
        }
      : {
          certified: [],
          declared: [],
          verified: [],
        },
  docs: input.docs.map(fromDocumentV1),
  state: fromEServiceDescriptorStateV1(input.state),
  interface:
    input.interface != null ? fromDocumentV1(input.interface) : undefined,
  agreementApprovalPolicy: fromAgreementApprovalPolicyV1(
    input.agreementApprovalPolicy
  ),
  createdAt: new Date(Number(input.createdAt)),
  publishedAt: input.publishedAt
    ? new Date(Number(input.publishedAt))
    : undefined,
  suspendedAt: input.suspendedAt
    ? new Date(Number(input.suspendedAt))
    : undefined,
  deprecatedAt: input.deprecatedAt
    ? new Date(Number(input.deprecatedAt))
    : undefined,
  archivedAt: input.archivedAt ? new Date(Number(input.archivedAt)) : undefined,
});

export const fromEServiceV1 = (input: EServiceV1): EService => ({
  ...input,
  technology: fromEServiceTechnologyV1(input.technology),
  attributes:
    input.attributes != null
      ? {
          certified: input.attributes.certified.map(fromEServiceAttributeV1),
          declared: input.attributes.declared.map(fromEServiceAttributeV1),
          verified: input.attributes.verified.map(fromEServiceAttributeV1),
        }
      : undefined,
  descriptors: input.descriptors.map(fromDescriptorV1),
  createdAt: new Date(Number(input.createdAt)),
});
