import { AttributeTmp } from "pagopa-interop-models";
import { z } from "zod";
import * as api from "../generated/api.js";

export const attributeToApiAttribute = (
  attribute: AttributeTmp
): z.infer<typeof api.schemas.Attribute> => ({
  id: attribute.id,
  name: attribute.name,
  kind: attribute.kind,
  description: attribute.description,
  creationTime: attribute.creationTime.toJSON(),
  code: attribute.code,
  origin: attribute.origin,
});
