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
import { P, match } from "ts-pattern";
import { z } from "zod";
import * as api from "../generated/api.js";
import {
  ApiAgreementApprovalPolicy,
  ApiAgreementState,
  ApiAttribute,
  ApiEServiceDescriptorState,
  ApiTechnology,
} from "./models.js";

export function technologyToApiTechnology(input: Technology): ApiTechnology {
  return match<Technology, ApiTechnology>(input)
    .with(technology.rest, () => "REST")
    .with(technology.soap, () => "SOAP")
    .exhaustive();
}

export function apiTechnologyToTechnology(input: ApiTechnology): Technology {
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

export function apiAgreementApprovalPolicyToAgreementApprovalPolicy(
  input: ApiAgreementApprovalPolicy
): AgreementApprovalPolicy {
  return match<ApiAgreementApprovalPolicy, AgreementApprovalPolicy>(input)
    .with("AUTOMATIC", () => agreementApprovalPolicy.automatic)
    .with("MANUAL", () => agreementApprovalPolicy.manual)
    .exhaustive();
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

export function apiAttributeToAttribute(
  input: ApiAttribute
): Attribute | undefined {
  return match<ApiAttribute, Attribute | undefined>(input)
    .with({ single: P.not(P.nullish) }, (a) => ({
      type: "SingleAttribute",
      id: {
        id: a.single.id,
        explicitAttributeVerification: a.single.explicitAttributeVerification,
      },
    }))
    .with({ group: P.not(P.nullish) }, (a) => ({
      type: "GroupAttribute",
      ids: a.group.map((id) => ({
        id: id.id,
        explicitAttributeVerification: id.explicitAttributeVerification,
      })),
    }))
    .otherwise(() => undefined);
}

export function attributeToApiAttribute(input: Attribute): ApiAttribute {
  return match(input)
    .with({ type: "SingleAttribute" }, (a) => ({
      single: a.id,
    }))
    .with({ type: "GroupAttribute" }, (a) => ({
      group: a.ids,
    }))
    .exhaustive();
}

export const eServiceToApiEService = (
  eService: EService
): z.infer<typeof api.schemas.EService> => ({
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
      certified: descriptor.attributes.certified.map(attributeToApiAttribute),
      declared: descriptor.attributes.declared.map(attributeToApiAttribute),
      verified: descriptor.attributes.verified.map(attributeToApiAttribute),
    },
  })),
});
