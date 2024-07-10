import {
  DB,
  eventRepository,
  Logger,
  WithLogger,
  AppContext,
} from "pagopa-interop-commons";
import {
  Attribute,
  AttributeId,
  CertifiedTenantAttribute,
  DeclaredTenantAttribute,
  ListResult,
  Tenant,
  TenantAttribute,
  TenantId,
  TenantVerifier,
  VerifiedTenantAttribute,
  WithMetadata,
  agreementState,
  attributeKind,
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
} from "../model/domain/toEvent.js";
import {
  ApiCertifiedTenantAttributeSeed,
  ApiSelfcareTenantSeed,
  ApiDeclaredTenantAttributeSeed,
  ApiVerifiedTenantAttributeSeed,
  ApiInternalTenantSeed,
} from "../model/types.js";
import {
  attributeNotFound,
  attributeVerificationNotAllowed,
  certifiedAttributeAlreadyAssigned,
  certifiedAttributeOriginIsNotCompliantWithCertifier,
  tenantIsNotACertifier,
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
  assertVerifiedAttributeOperationAllowed,
} from "./validators.js";
import { ReadModelService } from "./readModelService.js";

const retrieveTenant = async (
  tenantId: TenantId,
  readModelService: ReadModelService
): Promise<WithMetadata<Tenant>> => {
  const tenant = await readModelService.getTenantById(tenantId);
  if (!tenant) {
    throw tenantNotFound(tenantId);
  }
  return tenant;
};

