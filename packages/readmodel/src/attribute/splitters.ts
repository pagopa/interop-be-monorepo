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
}: Attribute): AttributeSQL => {
  void (rest satisfies Record<string, never>);
  return {
    id,
    name,
    kind,
    description,
    creation_time: creationTime,
    origin,
    code,
  };
};
