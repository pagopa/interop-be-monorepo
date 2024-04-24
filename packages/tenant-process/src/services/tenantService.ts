import { AuthData, DB, eventRepository, logger } from "pagopa-interop-commons";
import {
  AttributeId,
  CertifiedTenantAttribute,
  ListResult,
  Tenant,
  TenantAttribute,
  TenantId,
  VerifiedTenantAttribute,
  WithMetadata,
  generateId,
  tenantAttributeType,
  tenantEventToBinaryData,
  unsafeBrandId,
} from "pagopa-interop-models";
import { ExternalId } from "pagopa-interop-models";
import {
  toCreateEventTenantVerifiedAttributeAssigned,
  toCreateEventTenantCertifiedAttributeAssigned,
  toCreateEventTenantDeclaredAttributeAssigned,
  toCreateEventTenantVerifiedAttributeRevoked,
} from "../model/domain/toEvent.js";
import {
  ApiCertifiedTenantAttributeSeed,
  ApiSelfcareTenantSeed,
  ApiDeclaredTenantAttributeSeed,
  ApiVerifiedTenantAttributeSeed,
} from "../model/types.js";
import {
  attributeAlreadyRevoked,
  attributeNotFound,
  attributeRevocationNotAllowed,
  certifiedAttributeAlreadyAssigned,
  certifiedAttributeOriginIsNotCompliantWithCertifier,
  tenantIsNotACertifier,
  verifiedAttributeSelfRevocation,
  verifiedAttributeSelfVerification,
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
  assertAttributeVerificationAllowed,
  assertAttributeRevocationAllowed,
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
        tenantAttributeSeed: ApiCertifiedTenantAttributeSeed;
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

      const certifierId = requesterTenant.data.features.find(
        (feature) => feature.type === "PersistentCertifier"
      )?.certifierId;

      if (!certifierId) {
        throw tenantIsNotACertifier(organizationId);
      }

      const attribute = await readModelService.getAttributeById(
        unsafeBrandId(tenantAttributeSeed.id)
      );

      if (!attribute || attribute.kind !== "Certified") {
        throw attributeNotFound(tenantAttributeSeed.id);
      }

      if (!attribute.origin || attribute.origin !== certifierId) {
        throw certifiedAttributeOriginIsNotCompliantWithCertifier(
          attribute.origin || "",
          organizationId,
          tenantId,
          certifierId
        );
      }

      const targetTenant = await retrieveTenant(tenantId, readModelService);

      const certifiedTenantAttribute = targetTenant.data.attributes.find(
        (attr) =>
          attr.type === tenantAttributeType.CERTIFIED &&
          attr.id === tenantAttributeSeed.id
      ) as CertifiedTenantAttribute;

      // eslint-disable-next-line functional/no-let
      let updatedTenant: Tenant = {
        ...targetTenant.data,
        updatedAt: new Date(),
      };

      if (!certifiedTenantAttribute) {
        // assigning attribute for the first time
        updatedTenant = {
          ...updatedTenant,
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
      } else if (!certifiedTenantAttribute.revocationTimestamp) {
        throw certifiedAttributeAlreadyAssigned(attribute.id, organizationId);
      } else {
        // re-assigning attribute if it was revoked
        updatedTenant = updateAttribute({
          updatedTenant,
          targetTenant,
          attributeId: attribute.id,
        });
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

      const event = toCreateEventTenantCertifiedAttributeAssigned(
        targetTenant.data.id,
        targetTenant.metadata.version,
        updatedTenant,
        attribute.id,
        correlationId
      );
      await repository.createEvent(event);
      return updatedTenant;
    },

    async addDeclaredAttribute({
      tenantAttributeSeed,
      authData,
      correlationId,
    }: {
      tenantAttributeSeed: ApiDeclaredTenantAttributeSeed;
      authData: AuthData;
      correlationId: string;
    }): Promise<Tenant> {
      logger.info(
        `Add declared attribute ${tenantAttributeSeed.id} to requester tenant ${authData.organizationId}`
      );
      const targetTenant = await retrieveTenant(
        authData.organizationId,
        readModelService
      );

      const maybeDeclaredTenantAttribute = targetTenant.data.attributes.find(
        (attr) => attr.id === tenantAttributeSeed.id
      );

      // eslint-disable-next-line functional/no-let
      let updatedTenant: Tenant = {
        ...targetTenant.data,
        updatedAt: new Date(),
      };
      if (!maybeDeclaredTenantAttribute) {
        // assigning attribute for the first time
        updatedTenant = {
          ...updatedTenant,
          attributes: [
            ...targetTenant.data.attributes,
            {
              id: unsafeBrandId(tenantAttributeSeed.id),
              type: tenantAttributeType.DECLARED,
              assignmentTimestamp: new Date(),
              revocationTimestamp: undefined,
            },
          ],
        };
      } else {
        if (
          maybeDeclaredTenantAttribute.type !== "PersistentDeclaredAttribute"
        ) {
          throw attributeNotFound(maybeDeclaredTenantAttribute.id);
        }
        // re-assigning attribute if it was revoked
        updatedTenant = updateAttribute({
          updatedTenant,
          targetTenant,
          attributeId: unsafeBrandId(tenantAttributeSeed.id),
        });
      }
      const event = toCreateEventTenantDeclaredAttributeAssigned(
        targetTenant.data.id,
        targetTenant.metadata.version,
        updatedTenant,
        unsafeBrandId(tenantAttributeSeed.id),
        correlationId
      );
      await repository.createEvent(event);
      return updatedTenant;
    },

    async verifyVerifiedAttribute({
      tenantId,
      tenantAttributeSeed,
      organizationId,
      correlationId,
    }: {
      tenantId: TenantId;
      tenantAttributeSeed: ApiVerifiedTenantAttributeSeed;
      organizationId: TenantId;
      correlationId: string;
    }): Promise<Tenant> {
      logger.info(
        `Verifying attribute ${tenantAttributeSeed.id} to tenant ${tenantId}`
      );

      if (organizationId === tenantId) {
        throw verifiedAttributeSelfVerification();
      }

      await assertAttributeVerificationAllowed({
        producerId: organizationId,
        consumerId: tenantId,
        attributeId: unsafeBrandId(tenantAttributeSeed.id),
        readModelService,
      });

      const targetTenant = await retrieveTenant(tenantId, readModelService);

      const verifiedTenantAttribute = targetTenant.data.attributes.find(
        (attr) =>
          attr.type === tenantAttributeType.VERIFIED &&
          attr.id === tenantAttributeSeed.id
      ) as VerifiedTenantAttribute;

      // eslint-disable-next-line functional/no-let
      let updatedTenant: Tenant = {
        ...targetTenant.data,
        updatedAt: new Date(),
      };
      if (!verifiedTenantAttribute) {
        // assigning attribute for the first time
        updatedTenant = {
          ...updatedTenant,
          attributes: [
            {
              id: unsafeBrandId(tenantAttributeSeed.id),
              type: tenantAttributeType.VERIFIED,
              assignmentTimestamp: new Date(),
              verifiedBy: [
                {
                  id: organizationId,
                  verificationDate: new Date(),
                  expirationDate: tenantAttributeSeed.expirationDate
                    ? new Date(tenantAttributeSeed.expirationDate)
                    : undefined,
                  extensionDate: tenantAttributeSeed.expirationDate
                    ? new Date(tenantAttributeSeed.expirationDate)
                    : undefined,
                },
              ],
              revokedBy: [],
            },
          ],
        };
      } else {
        updatedTenant = {
          ...updatedTenant,
          attributes: [
            ...targetTenant.data.attributes,
            {
              id: verifiedTenantAttribute.id,
              type: tenantAttributeType.VERIFIED,
              assignmentTimestamp: verifiedTenantAttribute.assignmentTimestamp,
              verifiedBy: [
                ...verifiedTenantAttribute.verifiedBy,
                {
                  id: organizationId,
                  verificationDate: new Date(),
                  expirationDate: tenantAttributeSeed.expirationDate
                    ? new Date(tenantAttributeSeed.expirationDate)
                    : undefined,
                  extensionDate: undefined,
                },
              ],
              revokedBy: verifiedTenantAttribute.revokedBy,
            },
          ],
        };
      }
      const event = toCreateEventTenantVerifiedAttributeAssigned(
        targetTenant.data.id,
        targetTenant.metadata.version,
        updatedTenant,
        unsafeBrandId(tenantAttributeSeed.id),
        correlationId
      );
      await repository.createEvent(event);
      return updatedTenant;
    },

    async revokeVerifiedAttribute({
      tenantId,
      attributeId,
      organizationId,
      correlationId,
    }: {
      tenantId: TenantId;
      attributeId: AttributeId;
      organizationId: TenantId;
      correlationId: string;
    }): Promise<Tenant> {
      logger.info(
        `Revoke verified attribute ${attributeId} to tenant ${tenantId}`
      );

      if (organizationId === tenantId) {
        throw verifiedAttributeSelfRevocation();
      }

      await assertAttributeRevocationAllowed({
        producerId: organizationId,
        consumerId: tenantId,
        attributeId,
        readModelService,
      });

      const targetTenant = await retrieveTenant(tenantId, readModelService);

      const verifiedTenantAttribute = targetTenant.data.attributes.find(
        (attr): attr is VerifiedTenantAttribute =>
          attr.type === tenantAttributeType.VERIFIED && attr.id === attributeId
      );

      if (!verifiedTenantAttribute) {
        throw attributeNotFound(attributeId);
      }

      if (
        !verifiedTenantAttribute.verifiedBy.find((a) => a.id === organizationId)
      ) {
        throw attributeRevocationNotAllowed(tenantId, attributeId);
      }

      if (
        verifiedTenantAttribute.revokedBy.find((a) => a.id === organizationId)
      ) {
        throw attributeAlreadyRevoked(tenantId, organizationId, attributeId);
      }

      const updatedTenant = updateAttribute(
        {
          updatedTenant: {
            ...targetTenant.data,
            updatedAt: new Date(),
          },
          targetTenant,
          attributeId,
          revocationTimestamp: new Date(),
        },
        verifiedTenantAttribute.assignmentTimestamp
      );

      await repository.createEvent(
        toCreateEventTenantVerifiedAttributeRevoked(
          targetTenant.data.id,
          targetTenant.metadata.version,
          updatedTenant,
          attributeId,
          correlationId
        )
      );
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

function updateAttribute(
  {
    updatedTenant,
    targetTenant,
    attributeId,
    revocationTimestamp,
  }: {
    updatedTenant: Tenant;
    targetTenant: WithMetadata<Tenant>;
    attributeId: AttributeId;
    revocationTimestamp?: Date | undefined;
  },
  assignmentTimestamp: Date = new Date()
): Tenant {
  return {
    ...updatedTenant,
    attributes: targetTenant.data.attributes.map((a) =>
      a.id === attributeId
        ? {
            ...a,
            assignmentTimestamp,
            revocationTimestamp,
          }
        : a
    ),
  };
}

export type TenantService = ReturnType<typeof tenantServiceBuilder>;
