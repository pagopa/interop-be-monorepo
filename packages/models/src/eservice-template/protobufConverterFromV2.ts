import { unsafeBrandId } from "../brandedIds.js";
import {
  fromAgreementApprovalPolicyV2,
  fromDocumentV2,
  fromEServiceAttributeV2,
  fromEServiceModeV2,
  fromEServiceTechnologyV2,
  fromRiskAnalysisFormV2,
} from "../eservice/protobufConverterFromV2.js";
import {
  EServiceTemplateV2,
  EServiceTemplateVersionStateV2,
  EServiceTemplateVersionV2,
  EServiceTemplateRiskAnalysisV2,
} from "../gen/v2/eservice-template/eservice-template.js";
import { fromTenantKindV2 } from "../tenant/protobufConverterFromV2.js";
import { bigIntToDate } from "../utils.js";
import {
  EServiceTemplate,
  EServiceTemplateVersion,
  EServiceTemplateVersionState,
  eserviceTemplateVersionState,
  EServiceTemplateRiskAnalysis,
} from "./eserviceTemplate.js";

export const fromEServiceTemplateVersionStateV2 = (
  input: EServiceTemplateVersionStateV2
): EServiceTemplateVersionState => {
  switch (input) {
    case EServiceTemplateVersionStateV2.PUBLISHED:
      return eserviceTemplateVersionState.published;
    case EServiceTemplateVersionStateV2.DRAFT:
      return eserviceTemplateVersionState.draft;
    case EServiceTemplateVersionStateV2.SUSPENDED:
      return eserviceTemplateVersionState.suspended;
    case EServiceTemplateVersionStateV2.DEPRECATED:
      return eserviceTemplateVersionState.deprecated;
  }
};

export const fromEServiceTemplateVersionV2 = (
  input: EServiceTemplateVersionV2
): EServiceTemplateVersion => ({
  ...input,
  id: unsafeBrandId(input.id),
  version: Number(input.version),
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
  state: fromEServiceTemplateVersionStateV2(input.state),
  interface:
    input.interface != null ? fromDocumentV2(input.interface) : undefined,
  agreementApprovalPolicy:
    input.agreementApprovalPolicy != null
      ? fromAgreementApprovalPolicyV2(input.agreementApprovalPolicy)
      : undefined,
  createdAt: bigIntToDate(input.createdAt),
  publishedAt: bigIntToDate(input.publishedAt),
  suspendedAt: bigIntToDate(input.suspendedAt),
  deprecatedAt: bigIntToDate(input.deprecatedAt),
});

export function fromEServiceTemplateRiskAnalysisV2(
  input: EServiceTemplateRiskAnalysisV2
): EServiceTemplateRiskAnalysis {
  return {
    ...input,
    id: unsafeBrandId(input.id),
    createdAt: bigIntToDate(input.createdAt),
    riskAnalysisForm: fromRiskAnalysisFormV2(input.riskAnalysisForm),
    tenantKind: fromTenantKindV2(input.tenantKind),
  };
}

export const fromEServiceTemplateV2 = (
  input: EServiceTemplateV2
): EServiceTemplate => ({
  ...input,
  id: unsafeBrandId(input.id),
  creatorId: unsafeBrandId(input.creatorId),
  technology: fromEServiceTechnologyV2(input.technology),
  versions: input.versions.map(fromEServiceTemplateVersionV2),
  createdAt: bigIntToDate(input.createdAt),
  riskAnalysis: input.riskAnalysis.map(fromEServiceTemplateRiskAnalysisV2),
  mode: fromEServiceModeV2(input.mode),
});
