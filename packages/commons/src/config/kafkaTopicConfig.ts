import { z } from "zod";

export const CatalogTopicConfig = z
  .object({
    CATALOG_TOPIC: z.string(),
  })
  .transform((c) => ({
    catalogTopic: c.CATALOG_TOPIC,
  }));
export type CatalogTopicConfig = z.infer<typeof CatalogTopicConfig>;
export const catalogTopicConfig: () => CatalogTopicConfig = () =>
  CatalogTopicConfig.parse(process.env);

export const AgreementTopicConfig = z
  .object({
    AGREEMENT_TOPIC: z.string(),
  })
  .transform((c) => ({
    agreementTopic: c.AGREEMENT_TOPIC,
  }));
export type AgreementTopicConfig = z.infer<typeof AgreementTopicConfig>;
export const agreementTopicConfig: () => AgreementTopicConfig = () =>
  AgreementTopicConfig.parse(process.env);

export const TenantTopicConfig = z
  .object({
    TENANT_TOPIC: z.string(),
  })
  .transform((c) => ({
    tenantTopic: c.TENANT_TOPIC,
  }));
export type TenantTopicConfig = z.infer<typeof TenantTopicConfig>;
export const tenantTopicConfig: () => TenantTopicConfig = () =>
  TenantTopicConfig.parse(process.env);

export const AttributeTopicConfig = z
  .object({
    ATTRIBUTE_TOPIC: z.string(),
  })
  .transform((c) => ({
    attributeTopic: c.ATTRIBUTE_TOPIC,
  }));
export type AttributeTopicConfig = z.infer<typeof AttributeTopicConfig>;
export const attributeTopicConfig: () => AttributeTopicConfig = () =>
  AttributeTopicConfig.parse(process.env);
