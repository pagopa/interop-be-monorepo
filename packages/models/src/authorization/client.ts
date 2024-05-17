import { z } from "zod";
import {
  AgreementId,
  DescriptorId,
  EServiceId,
  PurposeId,
  PurposeVersionId,
  TenantId,
} from "../brandedIds.js";

export const clientKind = {
  consumer: "Consumer",
  api: "Api",
} as const;
export const ClientKind = z.enum([
  Object.values(clientKind)[0],
  ...Object.values(clientKind).slice(1),
]);
export type ClientKind = z.infer<typeof ClientKind>;

export const clientComponentState = {
  active: "Active",
  inactive: "Inactive",
} as const;
export const ClientComponentState = z.enum([
  Object.values(clientComponentState)[0],
  ...Object.values(clientComponentState).slice(1),
]);
export type ClientComponentState = z.infer<typeof ClientComponentState>;

export const ClientEserviceDetails = z.object({
  eserviceId: EServiceId,
  descriptorId: DescriptorId,
  state: ClientComponentState,
  audience: z.array(z.string()),
  voucherLifespan: z.number(),
});
export type ClientEserviceDetails = z.infer<typeof ClientEserviceDetails>;

export const ClientAgreementDetails = z.object({
  eserviceId: EServiceId,
  consumerId: TenantId,
  agreementId: AgreementId,
  state: ClientComponentState,
});
export type ClientAgreementDetails = z.infer<typeof ClientAgreementDetails>;

export const ClientPurposeDetails = z.object({
  purposeId: PurposeId,
  versionId: PurposeVersionId,
  state: ClientComponentState,
});
export type ClientPurposeDetails = z.infer<typeof ClientPurposeDetails>;

export const ClientStatesChain = z.object({
  id: z.string(),
  eservice: ClientEserviceDetails,
  agreement: ClientAgreementDetails,
  purpose: ClientPurposeDetails,
});
export type ClientStatesChain = z.infer<typeof ClientStatesChain>;

export const Client = z.object({
  id: z.string(),
  consumerId: TenantId,
  name: z.string(),
  purposes: z.array(ClientStatesChain),
  description: z.string().optional(),
  relationships: z.array(z.string()),
  kind: ClientKind,
  createdAt: z.coerce.date(),
});

export type Client = z.infer<typeof Client>;
