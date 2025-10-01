/*
  This model is required for retro-compatibility with the read model in production:
  the Scala services read/write ISO strings for all date fields.

  After all services will be migrated to TS, we should remove this model
  and the corresponding adapters, as tracked in https://pagopa.atlassian.net/browse/IMN-367
*/

import { z } from "zod";

import { Attribute } from "../attribute/attribute.js";

export const AttributeReadmodel = Attribute.extend({
  creationTime: z.string().datetime(),
});
export type AttributeReadmodel = z.infer<typeof AttributeReadmodel>;
