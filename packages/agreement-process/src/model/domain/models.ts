import { z } from "zod";
import * as api from "../generated/api.js";

export type ApiAgreement = z.infer<typeof api.schemas.Agreement>;

export type ApiAgreementState = z.infer<typeof api.schemas.AgreementState>;

export type ApiAgreementDocument = z.infer<typeof api.schemas.Document>;
