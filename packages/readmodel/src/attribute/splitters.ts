import { AttributeReadmodel } from "pagopa-interop-models";
import { AttributeSQL } from "../types.js";

export const splitAttributeIntoObjectsSQL = (
  {
    id,
    name,
    kind,
    description,
    creationTime,
    origin,
    code,
    ...rest
  }: AttributeReadmodel,
  version: number
): AttributeSQL => {
  void (rest satisfies Record<string, never>);
  return {
    id,
    metadataVersion: version,
    name,
    kind,
    description,
    creationTime: creationTime,
    origin: origin || null,
    code: code || null,
  };
};
