import { CreateEvent, eventRepository, initDB } from "pagopa-interop-commons";
import {
  AttributeNotFound,
  ExternalId,
  InvalidAttributeStructure,
  Tenant,
  TenantAttribute,
  TenantEvent,
  TenantKind,
  WithMetadata,
  attributeKind,
  tenantAttributeType,
  tenantDuplicate,
  tenantEventToBinaryData,
} from "pagopa-interop-models";
import { v4 as uuidv4 } from "uuid";
import { match } from "ts-pattern";
import { config } from "../utilities/config.js";
import {
  toCreateEventTenantAdded,
  toCreateEventTenantUpdated,
} from "../model/domain/toEvent.js";
import {
  ApiInternalTenantSeed,
  ApiM2MTenantSeed,
  ApiSelfcareTenantSeed,
} from "../model/types.js";
import { assertTenantExist } from "./validators.js";
import { readModelService } from "./readModelService.js";

const repository = eventRepository(
  initDB({
    username: config.eventStoreDbUsername,
    password: config.eventStoreDbPassword,
    host: config.eventStoreDbHost,
    port: config.eventStoreDbPort,
    database: config.eventStoreDbName,
    schema: config.eventStoreDbSchema,
    useSSL: config.eventStoreDbUseSSL,
  }),
  tenantEventToBinaryData
);

export const tenantService = {
  async createTenant(
    apiTenantSeed:
      | ApiSelfcareTenantSeed
      | ApiM2MTenantSeed
      | ApiInternalTenantSeed,
    attributesExternalIds: ExternalId[],
    kind: TenantKind
  ): Promise<string> {
    const attributes = await readModelService.getAttributesByExternalIds(
      attributesExternalIds
    );
    const tenantAttributes: TenantAttribute[] = attributes.map((attribute) =>
      match(attribute.data.kind)
        .with(attributeKind.certified, () => ({
          type: tenantAttributeType.CERTIFIED,
          id: attribute.data.id,
          assignmentTimestamp: new Date(),
        }))
        .with(attributeKind.verified, () => ({
          type: tenantAttributeType.VERIFIED,
          id: attribute.data.id,
          assignmentTimestamp: new Date(),
          verifiedBy: [],
          revokedBy: [],
        }))
        .with(attributeKind.declared, () => ({
          type: tenantAttributeType.DECLARED,
          id: attribute.data.id,
          assignmentTimestamp: new Date(),
        }))
        .exhaustive()
    );
    return repository.createEvent(
      createTenantLogic({
        tenant: await readModelService.getTenantByName(apiTenantSeed.name),
        apiTenantSeed,
        kind,
        tenantAttributes,
      })
    );
  },

  async updateTenantAttribute(
    tenantId: string,
    attributeId: string,
    newAttribute: TenantAttribute
  ): Promise<string> {
    if (!newAttribute || newAttribute.id !== attributeId) {
      throw InvalidAttributeStructure;
    }

    return await repository.createEvent(
      await updateTenantLogic({
        tenantId,
        attributeId,
        newAttribute,
      })
    );
  },
};

export async function updateTenantLogic({
  tenantId,
  attributeId,
  newAttribute,
}: {
  tenantId: string;
  attributeId: string;
  newAttribute: TenantAttribute;
}): Promise<CreateEvent<TenantEvent>> {
  const tenant = await readModelService.getTenantById(tenantId);
  assertTenantExist(tenantId, tenant);

  const attributeExists = tenant.data.attributes.some(
    (attribute) => attribute.id === attributeId
  );
  if (!attributeExists) {
    throw AttributeNotFound(attributeId);
  }

  const updatedAttributes = [
    newAttribute,
    ...tenant.data.attributes.filter((a) => a.id !== newAttribute.id),
  ];

  const newTenant: Tenant = {
    ...tenant.data,
    attributes: updatedAttributes,
    updatedAt: new Date(),
  };

  return toCreateEventTenantUpdated(
    tenantId,
    tenant.metadata.version,
    newTenant
  );
}

export function createTenantLogic({
  tenant,
  apiTenantSeed,
  kind,
  tenantAttributes,
}: {
  tenant: WithMetadata<Tenant> | undefined;
  apiTenantSeed:
    | ApiSelfcareTenantSeed
    | ApiM2MTenantSeed
    | ApiInternalTenantSeed;
  kind: TenantKind;
  tenantAttributes: TenantAttribute[];
}): CreateEvent<TenantEvent> {
  if (tenant) {
    throw tenantDuplicate(apiTenantSeed.name);
  }

  const newTenant: Tenant = {
    id: uuidv4(),
    name: apiTenantSeed.name,
    attributes: tenantAttributes,
    externalId: apiTenantSeed.externalId,
    features: [],
    mails: [],
    createdAt: new Date(),
    kind,
  };

  return toCreateEventTenantAdded(newTenant);
}
