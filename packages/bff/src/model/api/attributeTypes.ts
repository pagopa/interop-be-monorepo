import { z } from "zod";
import { schemas } from "../generated/api.js";
import { schemas as attributeSchemas } from "../generated/attribute-process/api.js";

export type BffApiCompactAttribute = z.infer<typeof schemas.CompactAttribute>;
export type BffApiAttributeSeed = z.infer<typeof schemas.AttributeSeed>;
export type BffApiAttribute = z.infer<typeof schemas.Attribute>;

export type AttributeProcessApiAttribute = z.infer<
  typeof attributeSchemas.Attribute
>;
export type AttributeProcessApiAttributes = z.infer<
  typeof attributeSchemas.Attributes
>;
export type AttributeProcessApiAttributeKind = z.infer<
  typeof attributeSchemas.AttributeKind
>;
export type AttributeProcessApiAttributeSeed = z.infer<
  typeof attributeSchemas.CertifiedAttributeSeed
>;
