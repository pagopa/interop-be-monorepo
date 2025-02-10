import { Attribute, AttributeSQL } from "pagopa-interop-models";

export const splitAttributeIntoObjectsSQL = ({
  id,
  name,
  kind,
  description,
  creationTime,
  origin,
  code,
  ...rest
}: Attribute, version: number): AttributeSQL => {
  void (rest satisfies Record<string, never>);
  return {
    id,
    metadata_version: version,
    name,
    kind,
    description,
    creation_time: creationTime,
    origin,
    code,
  };
};
