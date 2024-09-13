import { agreementApi, bffApi, catalogApi } from "pagopa-interop-api-clients";
import { z } from "zod";

export const catalogApiDescriptorState =
  catalogApi.EServiceDescriptorState.Values;

export const agreementApiState = agreementApi.AgreementState.Values;

export const EserviceConsumer = z.object({
  descriptorVersion: z.number(),
  descriptorState: catalogApi.EServiceDescriptorState,
  agreementState: agreementApi.AgreementState,
  consumerName: z.string(),
  consumerExternalId: z.string(),
});

export const ImportedSingleAnswer = z.object({
  key: z.string(),
  value: z.string().nullable().optional(),
});
export type ImportedSingleAnswer = z.infer<typeof ImportedSingleAnswer>;

export const ImportedMultiAnswer = z.object({
  key: z.string(),
  values: z.array(z.string()),
});
export type ImportedMultiAnswer = z.infer<typeof ImportedMultiAnswer>;

const ImportedRiskAnalysisForm = z.object({
  version: z.string(),
  singleAnswers: z.array(ImportedSingleAnswer),
  multiAnswers: z.array(ImportedMultiAnswer),
});

export const ImportedRiskAnalysis = z.object({
  name: z.string(),
  riskAnalysisForm: ImportedRiskAnalysisForm,
});

export type ImportedRiskAnalysis = z.infer<typeof ImportedRiskAnalysis>;

export const ImportedDoc = z.object({
  prettyName: z.string(),
  path: z.string(),
});
export type ImportedDoc = z.infer<typeof ImportedDoc>;

export const ImportedDescriptor = z.object({
  interface: ImportedDoc.optional(),
  docs: z.array(ImportedDoc),
  audience: z.array(z.string()),
  voucherLifespan: z.number(),
  dailyCallsPerConsumer: z.number(),
  dailyCallsTotal: z.number(),
  description: z.string().optional(),
  agreementApprovalPolicy: bffApi.AgreementApprovalPolicy,
});

export const ImportedEservice = z.object({
  name: z.string(),
  description: z.string(),
  technology: bffApi.EServiceTechnology,
  mode: bffApi.EServiceMode,
  descriptor: ImportedDescriptor,
  riskAnalysis: z.array(ImportedRiskAnalysis),
});
export type ImportedEservice = z.infer<typeof ImportedEservice>;
