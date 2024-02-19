/*
  NOTE: Temporary file to hold all the models imported from github packages
  This file will be removed once all models are converted from scala.
 */
import { z } from "zod";
import * as api from "../generated/api.js";

export type ApiCertifier = z.infer<typeof api.schemas.Certifier>;

export type ApiMail = z.infer<typeof api.schemas.Mail>;

export type ApiMailKind = z.infer<typeof api.schemas.MailKind>;

export type ApiTenantVerifier = z.infer<typeof api.schemas.TenantVerifier>;

export type ApiTenantRevoker = z.infer<typeof api.schemas.TenantRevoker>;

export type ApiTenantAttribute = z.infer<typeof api.schemas.TenantAttribute>;

export type ApiTenantKind = z.infer<typeof api.schemas.TenantKind>;

export type ApiTenant = z.infer<typeof api.schemas.Tenant>;

export type ApiExternalId = z.infer<typeof api.schemas.ExternalId>;

export type ApiTenantFeature = z.infer<typeof api.schemas.TenantFeature>;

export const ApiCertifiedAttribute = api.schemas.CertifiedAttribute;
export type ApiCertifiedAttribute = z.infer<typeof ApiCertifiedAttribute>;

export type UpdateVerifiedTenantAttributeSeed = z.infer<
  typeof api.schemas.UpdateVerifiedTenantAttributeSeed
>;
