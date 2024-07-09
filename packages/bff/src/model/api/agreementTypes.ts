import { ZodiosQueryParamsByPath, ZodiosResponseByPath } from "@zodios/core";
import { z } from "zod";
import {
  api as agreement,
  schemas,
} from "../generated/agreement-process/api.js";

export type AgreementProcessClientApi = typeof agreement.api;
export type AgreementProcessApiResponse = ZodiosResponseByPath<
  AgreementProcessClientApi,
  "get",
  "/agreements"
>;

export type AgreementProcessApiQueryParam = ZodiosQueryParamsByPath<
  AgreementProcessClientApi,
  "get",
  "/agreements"
>;

export type AgreementProcessApiAgreement = z.infer<typeof schemas.Agreement>;
export type AgreementProcessApiState = z.infer<typeof schemas.AgreementState>;

export const agreementApiState: {
  [key: string]: AgreementProcessApiState;
} = {
  DRAFT: "DRAFT",
  ACTIVE: "ACTIVE",
  ARCHIVED: "ARCHIVED",
  PENDING: "PENDING",
  SUSPENDED: "SUSPENDED",
  MISSING_CERTIFIED_ATTRIBUTES: "MISSING_CERTIFIED_ATTRIBUTES",
  REJECTED: "REJECTED",
} as const;
