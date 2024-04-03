import {
  AuthData,
  CreateEvent,
  DB,
  eventRepository,
  logger,
} from "pagopa-interop-commons";
import {
  Attribute,
  AttributeId,
  ExternalId,
  ListResult,
  Tenant,
  TenantAttribute,
  TenantEvent,
  TenantId,
  TenantKind,
  WithMetadata,
  generateId,
  tenantAttributeType,
  tenantEventToBinaryData,
  unsafeBrandId,
} from "pagopa-interop-models";
import {
  toCreateEventTenantAdded,
  toCreateEventTenantUpdated,
  toTenantCertifiedAttributeAssigned,
} from "../model/domain/toEvent.js";
import { UpdateVerifiedTenantAttributeSeed } from "../model/domain/models.js";
import {
  ApiInternalTenantSeed,
  ApiM2MTenantSeed,
  ApiSelfcareTenantSeed,
  ApicertifiedTenantAttributeSeed,
} from "../model/types.js";
import {
  certifiedAttributeAlreadyAssigned,
  tenantDuplicate,
} from "../model/domain/errors.js";
import {
  assertOrganizationIsInAttributeVerifiers,
  assertTenantExists,
  assertValidExpirationDate,
  assertVerifiedAttributeExistsInTenant,
  assertResourceAllowed,
  evaluateNewSelfcareId,
  getTenantKind,
  getTenantKindLoadingCertifiedAttributes,
  assertOrganizationVerifierExist,
  assertExpirationDateExist,
  assertCertifiedAttributeExistsInTenant,
  assertTenantIsACertifier,
  assertAttributeIsCertified,
  assertCertifiedAttributeOriginIsCompliantWithCertifier,
  assertCertifierExists,
} from "./validators.js";
import { ReadModelService } from "./readModelService.js";

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
    ): Promise<string> {
      const tenant = await readModelService.getTenantById(tenantId);

      return await repository.createEvent(
        await updateVerifiedAttributeExtensionDateLogic({
          tenantId,
          attributeId,
          verifierId,
          tenant,
          correlationId,
        })
      );
    },
    async createTenant(
      apiTenantSeed:
        | ApiSelfcareTenantSeed
        | ApiM2MTenantSeed
        | ApiInternalTenantSeed,
      attributesExternalIds: ExternalId[],
      kind: TenantKind,
      correlationId: string
    ): Promise<string> {
      const [attributes, tenant] = await Promise.all([
        readModelService.getAttributesByExternalIds(attributesExternalIds),
        readModelService.getTenantByName(apiTenantSeed.name),
      ]);

      return repository.createEvent(
        createTenantLogic({
          tenant,
          apiTenantSeed,
          kind,
          attributes,
          correlationId,
        })
      );
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
    }): Promise<void> {
      const tenant = await readModelService.getTenantById(tenantId);

      await repository.createEvent(
        await updateTenantVerifiedAttributeLogic({
          verifierId,
          tenant,
          tenantId,
          attributeId,
          updateVerifiedTenantAttributeSeed,
          correlationId,
        })
      );
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
      const existingTenant = await readModelService.getTenantByExternalId(
        tenantSeed.externalId
      );
      if (existingTenant) {
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
          toCreateEventTenantUpdated(
            existingTenant.data.id,
            existingTenant.metadata.version,
            updatedTenant,
            correlationId
          )
        );
      } else {
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
          toCreateEventTenantAdded(newTenant, correlationId)
        );
      }
    },

    async addCertifiedAttribute(
      tenantId: TenantId,
      {
        tenantSeed,
        authData,
        correlationId,
      }: {
        tenantSeed: ApicertifiedTenantAttributeSeed;
        authData: AuthData;
        correlationId: string;
      }
    ): Promise<string> {
      logger.info(
        `Add certified attribute ${tenantSeed.id} to tenant ${tenantId}`
      );
      const organizationId = authData.organizationId;

      const requesterTenant = await readModelService.getTenantById(
        organizationId
      );

      assertTenantExists(organizationId, requesterTenant);

      const certifierId = requesterTenant?.data.features.find(
        (feature) => feature.certifierId
      );

      assertCertifierExists(certifierId?.certifierId);

      assertTenantIsACertifier(
        certifierId.certifierId,
        requesterTenant.data.id
      );

      const attribute = await readModelService.getAttributeById(
        unsafeBrandId<AttributeId>(tenantSeed.id)
      );

      const origin = attribute.data.origin;
      const attributeId = attribute.data.id;

      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      assertAttributeIsCertified(origin!, attribute.data.kind);

      assertCertifiedAttributeOriginIsCompliantWithCertifier(
        certifierId.certifierId,
        tenantId,
        organizationId,
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        origin!
      );

      const targetTenant = await readModelService.getTenantById(tenantId);
      assertTenantExists(tenantId, targetTenant);

      const certifiedAttribute = targetTenant?.data.attributes.find(
        (attr) => attr.id === tenantSeed.id
      );

      assertCertifiedAttributeExistsInTenant(
        attributeId,
        certifiedAttribute,
        targetTenant
      );

      const isCertifiedAttributePresent = targetTenant.data.attributes.find(
        (i) => i.id === certifiedAttribute.id
      );

      // eslint-disable-next-line functional/no-let
      let tenant: Tenant = {
        name: "",
        id: requesterTenant.data.id,
        createdAt: new Date(),
        attributes: [],
        externalId: {
          value: "",
          origin: "",
        },
        features: [],
        mails: [],
      };

      if (!isCertifiedAttributePresent) {
        const updatedTenant = {
          ...targetTenant.data,
          attributes: [...targetTenant.data.attributes, certifiedAttribute],
        };
        tenant = updatedTenant;
      } else if (certifiedAttribute.revocationTimestamp === undefined) {
        throw certifiedAttributeAlreadyAssigned(attributeId, organizationId);
      } else {
        const attribute = requesterTenant.data.attributes.find(
          (attr) => attr.id === attributeId
        );
        const updatedAttribute = {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          ...attribute!,
          assignmentTimestamp: new Date(),
          revocationTimestamp: undefined,
        };

        const updatedTenant = {
          ...requesterTenant.data,
          attributes: [...requesterTenant.data.attributes, updatedAttribute],
          updatedAt: new Date(),
        };
        tenant = updatedTenant;
      }

      const tenantKind = await getTenantKindLoadingCertifiedAttributes(
        readModelService,
        tenant.attributes,
        tenant.externalId
      );

      if (tenant.kind !== tenantKind) {
        await repository.createEvent(
          toTenantCertifiedAttributeAssigned(
            requesterTenant.data.id,
            requesterTenant.metadata.version,
            tenant,
            correlationId
          )
        );
      }

      return await repository.createEvent(
        toCreateEventTenantUpdated(
          requesterTenant.data.id,
          requesterTenant.metadata.version,
          tenant,
          correlationId
        )
      );
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

async function updateTenantVerifiedAttributeLogic({
  verifierId,
  tenant,
  tenantId,
  attributeId,
  updateVerifiedTenantAttributeSeed,
  correlationId,
}: {
  verifierId: string;
  tenant: WithMetadata<Tenant> | undefined;
  tenantId: TenantId;
  attributeId: AttributeId;
  updateVerifiedTenantAttributeSeed: UpdateVerifiedTenantAttributeSeed;
  correlationId: string;
}): Promise<CreateEvent<TenantEvent>> {
  assertTenantExists(tenantId, tenant);

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

  return toCreateEventTenantUpdated(
    tenant.data.id,
    tenant.metadata.version,
    updatedTenant,
    correlationId
  );
}

export function createTenantLogic({
  tenant,
  apiTenantSeed,
  kind,
  attributes,
  correlationId,
}: {
  tenant: WithMetadata<Tenant> | undefined;
  apiTenantSeed:
    | ApiSelfcareTenantSeed
    | ApiM2MTenantSeed
    | ApiInternalTenantSeed;
  kind: TenantKind;
  attributes: Array<WithMetadata<Attribute>>;
  correlationId: string;
}): CreateEvent<TenantEvent> {
  if (tenant) {
    throw tenantDuplicate(apiTenantSeed.name);
  }

  const tenantAttributes: TenantAttribute[] = attributes.map((attribute) => ({
    type: tenantAttributeType.CERTIFIED, // All attributes here are certified
    id: attribute.data.id,
    assignmentTimestamp: new Date(),
  }));

  const newTenant: Tenant = {
    id: generateId(),
    name: apiTenantSeed.name,
    attributes: tenantAttributes,
    externalId: apiTenantSeed.externalId,
    features: [],
    mails: [],
    createdAt: new Date(),
    kind,
  };

  return toCreateEventTenantAdded(newTenant, correlationId);
}
export type TenantService = ReturnType<typeof tenantServiceBuilder>;

export async function updateVerifiedAttributeExtensionDateLogic({
  tenantId,
  attributeId,
  verifierId,
  tenant,
  correlationId,
}: {
  tenantId: TenantId;
  attributeId: AttributeId;
  verifierId: string;
  tenant: WithMetadata<Tenant> | undefined;
  correlationId: string;
}): Promise<CreateEvent<TenantEvent>> {
  assertTenantExists(tenantId, tenant);

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

  logger.info(
    `Update extension date of attribute ${attributeId} for tenant ${tenantId}`
  );
  return toCreateEventTenantUpdated(
    tenant.data.id,
    tenant.metadata.version,
    updatedTenant,
    correlationId
  );
}
