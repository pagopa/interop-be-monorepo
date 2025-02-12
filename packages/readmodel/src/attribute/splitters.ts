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
  metadataVersion: number
): AttributeSQL => {
  void (rest satisfies Record<string, never>);
  return {
    id,
    metadataVersion,
    name,
    kind,
    description,
    creationTime,
    origin: origin || null,
    code: code || null,
  };
};
