import {
  DelegationId,
  EServiceMode,
  RiskAnalysisId,
  TenantId,
  UserId,
} from "pagopa-interop-models";
import { z } from "zod";

export const PurposeDocumentEServiceInfo = z.object({
  name: z.string(),
  mode: EServiceMode,
  producerName: z.string(),
  producerIpaCode: z.string().optional(),
  consumerName: z.string(),
  consumerIpaCode: z.string().optional(),
  producerDelegationId: DelegationId.optional(),
  producerDelegateName: z.string().optional(),
  producerDelegateIpaCode: z.string().optional(),
  consumerDelegationId: DelegationId.optional(),
  consumerDelegateName: z.string().optional(),
  consumerDelegateIpaCode: z.string().optional(),
});
export type PurposeDocumentEServiceInfo = z.infer<
  typeof PurposeDocumentEServiceInfo
>;

export type RiskAnalysisDocumentPDFPayload = {
  dailyCalls: string;
  answers: string;
  eServiceName: string;
  producerName: string;
  producerIpaCode: string | undefined;
  consumerName: string;
  consumerIpaCode: string | undefined;
  freeOfCharge: string;
  freeOfChargeReason: string;
  date: string;
  eServiceMode: string;
  producerDelegationId: DelegationId | undefined;
  producerDelegateName: string | undefined;
  producerDelegateIpaCode: string | undefined;
  consumerDelegationId: DelegationId | undefined;
  consumerDelegateName: string | undefined;
  consumerDelegateIpaCode: string | undefined;
  userId: UserId | undefined;
  consumerId: TenantId;
};

export const RiskAnalysisDocument = z.object({
  id: RiskAnalysisId,
  name: z.string(),
  prettyName: z.string(),
  contentType: z.string(),
  path: z.string(),
  createdAt: z.coerce.date(),
});

export type RiskAnalysisDocument = z.infer<typeof RiskAnalysisDocument>;
