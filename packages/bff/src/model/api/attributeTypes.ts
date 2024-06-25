import { z } from "zod";
import { schemas } from "../generated/attribute-process/api.js";

export type AttributeProcessApiAttribute = z.infer<typeof schemas.Attribute>;
export type AttributeProcessApiAttributes = z.infer<typeof schemas.Attributes>;
export type AttributeProcessApiAttributeKind = z.infer<
  typeof schemas.AttributeKind
>;
export type AttributeProcessApiAttributeSeed = z.infer<
  typeof schemas.CertifiedAttributeSeed
>;
