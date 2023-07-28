import {
  AgreementApprovalPolicy,
  Attribute,
  DescriptorState,
  EService,
  PersistentAgreementState,
  Technology,
  agreementApprovalPolicy,
  descriptorState,
  persistentAgreementState,
  technology,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { z } from "zod";
import * as api from "../generated/api.js";
import {
  ApiAgreementApprovalPolicy,
  ApiAgreementState,
  ApiEServiceDescriptorState,
  ApiTechnology,
} from "./models.js";

export function technologyToApiTechnology(input: Technology): ApiTechnology {
  return match<Technology, ApiTechnology>(input)
    .with(technology.rest, () => "REST")
    .with(technology.soap, () => "SOAP")
    .exhaustive();
}

export function apiTechnologyTotechnology(input: ApiTechnology): Technology {
  return match<ApiTechnology, Technology>(input)
    .with("REST", () => technology.rest)
    .with("SOAP", () => technology.soap)
    .exhaustive();
}

export function descriptorStateToApiEServiceDescriptorState(
  input: DescriptorState
): ApiEServiceDescriptorState {
  return match<DescriptorState, ApiEServiceDescriptorState>(input)
    .with(descriptorState.draft, () => "DRAFT")
    .with(descriptorState.published, () => "PUBLISHED")
    .with(descriptorState.suspended, () => "SUSPENDED")
    .with(descriptorState.deprecated, () => "DEPRECATED")
    .with(descriptorState.archived, () => "ARCHIVED")
    .exhaustive();
}

export function apiDescriptorStateToDescriptorState(
  input: ApiEServiceDescriptorState
): DescriptorState {
  return match<ApiEServiceDescriptorState, DescriptorState>(input)
    .with("DRAFT", () => descriptorState.draft)
    .with("PUBLISHED", () => descriptorState.published)
    .with("SUSPENDED", () => descriptorState.suspended)
    .with("DEPRECATED", () => descriptorState.deprecated)
    .with("ARCHIVED", () => descriptorState.archived)
    .exhaustive();
}

export function agreementApprovalPolicyToApiAgreementApprovalPolicy(
  input: AgreementApprovalPolicy | undefined
): ApiAgreementApprovalPolicy {
  return match<AgreementApprovalPolicy | undefined, ApiAgreementApprovalPolicy>(
    input
  )
    .with(agreementApprovalPolicy.automatic, () => "AUTOMATIC")
    .with(agreementApprovalPolicy.manual, () => "MANUAL")
    .otherwise(() => "AUTOMATIC");
}

export function agreementStateToApiAgreementState(
  input: PersistentAgreementState
): ApiAgreementState {
  return match<PersistentAgreementState, ApiAgreementState>(input)
    .with(persistentAgreementState.pending, () => "PENDING")
    .with(persistentAgreementState.rejected, () => "REJECTED")
    .with(persistentAgreementState.active, () => "ACTIVE")
    .with(persistentAgreementState.suspended, () => "SUSPENDED")
    .with(persistentAgreementState.archived, () => "ARCHIVED")
    .with(persistentAgreementState.draft, () => "DRAFT")
    .with(
      persistentAgreementState.missingCertifiedAttributes,
      () => "MISSING_CERTIFIED_ATTRIBUTES"
    )
    .exhaustive();
}

export function apiAgreementStateToAgreementState(
  input: ApiAgreementState
): PersistentAgreementState {
  return match<ApiAgreementState, PersistentAgreementState>(input)
    .with("PENDING", () => persistentAgreementState.pending)
    .with("REJECTED", () => persistentAgreementState.rejected)
    .with("ACTIVE", () => persistentAgreementState.active)
    .with("SUSPENDED", () => persistentAgreementState.suspended)
    .with("ARCHIVED", () => persistentAgreementState.archived)
    .with("DRAFT", () => persistentAgreementState.draft)
    .with(
      "MISSING_CERTIFIED_ATTRIBUTES",
      () => persistentAgreementState.missingCertifiedAttributes
    )
    .exhaustive();
}

export const eServiceToApiEService = (
  eService: EService
): z.infer<typeof api.schemas.EService> => {
  const mapAttribute = (
    a: Attribute
  ):
    | {
        single: {
          id: string;
          explicitAttributeVerification: boolean;
        };
      }
    | {
        group: Array<{
          id: string;
          explicitAttributeVerification: boolean;
        }>;
      } =>
    match(a)
      .with({ type: "SingleAttribute" }, (a) => ({
        single: a.id,
      }))
      .with({ type: "GroupAttribute" }, (a) => ({
        group: a.ids,
      }))
      .exhaustive();

  return {
    id: eService.id,
    producerId: eService.producerId,
    name: eService.name,
    description: eService.description,
    technology: technologyToApiTechnology(eService.technology),
    descriptors: eService.descriptors.map((descriptor) => ({
      id: descriptor.id,
      version: descriptor.version,
      description: descriptor.description,
      audience: descriptor.audience,
      voucherLifespan: descriptor.voucherLifespan,
      dailyCallsPerConsumer: descriptor.dailyCallsPerConsumer,
      dailyCallsTotal: descriptor.dailyCallsTotal,
      interface: descriptor.interface,
      docs: descriptor.docs,
      state: descriptorStateToApiEServiceDescriptorState(descriptor.state),
      agreementApprovalPolicy:
        agreementApprovalPolicyToApiAgreementApprovalPolicy(
          descriptor.agreementApprovalPolicy
        ),
      serverUrls: descriptor.serverUrls,
      publishedAt: descriptor.publishedAt?.toJSON(),
      suspendedAt: descriptor.suspendedAt?.toJSON(),
      deprecatedAt: descriptor.deprecatedAt?.toJSON(),
      archivedAt: descriptor.archivedAt?.toJSON(),
      attributes: {
        certified: descriptor.attributes.certified.map(mapAttribute),
        declared: descriptor.attributes.declared.map(mapAttribute),
        verified: descriptor.attributes.verified.map(mapAttribute),
      },
    })),
  };
};
