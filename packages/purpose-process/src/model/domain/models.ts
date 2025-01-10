import { DelegationId, EServiceMode } from "pagopa-interop-models";
import { z } from "zod";

export const ownership = {
  CONSUMER: "CONSUMER",
  PRODUCER: "PRODUCER",
  SELF_CONSUMER: "SELF_CONSUMER",
} as const;
export const Ownership = z.enum([
  Object.values(ownership)[0],
  ...Object.values(ownership).slice(1),
]);
export type Ownership = z.infer<typeof Ownership>;

export const PurposeDocumentEServiceInfo = z.object({
  name: z.string(),
  mode: EServiceMode,
  producerName: z.string(),
  producerIPACode: z.string().optional(),
  consumerName: z.string(),
  consumerIPACode: z.string().optional(),
  producerDelegationId: DelegationId.optional(),
  producerDelegateName: z.string().optional(),
  producerDelegateIpaCode: z.string().optional(),
});
export type PurposeDocumentEServiceInfo = z.infer<
  typeof PurposeDocumentEServiceInfo
>;

export type RiskAnalysisDocumentPDFPayload = {
  dailyCalls: string;
  answers: string;
  eServiceName: string;
  producerName: string;
  producerCode: string | undefined;
  consumerName: string;
  consumerCode: string | undefined;
  freeOfCharge: string;
  freeOfChargeReason: string;
  date: string;
  eServiceMode: string;
  producerDelegationId: DelegationId | undefined;
  producerDelegateName: string | undefined;
  producerDelegateIpaCode: string | undefined;
};
