import { Attribute, AttributeSQL } from "pagopa-interop-models";

export const attributeSQLtoAttribute = ({
  id,
  name,
  kind,
  description,
  creation_time,
  origin,
  code,
  ...rest
}: AttributeSQL): Attribute => {
  void (rest satisfies Record<string, never>);
  return {
    id,
    name,
    kind,
    description,
    creationTime: creation_time,
    origin,
    code,
  };
};
