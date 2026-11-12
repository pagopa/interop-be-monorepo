import {
  Attribute,
  AttributeKind,
  stringToDate,
  unsafeBrandId,
  WithMetadata,
} from "pagopa-interop-models";
import { AttributeSQL } from "pagopa-interop-readmodel-models";

export const aggregateAttributeArray = (
  attributes: AttributeSQL[]
): Array<WithMetadata<Attribute>> => attributes.map(aggregateAttribute);

export const aggregateAttribute = ({
  id,
  metadataVersion,
  name,
  kind,
  description,
  creationTime,
  origin,
  code,
  subunitPropagationEnabled,
  ...rest
}: AttributeSQL): WithMetadata<Attribute> => {
  void (rest satisfies Record<string, never>);

  return {
    data: {
      id: unsafeBrandId(id),
      name,
      kind: AttributeKind.parse(kind),
      description,
      creationTime: stringToDate(creationTime),
      ...(origin ? { origin } : {}),
      ...(code ? { code } : {}),
      ...(subunitPropagationEnabled !== null
        ? { subunitPropagationEnabled }
        : {}),
    },
    metadata: { version: metadataVersion },
  };
};
