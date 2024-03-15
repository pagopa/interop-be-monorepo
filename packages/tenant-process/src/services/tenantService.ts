import {
  AuthData,
  eventRepository,
  initDB,
  logger,
} from "pagopa-interop-commons";
import {
  AttributeId,
  ExternalId,
  ListResult,
  Tenant,
  TenantAttribute,
  TenantId,
  WithMetadata,
  generateId,
  tenantEventToBinaryData,
} from "pagopa-interop-models";
import { TenantProcessConfig } from "../utilities/config.js";
import {
  toCreateEventTenantAdded,
  toCreateEventTenantUpdated,
} from "../model/domain/toEvent.js";
import { UpdateVerifiedTenantAttributeSeed } from "../model/domain/models.js";
import { ApiSelfcareTenantSeed } from "../model/types.js";
import { tenantNotFound } from "../model/domain/errors.js";
import {
  assertOrganizationIsInAttributeVerifiers,
  assertValidExpirationDate,
  assertVerifiedAttributeExistsInTenant,
  assertResourceAllowed,
  evaluateNewSelfcareId,
  getTenantKind,
  getTenantKindLoadingCertifiedAttributes,
  assertOrganizationVerifierExist,
  assertExpirationDateExist,
} from "./validators.js";
import { ReadModelService } from "./readModelService.js";

