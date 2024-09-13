import {
  type AttributeReadmodel,
  type EServiceReadModel,
  type TenantReadModel,
  type EserviceAttributes,
  genericError,
} from "pagopa-interop-models";
import { getLatestActiveDescriptor } from "../utils/utils.js";
import {
  PublicEService,
  PublicEServiceAttribute,
  PublicEServiceAttributes,
} from "./models.js";

export function toPublicEService(
  eservice: EServiceReadModel,
  attributesMap: Map<string, AttributeReadmodel>,
  producersMap: Map<string, TenantReadModel>
): PublicEService {
  const activeDescriptor = getLatestActiveDescriptor(eservice);

  const producer = producersMap.get(eservice.producerId);

  if (!producer) {
    throw genericError(`Producer for e-service ${eservice.id} not found`);
  }

  return {
    id: eservice.id,
    name: eservice.name,
    description: eservice.description,
    technology: eservice.technology.toUpperCase() as "REST" | "SOAP",
    producerName: producer.name,
    attributes: toPublicAttributes(activeDescriptor.attributes, attributesMap),
    activeDescriptor: {
      id: activeDescriptor.id,
      state: activeDescriptor.state.toUpperCase() as "PUBLISHED" | "SUSPENDED",
      version: activeDescriptor.version,
    },
  };
}

function toPublicAttributes(
  attributes: EserviceAttributes,
  attributesMap: Map<string, AttributeReadmodel>
): PublicEServiceAttributes {
  function toPublicAttribute(
    attributesGroup: EserviceAttributes[keyof EserviceAttributes][0]
  ): PublicEServiceAttributes["certified"][number] {
    function toPublicEServiceAttribute(id: string): PublicEServiceAttribute {
      const attributeData = attributesMap.get(id);

      if (!attributeData) {
        throw genericError(`Attribute with id ${id} not found`);
      }

      return {
        description: attributeData.description,
        name: attributeData.name,
      };
    }

    if (attributesGroup.length === 1) {
      return {
        single: toPublicEServiceAttribute(attributesGroup[0].id),
      };
    }

    return {
      group: attributesGroup.map(({ id }) => toPublicEServiceAttribute(id)),
    };
  }

  const { certified, verified, declared } = attributes;

  return {
    certified: certified.map(toPublicAttribute),
    verified: verified.map(toPublicAttribute),
    declared: declared.map(toPublicAttribute),
  };
}
