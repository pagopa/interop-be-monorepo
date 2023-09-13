import {
  AgreementApprovalPolicy,
  AgreementApprovalPolicyV1,
  Attribute,
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
): AgreementApprovalPolicy | undefined =>
  match(input)
    .with(AgreementApprovalPolicyV1.UNSPECIFIED$, () => undefined)
    .with(
      AgreementApprovalPolicyV1.MANUAL,
      () => agreementApprovalPolicy.manual
    )
    .with(
      AgreementApprovalPolicyV1.AUTOMATIC,
      () => agreementApprovalPolicy.automatic
    )
    .otherwise(() => undefined);

export const fromEServiceDescriptorStateV1 = (
  input: EServiceDescriptorStateV1
): DescriptorState =>
  match(input)
    .with(EServiceDescriptorStateV1.DRAFT, () => descriptorState.draft)
    .with(EServiceDescriptorStateV1.SUSPENDED, () => descriptorState.suspended)
    .with(EServiceDescriptorStateV1.ARCHIVED, () => descriptorState.archived)
    .with(EServiceDescriptorStateV1.PUBLISHED, () => descriptorState.published)
    .with(
      EServiceDescriptorStateV1.DEPRECATED,
      () => descriptorState.deprecated
    )
    .otherwise(() => descriptorState.draft);

export const fromEServiceTechnologyV1 = (
  input: EServiceTechnologyV1
): Technology =>
  match(input)
    .with(EServiceTechnologyV1.REST, () => technology.rest)
    .with(EServiceTechnologyV1.SOAP, () => technology.soap)
    .otherwise(() => technology.rest);

export const fromEServiceAttributeV1 = (
  input: EServiceAttributeV1
): Attribute =>
  match<EServiceAttributeV1, Attribute>(input)
    .with(
      {
        single: P.not(P.nullish),
      },
      ({ single }) => ({ id: single, ids: undefined })
    )
    .otherwise(() => ({
      id: undefined,
      ids: input.group,
    }));

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
