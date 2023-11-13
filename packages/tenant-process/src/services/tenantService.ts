import { CreateEvent, eventRepository, initDB } from "pagopa-interop-commons";
import {
  AttributeNotFound,
  InvalidAttributeStructure,
  Tenant,
  TenantAttribute,
  TenantEvent,
  WithMetadata,
  tenantEventToBinaryData,
} from "pagopa-interop-models";
import { config } from "../utilities/config.js";
import { toCreateEventTenantUpdated } from "../model/domain/toEvent.js";
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
  async updateTenantAttribute(
    tenantId: string,
    attributeId: string,
    tenantAttribute: TenantAttribute
  ): Promise<string> {
    if (!tenantAttribute || tenantAttribute.id !== attributeId) {
      throw InvalidAttributeStructure;
    }

    const tenant = await readModelService.getTenantById(tenantId);

    return await repository.createEvent(
      await updateTenantLogic({
        tenant,
        tenantId,
        attributeId,
      })
    );
  },
};

export async function updateTenantLogic({
  tenant,
  tenantId,
  attributeId,
}: {
  tenant: WithMetadata<Tenant> | undefined;
  tenantId: string;
  attributeId: string;
}): Promise<CreateEvent<TenantEvent>> {
  assertTenantExist(tenantId, tenant);

  const attribute = await readModelService.getAttributeById(attributeId);
  if (!attribute) {
    throw AttributeNotFound(attributeId);
  }

  const updatedAttributes: TenantAttribute[] = [
    attribute.data,
    ...tenant.data.attributes.filter((a) => a.id !== attribute.data.id),
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
