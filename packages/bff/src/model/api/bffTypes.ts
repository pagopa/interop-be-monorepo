import { z } from "zod";
import { schemas } from "../generated/api.js";

export type BffApiSelfcareInstitution = z.infer<
  typeof schemas.SelfcareInstitution
>;
export type BffApiSelfcareProduct = z.infer<typeof schemas.SelfcareProduct>;
export type BffApiSelfcareUser = z.infer<typeof schemas.User>;

export type BffApiCompactAttribute = z.infer<typeof schemas.CompactAttribute>;
export type BffApiAttributeSeed = z.infer<typeof schemas.AttributeSeed>;
export type BffApiAttribute = z.infer<typeof schemas.Attribute>;

export type BffApiPurposeAdditionDetailsSeed = z.infer<
  typeof schemas.PurposeAdditionDetailsSeed
>;
export type BffApiKeysSeed = z.infer<typeof schemas.KeysSeed>;
export type BffApiClient = z.infer<typeof schemas.Client>;
export type BffApiCompactOrganization = z.infer<
  typeof schemas.CompactOrganization
>;
export type BffApiClientPurpose = z.infer<typeof schemas.ClientPurpose>;
export type BffApiClientPurposeAdditionDetails = z.infer<
  typeof schemas.PurposeAdditionDetailsSeed
>;
export type BffApiClientKind = z.infer<typeof schemas.ClientKind>;
export type BffApiCompactClient = z.infer<typeof schemas.CompactClient>;
export type BffApiCompactUser = z.infer<typeof schemas.CompactUser>;
export type BffApiPublicKey = z.infer<typeof schemas.PublicKey>;

export type BffApiPrivacyNotice = z.infer<typeof schemas.PrivacyNotice>;
export type BffApiPrivacyNoticeSeed = z.infer<typeof schemas.PrivacyNoticeSeed>;
