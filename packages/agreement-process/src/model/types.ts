import { ZodiosBodyByPath } from "@zodios/core";
import { z } from "zod";
import { api, schemas } from "../generated/generated.js";

type Api = typeof api.api;
export type ApiAgreement = z.infer<typeof schemas.Agreement>;

export type ApiAgreementState = z.infer<typeof schemas.AgreementState>;

export type ApiAgreementDocument = z.infer<typeof schemas.Document>;
export type ApiAgreementDocumentSeed = z.infer<typeof schemas.DocumentSeed>;

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
