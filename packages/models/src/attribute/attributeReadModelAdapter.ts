/*
  This code adapts Attribute to AttributeReadModel,
  for retro-compatibility with the read model in production:
  the Scala services read/write ISO strings for all date fields.

  After all services will be migrated to TS, we should remove these adapters
  and the corresponding models, as tracked in https://pagopa.atlassian.net/browse/IMN-367
*/

import { AttributeReadmodel } from "../read-models/attributeReadModel.js";
import { Attribute } from "./attribute.js";

export const toReadModelAttribute = (
  attribute: Attribute
): AttributeReadmodel => ({
  ...attribute,
  creationTime: attribute.creationTime.toISOString(),
});
