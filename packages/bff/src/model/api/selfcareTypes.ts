import { z } from "zod";
import { schemas } from "../generated/api.js";

export type ApiSelfcareInstitution = z.infer<
  typeof schemas.SelfcareInstitution
>;
export type ApiSelfcareProduct = z.infer<typeof schemas.SelfcareProduct>;
export type ApiSelfcareUser = z.infer<typeof schemas.User>;
