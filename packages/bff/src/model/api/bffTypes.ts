import { z } from "zod";
import { schemas } from "../generated/api.js";

export type ApiSelfcareInstitution = z.infer<
  typeof schemas.SelfcareInstitution
>;
export type BffApiSelfcareProduct = z.infer<typeof schemas.SelfcareProduct>;
export type BffApiSelfcareUser = z.infer<typeof schemas.User>;
