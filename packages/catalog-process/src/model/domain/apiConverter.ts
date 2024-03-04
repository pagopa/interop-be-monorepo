import {
  AgreementApprovalPolicy,
  DescriptorState,
  EService,
  AgreementState,
  agreementState,
  Technology,
  agreementApprovalPolicy,
  descriptorState,
  technology,
  EServiceMode,
  eserviceMode,
  Descriptor,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { z } from "zod";
import * as api from "../generated/api.js";
import {
  ApiAgreementApprovalPolicy,
  ApiAgreementState,
  ApiEServiceDescriptorState,
  ApiEServiceMode,
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
  input: AgreementState
): ApiAgreementState {
  return match<AgreementState, ApiAgreementState>(input)
    .with(agreementState.pending, () => "PENDING")
    .with(agreementState.rejected, () => "REJECTED")
    .with(agreementState.active, () => "ACTIVE")
    .with(agreementState.suspended, () => "SUSPENDED")
    .with(agreementState.archived, () => "ARCHIVED")
    .with(agreementState.draft, () => "DRAFT")
    .with(
      agreementState.missingCertifiedAttributes,
      () => "MISSING_CERTIFIED_ATTRIBUTES"
    )
    .exhaustive();
}

export function apiAgreementStateToAgreementState(
  input: ApiAgreementState
): AgreementState {
  return match<ApiAgreementState, AgreementState>(input)
    .with("PENDING", () => agreementState.pending)
    .with("REJECTED", () => agreementState.rejected)
    .with("ACTIVE", () => agreementState.active)
    .with("SUSPENDED", () => agreementState.suspended)
    .with("ARCHIVED", () => agreementState.archived)
    .with("DRAFT", () => agreementState.draft)
    .with(
      "MISSING_CERTIFIED_ATTRIBUTES",
      () => agreementState.missingCertifiedAttributes
    )
    .exhaustive();
}

export function apiEServiceModeToEServiceMode(
  input: ApiEServiceMode
): EServiceMode {
  return match<ApiEServiceMode, EServiceMode>(input)
    .with("RECEIVE", () => eserviceMode.receive)
    .with("DELIVER", () => eserviceMode.deliver)
    .exhaustive();
}

export function eServiceModeToApiEServiceMode(
  input: EServiceMode
): ApiEServiceMode {
  return match<EServiceMode, ApiEServiceMode>(input)
    .with(eserviceMode.receive, () => "RECEIVE")
    .with(eserviceMode.deliver, () => "DELIVER")
    .exhaustive();
}

export const descriptorToApiDescriptor = (
  descriptor: Descriptor
): z.infer<typeof api.schemas.EServiceDescriptor> => ({
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
  agreementApprovalPolicy: agreementApprovalPolicyToApiAgreementApprovalPolicy(
    descriptor.agreementApprovalPolicy
  ),
  serverUrls: descriptor.serverUrls,
  publishedAt: descriptor.publishedAt?.toJSON(),
  suspendedAt: descriptor.suspendedAt?.toJSON(),
  deprecatedAt: descriptor.deprecatedAt?.toJSON(),
  archivedAt: descriptor.archivedAt?.toJSON(),
  attributes: {
    certified: descriptor.attributes.certified,
    declared: descriptor.attributes.declared,
    verified: descriptor.attributes.verified,
  },
});

export const eServiceToApiEService = (
  eService: EService
): z.infer<typeof api.schemas.EService> => ({
  id: eService.id,
  producerId: eService.producerId,
  name: eService.name,
  description: eService.description,
  technology: technologyToApiTechnology(eService.technology),
  mode: eServiceModeToApiEServiceMode(eService.mode),
  riskAnalysis: eService.riskAnalysis.map((riskAnalysis) => ({
    id: riskAnalysis.id,
    name: riskAnalysis.name,
    createdAt: riskAnalysis.createdAt.toJSON(),
    riskAnalysisForm: {
      id: riskAnalysis.riskAnalysisForm.id,
      version: riskAnalysis.riskAnalysisForm.version,
      singleAnswers: riskAnalysis.riskAnalysisForm.singleAnswers,
      multiAnswers: riskAnalysis.riskAnalysisForm.multiAnswers,
    },
  })),
  descriptors: eService.descriptors.map(descriptorToApiDescriptor),
});
