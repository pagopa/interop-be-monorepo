import { Attribute, AttributeSQL, WithMetadata } from "pagopa-interop-models";

export const attributeSQLtoAttribute = ({
  id,
  metadata_version,
  name,
  kind,
  description,
  creation_time,
  origin,
  code,
  ...rest
}: AttributeSQL): WithMetadata<Attribute> => {
  void (rest satisfies Record<string, never>);
  return {
    data: {
      id,
      name,
      kind,
      description,
      creationTime: creation_time,
      origin,
      code,
    }, metadata: { version: metadata_version }
  };
};
