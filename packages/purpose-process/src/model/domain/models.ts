import { EServiceMode } from "pagopa-interop-models";
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
  producerOrigin: z.string(),
  producerIPACode: z.string(),
  consumerName: z.string(),
  consumerOrigin: z.string(),
  consumerIPACode: z.string(),
  producerDelegationId: z.string().optional(),
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
  producerText: string;
  consumerText: string;
  freeOfCharge: string;
  freeOfChargeReason: string;
  date: string;
  eServiceMode: string;
  producerDelegationId: string | undefined;
  producerDelegateName: string | undefined;
  producerDelegateIpaCode: string | undefined;
};
