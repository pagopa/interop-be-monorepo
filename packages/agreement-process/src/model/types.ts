import { ZodiosBodyByPath } from "@zodios/core";
import { z } from "zod";
import { api, schemas } from "./generated/api.js";

type Api = typeof api.api;
export type ApiAgreement = z.infer<typeof schemas.Agreement>;

export type ApiAgreementState = z.infer<typeof schemas.AgreementState>;

export type ApiAgreementDocument = z.infer<typeof schemas.Document>;
export type ApiAgreementDocumentSeed = z.infer<typeof schemas.DocumentSeed>;
export type ApiTenantAttribute = z.infer<typeof schemas.TenantAttribute>;
export type ApiTenantVerifier = z.infer<typeof schemas.TenantVerifier>;
export type ApiTenantRevoker = z.infer<typeof schemas.TenantRevoker>;
export type ApiCompactTenant = z.infer<typeof schemas.CompactTenant>;
export type ApiAgreementPayload = ZodiosBodyByPath<Api, "post", "/agreements">;

export type ApiAgreementUpdatePayload = ZodiosBodyByPath<
  Api,
  "post",
  "/agreements/:agreementId/update"
>;
export type ApiAgreementSubmissionPayload = ZodiosBodyByPath<
  Api,
  "post",
  "/agreements/:agreementId/submit"
>;

export type ApiComputeAgreementsStatePayload = ZodiosBodyByPath<
  Api,
  "post",
  "/compute/agreementsState"
>;
