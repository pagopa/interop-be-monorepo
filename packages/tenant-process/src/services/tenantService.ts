/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { CreateEvent, eventRepository, initDB } from "pagopa-interop-commons";
import {
  Tenant,
  TenantAttribute,
  TenantEvent,
  WithMetadata,
  tenantEventToBinaryData,
} from "pagopa-interop-models";
import { TenantProcessConfig } from "../utilities/config.js";
import { toCreateEventTenantUpdated } from "../model/domain/toEvent.js";
import {
  assertExpirationDateExist,
  assertOrganizationVerifierExist,
  assertTenantExists,
  assertVerifiedAttributeExistsInTenant,
} from "./validators.js";
import { ReadModelService } from "./readModelService.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function tenantServiceBuilder(
  config: TenantProcessConfig,
  readModelService: ReadModelService
) {
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
  return {
    async updateVerifiedAttributeExtensionDate(
      tenantId: string,
      attributeId: string,
      verifierId: string
    ): Promise<string> {
      const tenant = await readModelService.getTenantById(tenantId);

      return await repository.createEvent(
        await updateVerifiedAttributeExtensionDateLogic({
          tenantId,
          attributeId,
          verifierId,
          tenant,
        })
      );
    },
  };
}

export async function updateVerifiedAttributeExtensionDateLogic({
  tenantId,
  attributeId,
  verifierId,
  tenant,
}: {
  tenantId: string;
  attributeId: string;
  verifierId: string;
  tenant: WithMetadata<Tenant> | undefined;
}): Promise<CreateEvent<TenantEvent>> {
  assertTenantExists(tenantId, tenant);

  const attribute = tenant?.data.attributes.find(
    (att) => att.id === attributeId
  );

  assertVerifiedAttributeExistsInTenant(tenantId, attribute, tenant);

  const tenantVerifier = attribute.verifiedBy.find(
    (verifier) => verifier.id === verifierId
  );

  assertOrganizationVerifierExist(
    verifierId,
    tenantId,
    attributeId,
    tenantVerifier
  );

  assertExpirationDateExist(tenantId, attributeId, verifierId, tenantVerifier);

  const extensionDate =
    tenantVerifier.extensionDate ?? tenantVerifier.expirationDate;

  const updatedAttribute: TenantAttribute = {
    ...attribute,
    verifiedBy: attribute.verifiedBy.map((v) =>
      v.id === verifierId
        ? {
            ...v,
            extensionDate,
          }
        : v
    ),
  };

  const updatedTenant: Tenant = {
    ...tenant.data,
    attributes: [
      updatedAttribute,
      ...tenant.data.attributes.filter((a) => a.id !== updatedAttribute.id),
    ],
    updatedAt: new Date(),
  };

  return toCreateEventTenantUpdated(
    tenant.data.id,
    tenant.metadata.version,
    updatedTenant
  );
}
