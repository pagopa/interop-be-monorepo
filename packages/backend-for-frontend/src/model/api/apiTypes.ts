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

export const ConfigurationSingleAnswer = z.object({
  key: z.string(),
  value: z.string().nullable().optional(),
});
export type ConfigurationSingleAnswer = z.infer<
  typeof ConfigurationSingleAnswer
>;

export const ConfigurationMultiAnswer = z.object({
  key: z.string(),
  values: z.array(z.string()),
});
export type ConfigurationMultiAnswer = z.infer<typeof ConfigurationMultiAnswer>;

const ConfigurationRiskAnalysisForm = z.object({
  version: z.string(),
  singleAnswers: z.array(ConfigurationSingleAnswer),
  multiAnswers: z.array(ConfigurationMultiAnswer),
});

export const ConfigurationRiskAnalysis = z.object({
  name: z.string(),
  riskAnalysisForm: ConfigurationRiskAnalysisForm,
});

export type ConfigurationRiskAnalysis = z.infer<
  typeof ConfigurationRiskAnalysis
>;

export const ConfigurationDoc = z.object({
  prettyName: z.string(),
  path: z.string(),
});
export type ConfigurationDoc = z.infer<typeof ConfigurationDoc>;

export const ConfigurationDescriptor = z.object({
  interface: ConfigurationDoc.optional(),
  docs: z.array(ConfigurationDoc),
  audience: z.array(z.string()),
  voucherLifespan: z.number(),
  dailyCallsPerConsumer: z.number(),
  dailyCallsTotal: z.number(),
  description: z.string().optional(),
  agreementApprovalPolicy: bffApi.AgreementApprovalPolicy,
});

export const ConfigurationEservice = z.object({
  name: z.string(),
  description: z.string(),
  technology: bffApi.EServiceTechnology,
  mode: bffApi.EServiceMode,
  descriptor: ConfigurationDescriptor,
  riskAnalysis: z.array(ConfigurationRiskAnalysis),
});
export type ConfigurationEservice = z.infer<typeof ConfigurationEservice>;
