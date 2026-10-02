import { agreementApi, bffApi, catalogApi } from "pagopa-interop-api-clients";
import { z } from "zod";

const PrivacyNoticeVersion = z.object({
  versionId: z.string(),
  name: z.string(),
  publishedDate: z.string(),
  status: z.string(),
  version: z.number(),
});
type PrivacyNoticeVersion = z.infer<typeof PrivacyNoticeVersion>;

export const PrivacyNotice = z.object({
  privacyNoticeId: z.string(),
  createdDate: z.string(),
  lastPublishedDate: z.string(),
  organizationId: z.string(),
  responsibleUserId: z.string().optional(),
  privacyNoticeVersion: PrivacyNoticeVersion,
  persistedAt: z.string(),
});
export type PrivacyNotice = z.infer<typeof PrivacyNotice>;

export const UserPrivacyNoticeConsentTypePP = z.object({
  PP: z.literal("PP"),
});
export type UserPrivacyNoticeConsentTypePP = z.infer<
  typeof UserPrivacyNoticeConsentTypePP
>;

export const UserPrivacyNoticeConsentTypeTOS = z.object({
  TOS: z.literal("TOS"),
});
export type UserPrivacyNoticeConsentTypeTOS = z.infer<
  typeof UserPrivacyNoticeConsentTypeTOS
>;

export const UserPrivacyNoticeConsentType = UserPrivacyNoticeConsentTypePP.or(
  UserPrivacyNoticeConsentTypeTOS
);
export type UserPrivacyNoticeConsentType = z.infer<
  typeof UserPrivacyNoticeConsentType
>;

const UserPrivacyNoticeVersion = z.object({
  versionId: z.string(),
  kind: UserPrivacyNoticeConsentType,
  version: z.number(),
});
type UserPrivacyNoticeVersion = z.infer<typeof UserPrivacyNoticeVersion>;

export const UserPrivacyNotice = z.object({
  pnIdWithUserId: z.string(),
  versionNumber: z.number(),
  privacyNoticeId: z.string(),
  userId: z.string(),
  acceptedAt: z.string(),
  version: UserPrivacyNoticeVersion,
});
export type UserPrivacyNotice = z.infer<typeof UserPrivacyNotice>;

export const catalogApiDescriptorState =
  catalogApi.EServiceDescriptorState.Values;

export const agreementApiState = agreementApi.AgreementState.Values;

const ConfigurationSingleAnswer = z.object({
  key: z.string(),
  value: z.string().nullable().optional(),
});
type ConfigurationSingleAnswer = z.infer<typeof ConfigurationSingleAnswer>;

const ConfigurationMultiAnswer = z.object({
  key: z.string(),
  values: z.array(z.string()),
});
type ConfigurationMultiAnswer = z.infer<typeof ConfigurationMultiAnswer>;

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

const ConfigurationDoc = z.object({
  prettyName: z.string(),
  path: z.string(),
});
type ConfigurationDoc = z.infer<typeof ConfigurationDoc>;

const ConfigurationDescriptor = z.object({
  interface: ConfigurationDoc.optional(),
  asyncExchangeCallbackInterface: ConfigurationDoc.optional(),
  asyncExchangeProperties: bffApi.AsyncExchangeProperties.optional(),
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
  asyncExchange: z.boolean().optional(),
  descriptor: ConfigurationDescriptor,
  riskAnalysis: z.array(ConfigurationRiskAnalysis),
  isSignalHubEnabled: z.boolean().optional(),
  isConsumerDelegable: z.boolean().optional(),
  isClientAccessDelegable: z.boolean().optional(),
});
export type ConfigurationEservice = z.infer<typeof ConfigurationEservice>;