export async function retrieveAttribute(
  attributeId: AttributeId,
  readModelService: ReadModelService
): Promise<Attribute> {
  const attribute = await readModelService.getAttributeById(attributeId);
  if (!attribute) {
    throw attributeNotFound(attributeId);
  }
  return attribute;
}

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
      { correlationId, logger }: WithLogger<AppContext>
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

    async updateTenantVerifiedAttribute(
      {
        verifierId,
        tenantId,
        attributeId,
        updateVerifiedTenantAttributeSeed,
      }: {
        verifierId: string;
        tenantId: TenantId;
        attributeId: AttributeId;
        updateVerifiedTenantAttributeSeed: UpdateVerifiedTenantAttributeSeed;
      },
      { correlationId, logger }: WithLogger<AppContext>
    ): Promise<Tenant> {
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

    async selfcareUpsertTenant(
      tenantSeed: ApiSelfcareTenantSeed,
      { authData, correlationId, logger }: WithLogger<AppContext>
    ): Promise<string> {
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
          onboardedAt: new Date(),
          createdAt: new Date(),
        };
        return await repository.createEvent(
          toCreateEventTenantOnboarded(newTenant, correlationId)
        );
      }
    },

    async addCertifiedAttribute(
      tenantId: TenantId,
      logger: Logger,
      {
        tenantAttributeSeed,
        organizationId,
        correlationId,
      }: {
        tenantAttributeSeed: ApiCertifiedTenantAttributeSeed;
        organizationId: TenantId;
        correlationId: string;
      }
    ): Promise<Tenant> {
      logger.info(
        `Add certified attribute ${tenantAttributeSeed.id} to tenant ${tenantId}`
      );

      const requesterTenant = await retrieveTenant(
        organizationId,
        readModelService
      );

      const certifierId = getTenantCertifierId(requesterTenant.data);

      if (!certifierId) {
        throw tenantIsNotACertifier(organizationId);
      }

      const attribute = await retrieveAttribute(
        unsafeBrandId(tenantAttributeSeed.id),
        readModelService
      );

      if (attribute.kind !== attributeKind.certified) {
        throw attributeNotFound(attribute.id);
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

      const updatedTenant = await assignCertifiedAttribute({
        targetTenant: targetTenant.data,
        attribute,
        readModelService,
      });

      await repository.createEvent(
        toCreateEventTenantCertifiedAttributeAssigned(
          targetTenant.metadata.version,
          updatedTenant,
          attribute.id,
          correlationId
        )
      );
      return updatedTenant;
    },

    async addDeclaredAttribute(
      {
        tenantAttributeSeed,
        organizationId,
        correlationId,
      }: {
        tenantAttributeSeed: ApiDeclaredTenantAttributeSeed;
        organizationId: TenantId;
        correlationId: string;
      },
      logger: Logger
    ): Promise<Tenant> {
      logger.info(
        `Add declared attribute ${tenantAttributeSeed.id} to requester tenant ${organizationId}`
      );
      const targetTenant = await retrieveTenant(
        organizationId,
        readModelService
      );

      const attribute = await retrieveAttribute(
        unsafeBrandId(tenantAttributeSeed.id),
        readModelService
      );

      if (attribute.kind !== attributeKind.declared) {
        throw attributeNotFound(attribute.id);
      }

      const maybeDeclaredTenantAttribute = targetTenant.data.attributes.find(
        (attr): attr is DeclaredTenantAttribute =>
          attr.type === tenantAttributeType.DECLARED && attr.id === attribute.id
      );

      const updatedTenant: Tenant = {
        ...targetTenant.data,
        attributes: maybeDeclaredTenantAttribute
          ? reassignDeclaredAttribute(
              targetTenant.data.attributes,
              attribute.id
            )
          : assignDeclaredAttribute(targetTenant.data.attributes, attribute.id),

        updatedAt: new Date(),
      };

      await repository.createEvent(
        toCreateEventTenantDeclaredAttributeAssigned(
          targetTenant.metadata.version,
          updatedTenant,
          unsafeBrandId(tenantAttributeSeed.id),
          correlationId
        )
      );
      return updatedTenant;
    },

    async verifyVerifiedAttribute(
      {
        tenantId,
        tenantAttributeSeed,
        organizationId,
        correlationId,
      }: {
        tenantId: TenantId;
        tenantAttributeSeed: ApiVerifiedTenantAttributeSeed;
        organizationId: TenantId;
        correlationId: string;
      },
      logger: Logger
    ): Promise<Tenant> {
      logger.info(
        `Verifying attribute ${tenantAttributeSeed.id} to tenant ${tenantId}`
      );

      if (organizationId === tenantId) {
        throw verifiedAttributeSelfVerification();
      }

      const allowedStatuses = [
        agreementState.pending,
        agreementState.active,
        agreementState.suspended,
      ];
      await assertVerifiedAttributeOperationAllowed({
        producerId: organizationId,
        consumerId: tenantId,
        attributeId: unsafeBrandId(tenantAttributeSeed.id),
        agreementStates: allowedStatuses,
        readModelService,
        error: attributeVerificationNotAllowed(
          tenantId,
          unsafeBrandId(tenantAttributeSeed.id)
        ),
      });

      const targetTenant = await retrieveTenant(tenantId, readModelService);

      const attribute = await retrieveAttribute(
        unsafeBrandId(tenantAttributeSeed.id),
        readModelService
      );

      if (attribute.kind !== attributeKind.verified) {
        throw attributeNotFound(attribute.id);
      }

      const verifiedTenantAttribute = targetTenant.data.attributes.find(
        (attr): attr is VerifiedTenantAttribute =>
          attr.type === tenantAttributeType.VERIFIED && attr.id === attribute.id
      );

      const updatedTenant: Tenant = {
        ...targetTenant.data,
        attributes: verifiedTenantAttribute
          ? reassignVerifiedAttribute(
              targetTenant.data.attributes,
              verifiedTenantAttribute,
              organizationId,
              tenantAttributeSeed
            )
          : assignVerifiedAttribute(
              targetTenant.data.attributes,
              organizationId,
              tenantAttributeSeed
            ),

        updatedAt: new Date(),
      };

      await repository.createEvent(
        toCreateEventTenantVerifiedAttributeAssigned(
          targetTenant.metadata.version,
          updatedTenant,
          unsafeBrandId(tenantAttributeSeed.id),
          correlationId
        )
      );
      return updatedTenant;
    },

    async internalAssignCertifiedAttribute(
      {
        tenantOrigin,
        tenantExternalId,
        attributeOrigin,
        attributeExternalId,
        correlationId,
      }: {
        tenantOrigin: string;
        tenantExternalId: string;
        attributeOrigin: string;
        attributeExternalId: string;
        correlationId: string;
      },
      logger: Logger
    ): Promise<void> {
      logger.info(
        `Assigning certified attribute (${attributeOrigin}/${attributeExternalId}) to tenant (${tenantOrigin}/${tenantExternalId})`
      );

      const tenantToModify = await readModelService.getTenantByExternalId({
        origin: tenantOrigin,
        value: tenantExternalId,
      });

      assertTenantExists(
        unsafeBrandId(`${tenantOrigin}/${tenantExternalId}`),
        tenantToModify
      );

      const attributeToAssign =
        await readModelService.getAttributeByOriginAndCode({
          origin: attributeOrigin,
          code: attributeExternalId,
        });

      if (!attributeToAssign) {
        throw attributeNotFound(`${attributeOrigin}/${attributeExternalId}`);
      }

      const updatedTenant = await assignCertifiedAttribute({
        targetTenant: tenantToModify.data,
        attribute: attributeToAssign,
        readModelService,
      });

      await repository.createEvent(
        toCreateEventTenantCertifiedAttributeAssigned(
          tenantToModify.metadata.version,
          updatedTenant,
          attributeToAssign.id,
          correlationId
        )
      );
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

    async getProducers(
      {
        producerName,
        offset,
        limit,
      }: {
        producerName: string | undefined;
        offset: number;
        limit: number;
      },
      logger: Logger
    ): Promise<ListResult<Tenant>> {
      logger.info(
        `Retrieving Producers with name = ${producerName}, limit = ${limit}, offset = ${offset}`
      );
      return readModelService.getProducers({ producerName, offset, limit });
    },
    async getConsumers(
      {
        consumerName,
        producerId,
        offset,
        limit,
      }: {
        consumerName: string | undefined;
        producerId: TenantId;
        offset: number;
        limit: number;
      },
      logger: Logger
    ): Promise<ListResult<Tenant>> {
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
    async getTenantsByName(
      {
        name,
        offset,
        limit,
      }: {
        name: string | undefined;
        offset: number;
        limit: number;
      },
      logger: Logger
    ): Promise<ListResult<Tenant>> {
      logger.info(
        `Retrieving Tenants with name = ${name}, limit = ${limit}, offset = ${offset}`
      );
      return readModelService.getTenantsByName({ name, offset, limit });
    },
    async getTenantById(
      id: TenantId,
      logger: Logger
    ): Promise<WithMetadata<Tenant> | undefined> {
      logger.info(`Retrieving tenant ${id}`);
      return readModelService.getTenantById(id);
    },
    async getTenantByExternalId(
      externalId: ExternalId,
      logger: Logger
    ): Promise<WithMetadata<Tenant> | undefined> {
      logger.info(
        `Retrieving tenant with origin ${externalId.origin} and code ${externalId.value}`
      );
      return readModelService.getTenantByExternalId(externalId);
    },
    async getTenantBySelfcareId(
      selfcareId: string,
      logger: Logger
    ): Promise<WithMetadata<Tenant> | undefined> {
      logger.info(`Retrieving Tenant with Selfcare Id ${selfcareId}`);
      return readModelService.getTenantBySelfcareId(selfcareId);
    },

    async internalUpsertTenant(
      internalTenantSeed: ApiInternalTenantSeed,
      { authData, correlationId, logger }: WithLogger<AppContext>
    ): Promise<Tenant> {
      const existingTenant = await readModelService.getTenantByExternalId(
        internalTenantSeed.externalId
      );

      const externalIds: ExternalId[] =
        internalTenantSeed.certifiedAttributes.map((oc) =>
          ExternalId.parse({ value: oc.code, origin: oc.origin })
        );

      const attributesByExternalId =
        await readModelService.getAttributesByExternalIds(externalIds);

      if (existingTenant) {
        logger.info(
          `Updating tenant with external id ${internalTenantSeed.externalId} via internal request"`
        );

        await assertResourceAllowed(existingTenant.data.id, authData);

        const updatedTenant = await updateTenantCertifiedAttributes(
          attributesByExternalId,
          existingTenant.data,
          readModelService
        );

        await repository.createEvent(
          toCreateEventTenantOnboardDetailsUpdated(
            existingTenant.data.id,
            existingTenant.metadata.version,
            updatedTenant,
            correlationId
          )
        );

        return updatedTenant;
      } else {
        logger.info(
          `Creating tenant with external id ${internalTenantSeed.externalId} via internal request"`
        );
        // eslint-disable-next-line functional/no-let
        const attributes: CertifiedTenantAttribute[] = [];

        for (const attribute of attributesByExternalId) {
          const tenantAttribute: CertifiedTenantAttribute = {
            type: "PersistentCertifiedAttribute",
            id: attribute.id,
            assignmentTimestamp: new Date(),
          };
          // eslint-disable-next-line functional/immutable-data
          attributes.push(tenantAttribute);
        }

        const newTenant: Tenant = {
          id: generateId(),
          name: internalTenantSeed.name,
          attributes,
          externalId: internalTenantSeed.externalId,
          features: [],
          mails: [],
          selfcareId: authData.selfcareId,
          kind: getTenantKind([], internalTenantSeed.externalId),
          onboardedAt: new Date(),
          createdAt: new Date(),
        };
        await repository.createEvent(
          toCreateEventTenantOnboarded(newTenant, correlationId)
        );
        return newTenant;
      }
    },
  };
}

async function assignCertifiedAttribute({
  targetTenant,
  attribute,
  readModelService,
}: {
  targetTenant: Tenant;
  attribute: Attribute;
  readModelService: ReadModelService;
}): Promise<Tenant> {
  const certifiedTenantAttribute = targetTenant.attributes.find(
    (attr): attr is CertifiedTenantAttribute =>
      attr.type === tenantAttributeType.CERTIFIED && attr.id === attribute.id
  );

  // eslint-disable-next-line functional/no-let
  let updatedTenant: Tenant = {
    ...targetTenant,
    updatedAt: new Date(),
  };

  if (!certifiedTenantAttribute) {
    // assigning attribute for the first time
    updatedTenant = {
      ...updatedTenant,
      attributes: [
        ...targetTenant.attributes,
        {
          id: attribute.id,
          type: tenantAttributeType.CERTIFIED,
          assignmentTimestamp: new Date(),
          revocationTimestamp: undefined,
        },
      ],
    };
  } else if (!certifiedTenantAttribute.revocationTimestamp) {
    throw certifiedAttributeAlreadyAssigned(attribute.id, targetTenant.id);
  } else {
    // re-assigning attribute if it was revoked
    updatedTenant = {
      ...updatedTenant,
      attributes: targetTenant.attributes.map((a) =>
        a.id === attribute.id
          ? {
              ...a,
              assignmentTimestamp: new Date(),
              revocationTimestamp: undefined,
            }
          : a
      ),
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
  return updatedTenant;
}

async function updateTenantCertifiedAttributes(
  attributes: Attribute[],
  tenant: Tenant,
  readModelService: ReadModelService
): Promise<Tenant> {
  // eslint-disable-next-line functional/no-let
  let updatedTenant: Tenant = {
    ...tenant,
    updatedAt: new Date(),
  };
  for (const attribute of attributes) {
    const certifiedTenantAttribute = tenant.attributes.find(
      (attr): attr is CertifiedTenantAttribute =>
        attr.type === tenantAttributeType.CERTIFIED && attr.id === attribute.id
    );
    if (!certifiedTenantAttribute) {
      continue;
    }

    updatedTenant = {
      ...updatedTenant,
      attributes: tenant.attributes.map((b) =>
        b.id === attribute.id
          ? {
              ...b,
              assignmentTimestamp: new Date(),
              revocationTimestamp: undefined,
            }
          : b
      ),
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

  return updatedTenant;
}

function buildVerifiedBy(
  verifiers: TenantVerifier[],
  organizationId: TenantId,
  expirationDate: string | undefined
): TenantVerifier[] {
  const hasPreviouslyVerified = verifiers.find((i) => i.id === organizationId);
  return hasPreviouslyVerified
    ? verifiers.map((verification) =>
        verification.id === organizationId
          ? {
              id: organizationId,
              verificationDate: new Date(),
              expirationDate: expirationDate
                ? new Date(expirationDate)
                : undefined,
              extensionDate: undefined,
            }
          : verification
      )
    : [
        ...verifiers,
        {
          id: organizationId,
          verificationDate: new Date(),
          expirationDate: expirationDate ? new Date(expirationDate) : undefined,
          extensionDate: undefined,
        },
      ];
}
function assignDeclaredAttribute(
  attributes: TenantAttribute[],
  attributeId: AttributeId
): TenantAttribute[] {
  return [
    ...attributes,
    {
      id: unsafeBrandId(attributeId),
      type: tenantAttributeType.DECLARED,
      assignmentTimestamp: new Date(),
      revocationTimestamp: undefined,
    },
  ];
}

function reassignDeclaredAttribute(
  attributes: TenantAttribute[],
  attributeId: AttributeId
): TenantAttribute[] {
  return attributes.map((attr) =>
    attr.id === attributeId
      ? {
          ...attr,
          assignmentTimestamp: new Date(),
          revocationTimestamp: undefined,
        }
      : attr
  );
}

function assignVerifiedAttribute(
  attributes: TenantAttribute[],
  organizationId: TenantId,
  tenantAttributeSeed: ApiVerifiedTenantAttributeSeed
): TenantAttribute[] {
  return [
    ...attributes,
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
  ];
}

function reassignVerifiedAttribute(
  attributes: TenantAttribute[],
  verifiedTenantAttribute: VerifiedTenantAttribute,
  organizationId: TenantId,
  tenantAttributeSeed: ApiVerifiedTenantAttributeSeed
): TenantAttribute[] {
  return attributes.map((attr) =>
    attr.id === verifiedTenantAttribute.id
      ? {
          ...attr,
          verifiedBy: buildVerifiedBy(
            verifiedTenantAttribute.verifiedBy,
            organizationId,
            tenantAttributeSeed.expirationDate
          ),
        }
      : attr
  );
}

export type TenantService = ReturnType<typeof tenantServiceBuilder>;
