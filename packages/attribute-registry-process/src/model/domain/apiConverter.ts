import { AttributeKind, Attribute, attributeKind } from "pagopa-interop-models";
import { z } from "zod";
import { match } from "ts-pattern";
import * as api from "../generated/api.js";
import { ApiAttributeKind } from "./models.js";

export const attributeKindToApiAttributeKind = (
  input: AttributeKind
): ApiAttributeKind =>
  match<AttributeKind, ApiAttributeKind>(input)
    .with(attributeKind.certified, () => "CERTIFIED")
    .with(attributeKind.verified, () => "VERIFIED")
    .with(attributeKind.declared, () => "DECLARED")
    .exhaustive();

export const apiAttributeKindToAttributeKind = (
  input: ApiAttributeKind
): AttributeKind =>
  match<ApiAttributeKind, AttributeKind>(input)
    .with("CERTIFIED", () => attributeKind.certified)
    .with("VERIFIED", () => attributeKind.verified)
    .with("DECLARED", () => attributeKind.declared)
    .exhaustive();

export const attributeToApiAttribute = (
  attribute: Attribute
): z.infer<typeof api.schemas.Attribute> => ({
  id: attribute.id,
  name: attribute.name,
  kind: attributeKindToApiAttributeKind(attribute.kind),
  description: attribute.description,
  creationTime: attribute.creationTime.toJSON(),
  code: attribute.code,
  origin: attribute.origin,
});
