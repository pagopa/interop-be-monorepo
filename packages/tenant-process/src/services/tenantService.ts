import { AuthData, DB, eventRepository, logger } from "pagopa-interop-commons";
import {
  AttributeId,
  CertifiedTenantAttribute,
  ListResult,
  Tenant,
  TenantAttribute,
  TenantId,
  WithMetadata,
  generateId,
  tenantAttributeType,
  tenantEventToBinaryData,
  unsafeBrandId,
} from "pagopa-interop-models";
import { ExternalId } from "pagopa-interop-models";
import { toTenantCertifiedAttributeAssigned } from "../model/domain/toEvent.js";
import {
  ApiSelfcareTenantSeed,
  ApicertifiedTenantAttributeSeed,
} from "../model/types.js";
import {
  attributeNotFound,
  certifiedAttributeAlreadyAssigned,
  certifiedAttributeOriginIsNotCompliantWithCertifier,
  registryAttributeIdNotFound,
  tenantIsNotACertifier,
} from "../model/domain/errors.js";
import {
  CertifiedAttributeQueryResult,
  UpdateVerifiedTenantAttributeSeed,
} from "../model/domain/models.js";
import { tenantNotFound } from "../model/domain/errors.js";
import {
  toCreateEventTenantVerifiedAttributeExpirationUpdated,
  toCreateEventTenantVerifiedAttributeExtensionUpdated,
  toCreateEventTenantOnboardDetailsUpdated,
  toCreateEventTenantOnboarded,
} from "../model/domain/toEvent.js";
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
  assertTenantExists,
  getTenantCertifierId,
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
  dbInstance: DB,
  readModelService: ReadModelService
) {
  const repository = eventRepository(dbInstance, tenantEventToBinaryData);
  return {
    async updateVerifiedAttributeExtensionDate(
      tenantId: TenantId,
      attributeId: AttributeId,
      verifierId: string,
      correlationId: string
    ): Promise<Tenant> {
      logger.info(
        `Update extension date of attribute ${attributeId} for tenant ${tenantId}`
      );
      const tenant = await retrieveTenant(tenantId, readModelService);

      const attribute = tenant.data.attributes.find(
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

      const event = toCreateEventTenantVerifiedAttributeExtensionUpdated(
        tenant.data.id,
        tenant.metadata.version,
        updatedTenant,
        attributeId,
        correlationId
      );
      await repository.createEvent(event);
      return updatedTenant;
    },
    async updateTenantVerifiedAttribute({
      verifierId,
      tenantId,
      attributeId,
      updateVerifiedTenantAttributeSeed,
      correlationId,
    }: {
      verifierId: string;
      tenantId: TenantId;
      attributeId: AttributeId;
      updateVerifiedTenantAttributeSeed: UpdateVerifiedTenantAttributeSeed;
      correlationId: string;
    }): Promise<Tenant> {
      logger.info(`Update attribute ${attributeId} to tenant ${tenantId}`);
      const tenant = await retrieveTenant(tenantId, readModelService);

      const expirationDate = updateVerifiedTenantAttributeSeed.expirationDate
        ? new Date(updateVerifiedTenantAttributeSeed.expirationDate)
        : undefined;

      assertValidExpirationDate(expirationDate);

      const attribute = tenant.data.attributes.find(
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
      const event = toCreateEventTenantVerifiedAttributeExpirationUpdated(
        tenant.data.id,
        tenant.metadata.version,
        updatedTenant,
        attributeId,
        correlationId
      );
      await repository.createEvent(event);
      return updatedTenant;
    },
    async selfcareUpsertTenant({
      tenantSeed,
      authData,
      correlationId,
    }: {
      tenantSeed: ApiSelfcareTenantSeed;
      authData: AuthData;
      correlationId: string;
    }): Promise<string> {
      logger.info(
        `Upsert tenant by selfcare with externalId: ${tenantSeed.externalId}`
      );
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

        logger.info(
          `Creating tenant with external id ${tenantSeed.externalId} via SelfCare request"`
        );
        return await repository.createEvent(
          toCreateEventTenantOnboardDetailsUpdated(
            existingTenant.data.id,
            existingTenant.metadata.version,
            updatedTenant,
            correlationId
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
          toCreateEventTenantOnboarded(newTenant, correlationId)
        );
      }
    },

    async addCertifiedAttribute(
      tenantId: TenantId,
      {
        tenantAttributeSeed,
        authData,
        correlationId,
      }: {
        tenantAttributeSeed: ApicertifiedTenantAttributeSeed;
        authData: AuthData;
        correlationId: string;
      }
    ): Promise<Tenant> {
      logger.info(
        `Add certified attribute ${tenantAttributeSeed.id} to tenant ${tenantId}`
      );
      const organizationId = authData.organizationId;

      const requesterTenant = await retrieveTenant(
        organizationId,
        readModelService
      );

      const certifierId = requesterTenant.data.features
        .filter((feature) => feature.type === "PersistentCertifier")
        .find((feature) => feature.certifierId)?.certifierId;

      if (!certifierId) {
        throw tenantIsNotACertifier(organizationId);
      }

      const attribute = await readModelService.getAttributeById(
        unsafeBrandId<AttributeId>(tenantAttributeSeed.id)
      );

      if (attribute === undefined) {
        throw attributeNotFound(tenantAttributeSeed.id);
      }

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const origin = attribute.origin!;
      const attributeId = attribute.id;

      if (attribute.kind !== "Certified") {
        // Rinominare questo errore attributeIsNotCertified?
        throw registryAttributeIdNotFound(origin);
      }

      if (origin !== certifierId) {
        throw certifiedAttributeOriginIsNotCompliantWithCertifier(
          origin,
          organizationId,
          tenantId,
          certifierId
        );
      }

      const targetTenant = await retrieveTenant(tenantId, readModelService);

      const certifiedTenantAttribute = targetTenant.data.attributes
        .filter((attr) => attr.type === tenantAttributeType.CERTIFIED)
        .find(
          (attr) => attr.id === tenantAttributeSeed.id
        ) as CertifiedTenantAttribute;

      // eslint-disable-next-line functional/no-let
      let updatedTenant: Tenant;

      if (!certifiedTenantAttribute) {
        // assigning attribute for the first time
        updatedTenant = {
          ...targetTenant.data,
          attributes: [
            ...targetTenant.data.attributes,
            {
              id: attribute.id,
              type: tenantAttributeType.CERTIFIED,
              assignmentTimestamp: new Date(),
              revocationTimestamp: undefined,
            },
          ],
        };
      } else if (certifiedTenantAttribute.revocationTimestamp === undefined) {
        throw certifiedAttributeAlreadyAssigned(attributeId, organizationId);
      } else {
        // re-assigning attribute if it was revoked
        updatedTenant = {
          ...targetTenant.data,
          attributes: targetTenant.data.attributes.map((a) =>
            a.id === attribute.id
              ? {
                  ...a,
                  assignmentTimestamp: new Date(),
                  revocationTimestamp: undefined,
                }
              : a
          ),
          updatedAt: new Date(),
        };
      }

      const tenantKind = await getTenantKindLoadingCertifiedAttributes(
        readModelService,
        updatedTenant.attributes,
        updatedTenant.externalId
      );

      if (updatedTenant.kind !== tenantKind) {
        updatedTenant = {
          ...updatedTenant,
          kind: tenantKind,
        };
      }

      const event = toTenantCertifiedAttributeAssigned(
        targetTenant.data.id,
        targetTenant.metadata.version,
        updatedTenant,
        attributeId,
        correlationId
      );
      await repository.createEvent(event);
      return updatedTenant;
    },

    async getCertifiedAttributes({
      organizationId,
      offset,
      limit,
    }: {
      organizationId: TenantId;
      offset: number;
      limit: number;
    }): Promise<ListResult<CertifiedAttributeQueryResult>> {
      const tenant = await readModelService.getTenantById(organizationId);
      assertTenantExists(organizationId, tenant);

      const certifierId = getTenantCertifierId(tenant.data);

      return await readModelService.getCertifiedAttributes({
        certifierId,
        offset,
        limit,
      });
    },

    async getProducers({
      producerName,
      offset,
      limit,
    }: {
      producerName: string | undefined;
      offset: number;
      limit: number;
    }): Promise<ListResult<Tenant>> {
      logger.info(
        `Retrieving Producers with name = ${producerName}, limit = ${limit}, offset = ${offset}`
      );
      return readModelService.getProducers({ producerName, offset, limit });
    },
    async getConsumers({
      consumerName,
      producerId,
      offset,
      limit,
    }: {
      consumerName: string | undefined;
      producerId: TenantId;
      offset: number;
      limit: number;
    }): Promise<ListResult<Tenant>> {
      logger.info(
        `Retrieving Consumers with name = ${consumerName}, limit = ${limit}, offset = ${offset}`
      );
      return readModelService.getConsumers({
        consumerName,
        producerId,
        offset,
        limit,
      });
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
