import {
  Attribute,
  AttributeId,
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
      ...(origin ? { origin } : {}),
      ...(code ? { code } : {}),
    },
    metadata: { version: metadataVersion },
  };
};
