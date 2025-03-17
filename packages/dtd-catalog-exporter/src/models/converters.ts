import {
  type AttributeReadmodel,
  type EServiceReadModel,
  type TenantReadModel,
  type EserviceAttributes,
  genericError,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { getLatestActiveDescriptor } from "../utils/utils.js";
import { readModelServiceBuilder } from "../services/readModelService.js";
import {
  PublicEService,
  PublicEServiceAttribute,
  PublicEServiceAttributeGroup,
  PublicEServiceAttributes,
  PublicEServiceAttributeSingle,
  PublicTenant,
  PublicTenantAttribute,
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

  const { producerFiscalCode, producerIpaCode } = match(producer.externalId)
    .with({ origin: "IPA" }, ({ value }) => ({
      producerIpaCode: value,
      producerFiscalCode: null,
    }))
    .otherwise(({ value }) => ({
      producerIpaCode: null,
      producerFiscalCode: value,
    }));

  return {
    id: eservice.id,
    name: eservice.name,
    description: eservice.description,
    technology: eservice.technology.toUpperCase() as "REST" | "SOAP",
    producerId: producer.id,
    producerName: producer.name,
    producerFiscalCode,
    producerIpaCode,
    attributes: toPublicAttributes(activeDescriptor.attributes, attributesMap),
    activeDescriptor: {
      id: activeDescriptor.id,
      state: activeDescriptor.state.toUpperCase() as "PUBLISHED" | "SUSPENDED",
      version: activeDescriptor.version,
    },
  };
}

function toPublicAttribute(
  id: string,
  attributesMap: Map<string, AttributeReadmodel>
): PublicEServiceAttribute {
  const attributeData = attributesMap.get(id);

  if (!attributeData) {
    throw genericError(`Attribute with id ${id} not found`);
  }

  return {
    description: attributeData.description,
    name: attributeData.name,
  };
}

function toPublicAttributesGroup(
  attributesGroup: EserviceAttributes[keyof EserviceAttributes][0],
  attributesMap: Map<string, AttributeReadmodel>
): PublicEServiceAttributeGroup | PublicEServiceAttributeSingle {
  if (attributesGroup.length === 1) {
    return {
      single: toPublicAttribute(attributesGroup[0].id, attributesMap),
    };
  }

  return {
    group: attributesGroup.map(({ id }) =>
      toPublicAttribute(id, attributesMap)
    ),
  };
}

function toPublicAttributes(
  attributes: EserviceAttributes,
  attributesMap: Map<string, AttributeReadmodel>
): PublicEServiceAttributes {
  const { certified, verified, declared } = attributes;

  return {
    certified: certified.map((att) =>
      toPublicAttributesGroup(att, attributesMap)
    ),
    verified: verified.map((att) =>
      toPublicAttributesGroup(att, attributesMap)
    ),
    declared: declared.map((att) =>
      toPublicAttributesGroup(att, attributesMap)
    ),
  };
}

function toPublicTenantAttribute(
  attribute: AttributeReadmodel
): PublicTenantAttribute {
  return {
    name: attribute.name,
    type: attribute.kind,
  };
}

export async function toPublicTenant(
  tenant: TenantReadModel,
  readModelService: ReturnType<typeof readModelServiceBuilder>
): Promise<PublicTenant> {
  const attributesIds = tenant.attributes.map((attr) => attr.id);
  const tenantAttributes = await readModelService.getAttributes(attributesIds);

  const { fiscalCode, ipaCode } = match(tenant.externalId)
    .with({ origin: "IPA" }, ({ value }) => ({
      ipaCode: value,
      fiscalCode: null,
    }))
    .otherwise(({ value }) => ({
      ipaCode: null,
      fiscalCode: value,
    }));

  return {
    id: tenant.id,
    name: tenant.name,
    fiscalCode,
    ipaCode,
    attributes: tenantAttributes.map(toPublicTenantAttribute),
  };
}