const retrieveTenant = async (
  tenantId: TenantId,
  readModelService: ReadModelService
): Promise<WithMetadata<Tenant>> => {
  const tenant = await readModelService.getTenantById(tenantId);
  if (tenant === undefined) {
    throw tenantNotFound(tenantId);
  }
  return tenant;
};

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
      tenantId: TenantId,
      attributeId: AttributeId,
      verifierId: string
    ): Promise<Tenant> {
      logger.info(
        `Update extension date of attribute ${attributeId} for tenant ${tenantId}`
      );
      const tenant = await retrieveTenant(tenantId, readModelService);

      const attribute = tenant?.data.attributes.find(
        (att) => att.id === attributeId
      );

      assertVerifiedAttributeExistsInTenant(attributeId, attribute, tenant);

      const oldVerifier = attribute.verifiedBy.find(
        (verifier) => verifier.id === verifierId
      );

      assertOrganizationVerifierExist(
        verifierId,
        tenantId,
        attributeId,
        oldVerifier
      );

      assertExpirationDateExist(
        tenantId,
        attributeId,
        verifierId,
        oldVerifier.expirationDate
      );

      const oldExtensionDate =
        oldVerifier.extensionDate ?? oldVerifier.expirationDate;

      const extensionDate = new Date(
        oldExtensionDate.getTime() +
          (oldVerifier.expirationDate.getTime() -
            oldVerifier.verificationDate.getTime())
      );

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

      const event = toCreateEventTenantUpdated(
        tenant.data.id,
        tenant.metadata.version,
        updatedTenant
      );
      await repository.createEvent(event);
      return updatedTenant;
    },

    async updateTenantVerifiedAttribute({
      verifierId,
      tenantId,
      attributeId,
      updateVerifiedTenantAttributeSeed,
    }: {
      verifierId: string;
      tenantId: TenantId;
      attributeId: AttributeId;
      updateVerifiedTenantAttributeSeed: UpdateVerifiedTenantAttributeSeed;
    }): Promise<Tenant> {
      logger.info(`Update attribute ${attributeId} to tenant ${tenantId}`);
      const tenant = await retrieveTenant(tenantId, readModelService);

      const expirationDate = updateVerifiedTenantAttributeSeed.expirationDate
        ? new Date(updateVerifiedTenantAttributeSeed.expirationDate)
        : undefined;

      assertValidExpirationDate(expirationDate);

      const attribute = tenant?.data.attributes.find(
        (att) => att.id === attributeId
      );

      assertVerifiedAttributeExistsInTenant(attributeId, attribute, tenant);
      assertOrganizationIsInAttributeVerifiers(verifierId, tenantId, attribute);

      const updatedAttribute: TenantAttribute = {
        ...attribute,
        verifiedBy: attribute.verifiedBy.map((v) =>
          v.id === verifierId
            ? {
                ...v,
                expirationDate,
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
      const event = toCreateEventTenantUpdated(
        tenant.data.id,
        tenant.metadata.version,
        updatedTenant
      );
      await repository.createEvent(event);
      return updatedTenant;
    },

    async selfcareUpsertTenant({
      tenantSeed,
      authData,
    }: {
      tenantSeed: ApiSelfcareTenantSeed;
      authData: AuthData;
    }): Promise<string> {
      const existingTenant = await readModelService.getTenantByExternalId(
        tenantSeed.externalId
      );
      if (existingTenant) {
        logger.info(
          `Updating tenant with external id ${tenantSeed.externalId} via SelfCare request"`
        );
        await assertResourceAllowed(existingTenant.data.id, authData);

        evaluateNewSelfcareId({
          tenant: existingTenant.data,
          newSelfcareId: tenantSeed.selfcareId,
        });

        const tenantKind = await getTenantKindLoadingCertifiedAttributes(
          readModelService,
          existingTenant.data.attributes,
          existingTenant.data.externalId
        );

        const updatedTenant: Tenant = {
          ...existingTenant.data,
          kind: tenantKind,
          selfcareId: tenantSeed.selfcareId,
          updatedAt: new Date(),
        };
        return await repository.createEvent(
          toCreateEventTenantUpdated(
            existingTenant.data.id,
            existingTenant.metadata.version,
            updatedTenant
          )
        );
      } else {
        logger.info(
          `Creating tenant with external id ${tenantSeed.externalId} via SelfCare request"`
        );
        const newTenant: Tenant = {
          id: generateId(),
          name: tenantSeed.name,
          attributes: [],
          externalId: tenantSeed.externalId,
          features: [],
          mails: [],
          selfcareId: tenantSeed.selfcareId,
          kind: getTenantKind([], tenantSeed.externalId),
          createdAt: new Date(),
        };
        return await repository.createEvent(
          toCreateEventTenantAdded(newTenant)
        );
      }
    },
    async getProducers({
      name,
      offset,
      limit,
    }: {
      name: string | undefined;
      offset: number;
      limit: number;
    }): Promise<ListResult<Tenant>> {
      logger.info(
        `Retrieving Producers with name = ${name}, limit = ${limit}, offset = ${offset}`
      );
      return readModelService.getProducers({ name, offset, limit });
    },
    async getConsumers({
      name,
      producerId,
      offset,
      limit,
    }: {
      name: string | undefined;
      producerId: TenantId;
      offset: number;
      limit: number;
    }): Promise<ListResult<Tenant>> {
      logger.info(
        `Retrieving Consumers with name = ${name}, limit = ${limit}, offset = ${offset}`
      );
      return readModelService.getConsumers({ name, producerId, offset, limit });
    },
    async getTenantsByName({
      name,
      offset,
      limit,
    }: {
      name: string | undefined;
      offset: number;
      limit: number;
    }): Promise<ListResult<Tenant>> {
      logger.info(
        `Retrieving Tenants with name = ${name}, limit = ${limit}, offset = ${offset}`
      );
      return readModelService.getTenantsByName({ name, offset, limit });
    },
    async getTenantById(
      id: TenantId
    ): Promise<WithMetadata<Tenant> | undefined> {
      logger.info(`Retrieving tenant ${id}`);
      return readModelService.getTenantById(id);
    },
    async getTenantByExternalId(
      externalId: ExternalId
    ): Promise<WithMetadata<Tenant> | undefined> {
      logger.info(
        `Retrieving tenant with origin ${externalId.origin} and code ${externalId.value}`
      );
      return readModelService.getTenantByExternalId(externalId);
    },
    async getTenantBySelfcareId(
      selfcareId: string
    ): Promise<WithMetadata<Tenant> | undefined> {
      logger.info(`Retrieving Tenant with Selfcare Id ${selfcareId}`);
      return readModelService.getTenantBySelfcareId(selfcareId);
    },
  };
}
export type TenantService = ReturnType<typeof tenantServiceBuilder>;
