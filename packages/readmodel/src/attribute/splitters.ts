import { Attribute, dateToString } from "pagopa-interop-models";
import { AttributeSQL } from "pagopa-interop-readmodel-models";

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
  }: Attribute,
  metadataVersion: number
): AttributeSQL => {
  void (rest satisfies Record<string, never>);
  return {
    id,
    metadataVersion,
    name,
    kind,
    description,
    creationTime: dateToString(creationTime),
    origin: origin || null,
    code: code || null,
  };
};
