import {
  apiGatewayApi,
  attributeRegistryApi,
  catalogApi,
} from "pagopa-interop-api-clients";
import { assertRegistryAttributeExists } from "../services/validators.js";

export function toApiGatewayCatalogEservice(
  eservice: catalogApi.EService
): apiGatewayApi.CatalogEService {
  return {
    id: eservice.id,
    name: eservice.name,
    description: eservice.description,
  };
}

export function toApiGatewayEserviceAttributeValue(
  eserviceDescriptorAttribute: catalogApi.Attribute,
  registryAttributes: attributeRegistryApi.Attribute[]
): apiGatewayApi.EServiceAttributeValue {
  const registryAttribute = registryAttributes.find(
    (a) => a.id === eserviceDescriptorAttribute.id
  );

  assertRegistryAttributeExists(
    registryAttribute,
    eserviceDescriptorAttribute.id
  );

  return {
    id: registryAttribute.id,
    code: registryAttribute.code,
    origin: registryAttribute.origin,
    explicitAttributeVerification:
      eserviceDescriptorAttribute.explicitAttributeVerification,
  };
}

export function toApiGatewayEserviceAttributesValues(
  attributes: catalogApi.Attribute[][],
  registryAttributes: attributeRegistryApi.Attribute[]
): apiGatewayApi.EServiceAttribute[] {
  const attributeGroups = attributes.map((atts) =>
    atts.map((att) =>
      toApiGatewayEserviceAttributeValue(att, registryAttributes)
    )
  );

  return attributeGroups
    .filter((group) => group.length > 0)
    .map((group) =>
      group.length === 1
        ? { single: group[0], group: undefined }
        : { single: undefined, group }
    );
}

export function toApiGatewayEserviceAttributes(
  eserviceDescriptorAttributes: catalogApi.EServiceDescriptor["attributes"],
  registryAttributes: attributeRegistryApi.Attribute[]
): apiGatewayApi.EServiceAttributes {
  return {
    certified: toApiGatewayEserviceAttributesValues(
      eserviceDescriptorAttributes.certified,
      registryAttributes
    ),
    declared: toApiGatewayEserviceAttributesValues(
      eserviceDescriptorAttributes.declared,
      registryAttributes
    ),
    verified: toApiGatewayEserviceAttributesValues(
      eserviceDescriptorAttributes.verified,
      registryAttributes
    ),
  };
}
