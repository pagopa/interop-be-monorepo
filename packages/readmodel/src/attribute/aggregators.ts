import {
  Attribute,
  AttributeId,
  AttributeKind,
  stringToDate,
  unsafeBrandId,
  WithMetadata,
} from "pagopa-interop-models";
import { AttributeSQL } from "../types.js";

export const attributeSQLtoAttribute = ({
  id,
  metadataVersion,
  name,
  kind,
  description,
  creationTime,
  origin,
  code,
  ...rest
}: AttributeSQL): WithMetadata<Attribute> => {
  void (rest satisfies Record<string, never>);
  return {
    data: {
      id: unsafeBrandId<AttributeId>(id),
      name,
      kind: AttributeKind.parse(kind),
      description,
      creationTime: stringToDate(creationTime),
      origin: origin || undefined,
      code: code || undefined,
    },
    metadata: { version: metadataVersion },
  };
};
