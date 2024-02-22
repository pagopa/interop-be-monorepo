import {
  AgreementApprovalPolicy,
  AgreementApprovalPolicyV2,
  EServiceAttribute,
  Descriptor,
  DescriptorState,
  Document,
  EService,
  EServiceAttributeV2,
  EServiceDescriptorStateV2,
  EServiceDescriptorV2,
  EServiceDocumentV2,
  EServiceTechnologyV2,
  EServiceV2,
  Technology,
  agreementApprovalPolicy,
  descriptorState,
  technology,
  unsafeBrandId,
} from "pagopa-interop-models";
import { P, match } from "ts-pattern";
import { parseDateOrThrow } from "./utils.js";

export const fromAgreementApprovalPolicyV2 = (
  input: AgreementApprovalPolicyV2 | undefined
): AgreementApprovalPolicy | undefined => {
  if (input == null) {
    return undefined;
  }

  switch (input) {
    case AgreementApprovalPolicyV2.MANUAL:
      return agreementApprovalPolicy.manual;
    case AgreementApprovalPolicyV2.AUTOMATIC:
      return agreementApprovalPolicy.automatic;
  }
};

export const fromEServiceDescriptorStateV2 = (
  input: EServiceDescriptorStateV2
): DescriptorState => {
  switch (input) {
    case EServiceDescriptorStateV2.DRAFT:
      return descriptorState.draft;
    case EServiceDescriptorStateV2.SUSPENDED:
      return descriptorState.suspended;
    case EServiceDescriptorStateV2.ARCHIVED:
      return descriptorState.archived;
    case EServiceDescriptorStateV2.PUBLISHED:
      return descriptorState.published;
    case EServiceDescriptorStateV2.DEPRECATED:
      return descriptorState.deprecated;
  }
};

export const fromEServiceTechnologyV2 = (
  input: EServiceTechnologyV2
): Technology => {
  switch (input) {
    case EServiceTechnologyV2.REST:
      return technology.rest;
    case EServiceTechnologyV2.SOAP:
      return technology.soap;
  }
};

export const fromEServiceAttributeV2 = (
  input: EServiceAttributeV2
): EServiceAttribute[] =>
  match<EServiceAttributeV2, EServiceAttribute[]>(input)
    .with(
      {
        single: P.not(P.nullish),
      },
      ({ single }) => [{ ...single, id: unsafeBrandId(single.id) }]
    )
    .otherwise(() =>
      input.group.map((a) => ({ ...a, id: unsafeBrandId(a.id) }))
    );

export const fromDocumentV2 = (input: EServiceDocumentV2): Document => ({
  ...input,
  id: unsafeBrandId(input.id),
  uploadDate: new Date(input.uploadDate),
});

export const fromDescriptorV2 = (input: EServiceDescriptorV2): Descriptor => ({
  ...input,
  id: unsafeBrandId(input.id),
  attributes:
    input.attributes != null
      ? {
          certified: input.attributes.certified.map(fromEServiceAttributeV2),
          declared: input.attributes.declared.map(fromEServiceAttributeV2),
          verified: input.attributes.verified.map(fromEServiceAttributeV2),
        }
      : {
          certified: [],
          declared: [],
          verified: [],
        },
  docs: input.docs.map(fromDocumentV2),
  state: fromEServiceDescriptorStateV2(input.state),
  interface:
    input.interface != null ? fromDocumentV2(input.interface) : undefined,
  agreementApprovalPolicy: fromAgreementApprovalPolicyV2(
    input.agreementApprovalPolicy
  ),
  // createdAt is required in EService definition but not in protobuf,
  // this bug is handled with ISSUE https://pagopa.atlassian.net/browse/IMN-171
  createdAt: parseDateOrThrow(input.createdAt),
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

export const fromEServiceV2 = (input: EServiceV2): EService => ({
  ...input,
  id: unsafeBrandId(input.id),
  producerId: unsafeBrandId(input.producerId),
  technology: fromEServiceTechnologyV2(input.technology),
  attributes:
    input.attributes != null
      ? {
          certified: input.attributes.certified.map(fromEServiceAttributeV2),
          declared: input.attributes.declared.map(fromEServiceAttributeV2),
          verified: input.attributes.verified.map(fromEServiceAttributeV2),
        }
      : undefined,
  descriptors: input.descriptors.map(fromDescriptorV2),
  // createdAt is required in EService definition but not in protobuf,
  // this bug is handled with ISSUE https://pagopa.atlassian.net/browse/IMN-171
  createdAt: parseDateOrThrow(input.createdAt),
});
