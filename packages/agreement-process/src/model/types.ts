import { ZodiosBodyByPath } from "@zodios/core";
import { z } from "zod";
import { api, schemas } from "./generated/api.js";

type Api = typeof api.api;
export type ApiAgreement = z.infer<typeof schemas.Agreement>;

export type ApiAgreementState = z.infer<typeof schemas.AgreementState>;

export type ApiAgreementDocument = z.infer<typeof schemas.Document>;

export type ApiAgreementPayload = ZodiosBodyByPath<Api, "post", "/agreements">;
