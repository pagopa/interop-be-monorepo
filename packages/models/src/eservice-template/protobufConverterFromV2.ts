import { unsafeBrandId } from "../brandedIds.js";
import {
  fromAgreementApprovalPolicyV2,
  fromDocumentV2,
  fromEServiceAttributeV2,
  fromEServiceModeV2,
  fromEServiceTechnologyV2,
  fromRiskAnalysisV2,
} from "../eservice/protobufConverterFromV2.js";
import {
  EServiceTemplateV2,
  EServiceTemplateVersionStateV2,
  EServiceTemplateVersionV2,
} from "../gen/v2/eservice-template/eservice-template.js";
import { bigIntToDate } from "../utils.js";
import {
  EServiceTemplate,
  EServiceTemplateVersion,
  EServiceTemplateVersionState,
  eserviceTemplateVersionState,
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

export const fromEServiceTemplateV2 = (
  input: EServiceTemplateV2
): EServiceTemplate => ({
  ...input,
  id: unsafeBrandId(input.id),
  creatorId: unsafeBrandId(input.creatorId),
  technology: fromEServiceTechnologyV2(input.technology),
  versions: input.versions.map(fromEServiceTemplateVersionV2),
  createdAt: bigIntToDate(input.createdAt),
  riskAnalysis: input.riskAnalysis.map(fromRiskAnalysisV2),
  mode: fromEServiceModeV2(input.mode),
});
