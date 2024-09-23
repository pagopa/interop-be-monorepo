import {
  apiGatewayApi,
  attributeRegistryApi,
  catalogApi,
} from "pagopa-interop-api-clients";
import {
  assertNonDraftDescriptor,
  assertRegistryAttributeExists,
} from "../services/validators.js";

export type NonDraftCatalogApiDescriptor = catalogApi.EServiceDescriptor & {
  state: Exclude<catalogApi.EServiceDescriptorState, "DRAFT">;
};

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

export function toApiGatewayDescriptorDocument(
  doc: catalogApi.EServiceDescriptor["docs"][number]
): apiGatewayApi.EServiceDescriptor["docs"][number] {
  return {
    id: doc.id,
    name: doc.name,
    contentType: doc.contentType,
  };
}

export function toApiGatewayDescriptorIfNotDraft(
  descriptor: catalogApi.EServiceDescriptor
): apiGatewayApi.EServiceDescriptor {
  assertNonDraftDescriptor(descriptor, descriptor.id);

  return {
    id: descriptor.id,
    version: descriptor.version,
    description: descriptor.description,
    audience: descriptor.audience,
    voucherLifespan: descriptor.voucherLifespan,
    dailyCallsPerConsumer: descriptor.dailyCallsPerConsumer,
    dailyCallsTotal: descriptor.dailyCallsTotal,
    interface: descriptor.interface
      ? toApiGatewayDescriptorDocument(descriptor.interface)
      : undefined,
    docs: descriptor.docs.map(toApiGatewayDescriptorDocument),
    state: descriptor.state,
    serverUrls: descriptor.serverUrls,
  };
}
