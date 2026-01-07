import {
  apiGatewayApi,
  attributeRegistryApi,
  catalogApi,
} from "pagopa-interop-api-clients";
import { Logger } from "pagopa-interop-commons";
import {
  assertIsValidDescriptor,
  assertRegistryAttributeExists,
} from "../services/validators.js";

export type ValidCatalogApiDescriptor = catalogApi.EServiceDescriptor & {
  state: Exclude<
    catalogApi.EServiceDescriptorState,
    "DRAFT" | "WAITING_FOR_APPROVAL"
  >;
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

function toApiGatewayEserviceAttributeValue(
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

function toApiGatewayEserviceAttributesValues(
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

function toApiGatewayDescriptorDocument(
  doc: catalogApi.EServiceDescriptor["docs"][number]
): apiGatewayApi.EServiceDescriptor["docs"][number] {
  return {
    id: doc.id,
    name: doc.name,
    contentType: doc.contentType,
  };
}

export function toApiGatewayDescriptorIfIsValid(
  descriptor: catalogApi.EServiceDescriptor,
  eserviceId: catalogApi.EService["id"],
  logger: Logger
): apiGatewayApi.EServiceDescriptor {
  assertIsValidDescriptor(descriptor, eserviceId, logger);

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
