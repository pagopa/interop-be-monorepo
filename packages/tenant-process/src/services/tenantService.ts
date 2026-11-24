import { bffApi, tenantApi } from "pagopa-interop-api-clients";
import {
  DB,
  eventRepository,
  Logger,
  WithLogger,
  AppContext,
  CreateEvent,
  UIAuthData,
  InternalAuthData,
  MaintenanceAuthData,
  M2MAuthData,
  isUiAuthData,
  M2MAdminAuthData,
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
  TenantEvent,
  TenantFeatureCertifier,
  CorrelationId,
  tenantKind,
  AgreementId,
  Agreement,
  AgreementState,
  DelegationId,
  TenantRevoker,
  ContactId,
} from "pagopa-interop-models";
import { ExternalId } from "pagopa-interop-models";
import { match, P } from "ts-pattern";

import { fromApiTenantFeature } from "../model/domain/apiConverter.js";
import {
  attributeAlreadyRevoked,
  attributeDoesNotBelongToCertifier,
  attributeNotFound,
  attributeNotFoundInTenant,
  attributeRevocationNotAllowed,
  attributeVerificationNotAllowed,
  certifiedAttributeAlreadyAssigned,
  certifiedDiscreteAttributeRevoked,
  certifierWithExistingAttributes,
  tenantIsNotACertifier,
  tenantNotFoundByExternalId,
  tenantNotFoundBySelfcareId,
  tenantNotFound,
  tenantIsAlreadyACertifier,
  verifiedAttributeSelfRevocationNotAllowed,
  agreementNotFound,
  delegationNotFound,
  operationRestrictedToDelegate,
  verifiedAttributeSelfVerificationNotAllowed,
  certifiedDiscreteAttributeAlreadyAssigned,
  tenantNotFoundByRemoteId,
  tenantUpdateVersionMismatch,
  tenantContactAlreadyAssigned,
  tenantContactNotFound,
  tenantMailsNotAllowed,
} from "../model/domain/errors.js";
import { ApiGetTenantsFilters } from "../model/domain/models.js";
import {
  toCreateEventTenantVerifiedAttributeExpirationUpdated,
  toCreateEventTenantVerifiedAttributeExtensionUpdated,
  toCreateEventTenantOnboardDetailsUpdated,
  toCreateEventTenantOnboarded,
  toCreateEventMaintenanceTenantDeleted,
  toCreateEventTenantCertifiedAttributeAssigned,
  toCreateEventTenantDeclaredAttributeAssigned,
  toCreateEventTenantKindUpdated,
  toCreateEventTenantDeclaredAttributeRevoked,
  toCreateEventTenantCertifiedAttributeRevoked,
  toCreateEventTenantContactAdded,
  toCreateEventTenantContactDeleted,
  toCreateEventTenantVerifiedAttributeAssigned,
  toCreateEventMaintenanceTenantPromotedToCertifier,
  toCreateEventTenantVerifiedAttributeRevoked,
  toCreateEventMaintenanceTenantUpdated,
  toCreateEventTenantDelegatedProducerFeatureAdded,
  toCreateEventTenantDelegatedProducerFeatureRemoved,
  toCreateEventTenantDelegatedConsumerFeatureRemoved,
  toCreateEventTenantDelegatedConsumerFeatureAdded,
  toCreateEventTenantCertifiedDiscreteAttributeRevoked,
  toCreateEventTenantCertifiedDiscreteAttributeUpdated,
  toCreateEventTenantRemoteIdAssigned,
  toCreateEventMaintenanceTenantRemoteIdDeleted,
  toCreateEventTenantCertifiedDiscreteAttributeAssigned,
} from "../model/domain/toEvent.js";
import { ContactDataManagerService } from "./contactDataManagerService.js";
import {
  convertLegacyTenant,
  LegacyTenantConversion,
  noLegacyTenantConversion,
} from "./legacyTenantConversion.js";
import { ReadModelServiceSQL } from "./readModelServiceSQL.js";
import {
  assertOrganizationIsInAttributeVerifiers,
  assertValidExpirationDate,
  assertVerifiedAttributeExistsInTenant,
  evaluateNewSelfcareId,
  getTenantKindLoadingCertifiedAttributes,
  assertOrganizationVerifierExist,
  assertExpirationDateExist,
  assertRequesterAllowed,
  assertVerifiedAttributeOperationAllowed,
  retrieveCertifierId,
  assertTenantAllowedForDelegation,
  getTenantKind,
  isFeatureAssigned,
} from "./validators.js";

const retrieveTenant = async (
  tenantId: TenantId,
  readModelService: ReadModelServiceSQL
): Promise<WithMetadata<Tenant>> => {
  const tenant = await readModelService.getTenantById(tenantId);
  if (!tenant) {
    throw tenantNotFound(tenantId);
  }
  return tenant;
};

const retrieveTenantByExternalId = async ({
  tenantOrigin,
  tenantExternalId,
  readModelService,
}: {
  tenantOrigin: string;
  tenantExternalId: string;
  readModelService: ReadModelServiceSQL;
}): Promise<WithMetadata<Tenant>> => {
  const tenant = await readModelService.getTenantByExternalId({
    origin: tenantOrigin,
    value: tenantExternalId,
  });
  if (!tenant) {
    throw tenantNotFoundByExternalId(tenantOrigin, tenantExternalId);
  }
  return tenant;
};

const retrieveTenantByRemoteId = async ({
  tenantOrigin,
  tenantRemoteId,
  readModelService,
}: {
  tenantOrigin: string;
  tenantRemoteId: string;
  readModelService: ReadModelServiceSQL;
}): Promise<WithMetadata<Tenant>> => {
  const tenant = await readModelService.getTenantByRemoteId({
    origin: tenantOrigin,
    value: tenantRemoteId,
  });
  if (!tenant) {
    throw tenantNotFoundByRemoteId(tenantOrigin, tenantRemoteId);
  }
  return tenant;
};

async function retrieveAttribute(
  attributeId: AttributeId,
  readModelService: ReadModelServiceSQL
): Promise<Attribute> {
  const attribute = await readModelService.getAttributeById(attributeId);
  if (!attribute) {
    throw attributeNotFound(attributeId);
  }
  return attribute;
}

async function retrieveTenantVerifiedAttribute(
  tenantId: TenantId,
  attributeId: AttributeId,
  readModelService: ReadModelServiceSQL
): Promise<{ tenant: WithMetadata<Tenant> }> {
  const tenant = await retrieveTenant(tenantId, readModelService);

  const tenantAttribute = tenant.data.attributes.find(
    (attr): attr is VerifiedTenantAttribute =>
      attr.type === tenantAttributeType.VERIFIED && attr.id === attributeId
  );

  if (!tenantAttribute) {
    throw attributeNotFoundInTenant(attributeId, tenantId);
  }

  return { tenant };
}

async function retrieveCertifiedAttribute({
  attributeOrigin,
  attributeExternalId,
  readModelService,
}: {
  attributeOrigin: string;
  attributeExternalId: string;
  readModelService: ReadModelServiceSQL;
}): Promise<Attribute> {
  const attribute = await readModelService.getAttributeByOriginAndCode({
    origin: attributeOrigin,
    code: attributeExternalId,
  });

  if (!attribute) {
    throw attributeNotFound(`${attributeOrigin}/${attributeExternalId}`);
  }
  return attribute;
}

async function retrieveAgreement(
  agreementId: AgreementId,
  readModelService: ReadModelServiceSQL
): Promise<Agreement> {
  const agreement = await readModelService.getAgreementById(agreementId);
  if (!agreement) {
    throw agreementNotFound(agreementId);
  }
  return agreement;
}

type CertifiedDiscreteTenantAttribute = Extract<
  TenantAttribute,
  { type: typeof tenantAttributeType.CERTIFIED_DISCRETE }
>;

function isCertifiedDiscreteTenantAttribute(
  attr: TenantAttribute,
  attributeId: AttributeId
): attr is CertifiedDiscreteTenantAttribute {
  return (
    attr.type === tenantAttributeType.CERTIFIED_DISCRETE &&
    attr.id === attributeId
  );
}

function isActiveCertifiedDiscreteTenantAttribute(
  attr: TenantAttribute,
  attributeId: AttributeId
): attr is CertifiedDiscreteTenantAttribute {
  return (
    isCertifiedDiscreteTenantAttribute(attr, attributeId) &&
    !attr.revocationTimestamp
  );
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function tenantServiceBuilder(
  dbInstance: DB,
  readModelService: ReadModelServiceSQL,
  contactDataManagerService: ContactDataManagerService
) {
  const repository = eventRepository(dbInstance, tenantEventToBinaryData);

  /**
   * Converts the tenant to write when it still holds legacy mails (see
   * legacyTenantConversion.ts). Everything that can fail (validations, the
   * tenant kind) runs before it: a contact created for a request that then
   * fails is left without references.
   */
  const convertTenantToWrite = (
    tenant: WithMetadata<Tenant>,
    ctx: { correlationId: CorrelationId; logger: Logger }
  ): Promise<LegacyTenantConversion> =>
    convertLegacyTenant(tenant, contactDataManagerService, ctx);

  /**
   * Writes the conversion events and the operation events in one transaction
   * and returns the new version of the tenant.
   */
  const createTenantEvents = async (
    conversion: LegacyTenantConversion,
    events: Array<CreateEvent<TenantEvent>>
  ): Promise<number> => {
    try {
      const { latestNewVersions } = await repository.createEvents([
        ...conversion.events,
        ...events,
      ]);
      return (
        latestNewVersions.get(conversion.tenant.data.id) ??
        conversion.tenant.metadata.version
      );
    } catch (error) {
      conversion.onWriteFailure();
      throw error;
    }
  };
  return {
    async updateVerifiedAttributeExtensionDate(
      tenantId: TenantId,
      attributeId: AttributeId,
      verifierId: string,
      { correlationId, logger }: WithLogger<AppContext<InternalAuthData>>
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

      const conversion = await convertTenantToWrite(tenant, {
        correlationId,
        logger,
      });

      const updatedTenant: Tenant = conversion.convert({
        ...tenant.data,
        attributes: [
          updatedAttribute,
          ...tenant.data.attributes.filter((a) => a.id !== updatedAttribute.id),
        ],
        updatedAt: new Date(),
      });

      const event = toCreateEventTenantVerifiedAttributeExtensionUpdated(
        tenant.data.id,
        conversion.tenant.metadata.version,
        updatedTenant,
        attributeId,
        correlationId
      );
      await createTenantEvents(conversion, [event]);
      return updatedTenant;
    },

    async updateTenantVerifiedAttribute(
      {
        tenantId,
        attributeId,
        updateVerifiedTenantAttributeSeed,
      }: {
        tenantId: TenantId;
        attributeId: AttributeId;
        updateVerifiedTenantAttributeSeed: tenantApi.UpdateVerifiedTenantAttributeSeed;
      },
      { correlationId, logger, authData }: WithLogger<AppContext<UIAuthData>>
    ): Promise<Tenant> {
      logger.info(`Update attribute ${attributeId} to tenant ${tenantId}`);
      const verifierId = authData.organizationId;
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

      const conversion = await convertTenantToWrite(tenant, {
        correlationId,
        logger,
      });

      const updatedTenant: Tenant = conversion.convert({
        ...tenant.data,
        attributes: [
          updatedAttribute,
          ...tenant.data.attributes.filter((a) => a.id !== updatedAttribute.id),
        ],
        updatedAt: new Date(),
      });
      const event = toCreateEventTenantVerifiedAttributeExpirationUpdated(
        tenant.data.id,
        conversion.tenant.metadata.version,
        updatedTenant,
        attributeId,
        correlationId
      );
      await createTenantEvents(conversion, [event]);
      return updatedTenant;
    },

    async selfcareUpsertTenant(
      tenantSeed: tenantApi.SelfcareTenantSeed,
      {
        authData,
        correlationId,
        logger,
      }: WithLogger<AppContext<UIAuthData | InternalAuthData>>
    ): Promise<TenantId> {
      logger.info(
        `Upsert tenant by selfcare with externalId: ${JSON.stringify(
          tenantSeed.externalId
        )}`
      );
      const existingTenant = await readModelService.getTenantByExternalId(
        tenantSeed.externalId
      );
      if (existingTenant) {
        logger.info(
          `Updating tenant with external id ${tenantSeed.externalId.origin}/${tenantSeed.externalId.value} via SelfCare request"`
        );

        if (isUiAuthData(authData)) {
          // TODO this check is skipped in case of calls that do not come from the UI,
          // e.g., internal calls - consider creating a dedicated internal route.
          // Double check if the non-internal case is actually exposed by BFF/API GW.
          await assertRequesterAllowed(existingTenant.data.id, authData);
        }

        evaluateNewSelfcareId({
          tenant: existingTenant.data,
          newSelfcareId: tenantSeed.selfcareId,
        });

        const tenantKind = await getTenantKindLoadingCertifiedAttributes(
          readModelService,
          existingTenant.data.attributes,
          existingTenant.data.externalId,
          existingTenant.data.selfcareInstitutionType
        );

        const conversion = await convertTenantToWrite(existingTenant, {
          correlationId,
          logger,
        });

        const updatedTenant: Tenant = conversion.convert({
          ...existingTenant.data,
          kind: tenantKind,
          selfcareId: tenantSeed.selfcareId,
          onboardedAt: new Date(tenantSeed.onboardedAt),
          selfcareInstitutionType: tenantSeed.selfcareInstitutionType,
          updatedAt: new Date(),
        });

        logger.info(
          `Creating tenant with external id ${tenantSeed.externalId} via SelfCare request"`
        );
        await createTenantEvents(conversion, [
          toCreateEventTenantOnboardDetailsUpdated(
            existingTenant.data.id,
            conversion.tenant.metadata.version,
            updatedTenant,
            correlationId
          ),
        ]);
        return existingTenant.data.id;
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
          onboardedAt: new Date(tenantSeed.onboardedAt),
          subUnitType: tenantSeed.subUnitType,
          selfcareInstitutionType: tenantSeed.selfcareInstitutionType,
          createdAt: new Date(),
          kind: match(
            getTenantKind(
              [],
              tenantSeed.externalId,
              tenantSeed.selfcareInstitutionType
            )
          )
            /**
             * If the tenant kind is SCP or PRIVATE, set the kind straight away.
             * If not, the kind will be evaluated when certified attributes are added.
             */
            .with(tenantKind.SCP, tenantKind.PRIVATE, (kind) => kind)
            .with(tenantKind.GSP, tenantKind.PA, () => undefined)
            .exhaustive(),
        };
        await repository.createEvent(
          toCreateEventTenantOnboarded(newTenant, correlationId)
        );
        return newTenant.id;
      }
    },

    async revokeDeclaredAttribute(
      { attributeId }: { attributeId: AttributeId },
      {
        authData,
        logger,
        correlationId,
      }: WithLogger<AppContext<UIAuthData | M2MAdminAuthData>>
    ): Promise<WithMetadata<Tenant>> {
      logger.info(
        `Revoking declared attribute ${attributeId} to tenant ${authData.organizationId}`
      );
      const requesterTenant = await retrieveTenant(
        authData.organizationId,
        readModelService
      );

      const declaredTenantAttribute = requesterTenant.data.attributes.find(
        (attr): attr is DeclaredTenantAttribute =>
          attr.id === attributeId && attr.type === tenantAttributeType.DECLARED
      );

      if (!declaredTenantAttribute) {
        throw attributeNotFound(attributeId);
      }

      const conversion = await convertTenantToWrite(requesterTenant, {
        correlationId,
        logger,
      });

      const updatedTenant: Tenant = conversion.convert({
        ...requesterTenant.data,
        updatedAt: new Date(),
        attributes: requesterTenant.data.attributes.map((declaredAttribute) =>
          declaredAttribute.id === attributeId
            ? {
                ...declaredAttribute,
                revocationTimestamp: new Date(),
              }
            : declaredAttribute
        ),
      });

      const newVersion = await createTenantEvents(conversion, [
        toCreateEventTenantDeclaredAttributeRevoked(
          conversion.tenant.metadata.version,
          updatedTenant,
          unsafeBrandId(attributeId),
          correlationId
        ),
      ]);
      return {
        data: updatedTenant,
        metadata: { version: newVersion },
      };
    },

    async addCertifiedAttribute(
      {
        tenantId,
        tenantAttributeSeed,
      }: {
        tenantId: TenantId;
        tenantAttributeSeed: tenantApi.CertifiedTenantAttributeSeed;
      },
      {
        authData,
        logger,
        correlationId,
      }: WithLogger<AppContext<UIAuthData | M2MAuthData | M2MAdminAuthData>>
    ): Promise<WithMetadata<Tenant>> {
      logger.info(
        `Add certified attribute ${tenantAttributeSeed.id} to tenant ${tenantId}`
      );

      const requesterTenant = await retrieveTenant(
        authData.organizationId,
        readModelService
      );

      const certifierId = retrieveCertifierId(requesterTenant.data);

      const attribute = await retrieveAttribute(
        unsafeBrandId(tenantAttributeSeed.id),
        readModelService
      );

      if (attribute.kind !== attributeKind.certified) {
        throw attributeNotFound(attribute.id);
      }

      if (!attribute.origin || attribute.origin !== certifierId) {
        throw attributeDoesNotBelongToCertifier(
          attribute.id,
          authData.organizationId,
          tenantId
        );
      }

      const targetTenant = await retrieveTenant(tenantId, readModelService);

      // Assigning an attribute already assigned fails: the conversion follows
      const tenantWithAssignedAttribute = assignCertifiedAttribute({
        targetTenant: targetTenant.data,
        attribute,
      });

      const tenantKind = await getTenantKindLoadingCertifiedAttributes(
        readModelService,
        tenantWithAssignedAttribute.attributes,
        tenantWithAssignedAttribute.externalId,
        tenantWithAssignedAttribute.selfcareInstitutionType
      );

      const conversion = await convertTenantToWrite(targetTenant, {
        correlationId,
        logger,
      });
      const tenantWithNewAttribute = conversion.convert(
        tenantWithAssignedAttribute
      );

      const tenantCertifiedAttributeAssignedEvent =
        toCreateEventTenantCertifiedAttributeAssigned(
          conversion.tenant.metadata.version,
          tenantWithNewAttribute,
          attribute.id,
          correlationId
        );

      const updatedTenant = {
        ...tenantWithNewAttribute,
        kind: tenantKind,
      };

      if (tenantWithNewAttribute.kind !== tenantKind) {
        const tenantKindUpdatedEvent = toCreateEventTenantKindUpdated(
          conversion.tenant.metadata.version + 1,
          targetTenant.data.kind,
          updatedTenant,
          correlationId
        );

        const newVersion = await createTenantEvents(conversion, [
          tenantCertifiedAttributeAssignedEvent,
          tenantKindUpdatedEvent,
        ]);

        return {
          data: updatedTenant,
          metadata: { version: newVersion },
        };
      }
      const newVersion = await createTenantEvents(conversion, [
        tenantCertifiedAttributeAssignedEvent,
      ]);
      return {
        data: updatedTenant,
        metadata: { version: newVersion },
      };
    },

    async addCertifiedDiscreteAttribute(
      {
        tenantId,
        tenantAttributeSeed,
      }: {
        tenantId: TenantId;
        tenantAttributeSeed: tenantApi.CertifiedDiscreteTenantAttributeSeed;
      },
      {
        authData,
        logger,
        correlationId,
      }: WithLogger<AppContext<UIAuthData | M2MAuthData | M2MAdminAuthData>>
    ): Promise<WithMetadata<Tenant>> {
      logger.info(
        `Add certified discrete attribute ${tenantAttributeSeed.id} to tenant ${tenantId}`
      );

      const requesterTenant = await retrieveTenant(
        authData.organizationId,
        readModelService
      );

      const certifierId = retrieveCertifierId(requesterTenant.data);

      const attribute = await retrieveAttribute(
        unsafeBrandId(tenantAttributeSeed.id),
        readModelService
      );

      if (attribute.kind !== attributeKind.certifiedDiscrete) {
        throw attributeNotFound(attribute.id);
      }

      if (!attribute.origin || attribute.origin !== certifierId) {
        throw attributeDoesNotBelongToCertifier(
          attribute.id,
          authData.organizationId,
          tenantId
        );
      }

      const targetTenant = await retrieveTenant(tenantId, readModelService);

      const existingCertifiedDiscrete = targetTenant.data.attributes.find(
        (attr): attr is CertifiedDiscreteTenantAttribute =>
          isCertifiedDiscreteTenantAttribute(attr, attribute.id)
      );

      const now = new Date();

      const buildTenantWithNewAttribute = (): Tenant => {
        if (!existingCertifiedDiscrete) {
          return {
            ...targetTenant.data,
            attributes: [
              ...targetTenant.data.attributes,
              {
                id: attribute.id,
                type: tenantAttributeType.CERTIFIED_DISCRETE,
                assignmentTimestamp: now,
                revocationTimestamp: undefined,
                discreteValue: tenantAttributeSeed.certifiedDiscreteValue,
              },
            ],
            updatedAt: now,
          };
        }

        if (existingCertifiedDiscrete.revocationTimestamp) {
          return {
            ...targetTenant.data,
            attributes: targetTenant.data.attributes.map((a) =>
              a.id === attribute.id
                ? {
                    ...a,
                    assignmentTimestamp: now,
                    revocationTimestamp: undefined,
                    discreteValue: tenantAttributeSeed.certifiedDiscreteValue,
                  }
                : a
            ),
            updatedAt: now,
          };
        }

        throw certifiedDiscreteAttributeAlreadyAssigned(
          attribute.id,
          targetTenant.data.id
        );
      };

      // Assigning an attribute already assigned fails: the conversion follows
      const tenantWithAssignedAttribute = buildTenantWithNewAttribute();

      const tenantKind = await getTenantKindLoadingCertifiedAttributes(
        readModelService,
        tenantWithAssignedAttribute.attributes,
        tenantWithAssignedAttribute.externalId,
        tenantWithAssignedAttribute.selfcareInstitutionType
      );

      const conversion = await convertTenantToWrite(targetTenant, {
        correlationId,
        logger,
      });
      const tenantWithNewAttribute = conversion.convert(
        tenantWithAssignedAttribute
      );

      const tenantCertifiedDiscreteAttributeAssignedEvent =
        toCreateEventTenantCertifiedDiscreteAttributeAssigned(
          conversion.tenant.metadata.version,
          tenantWithNewAttribute,
          attribute.id,
          correlationId
        );

      const updatedTenant = {
        ...tenantWithNewAttribute,
        kind: tenantKind,
      };

      if (tenantWithNewAttribute.kind !== tenantKind) {
        const tenantKindUpdatedEvent = toCreateEventTenantKindUpdated(
          conversion.tenant.metadata.version + 1,
          targetTenant.data.kind,
          updatedTenant,
          correlationId
        );

        const newVersion = await createTenantEvents(conversion, [
          tenantCertifiedDiscreteAttributeAssignedEvent,
          tenantKindUpdatedEvent,
        ]);

        return {
          data: updatedTenant,
          metadata: { version: newVersion },
        };
      }

      const newVersion = await createTenantEvents(conversion, [
        tenantCertifiedDiscreteAttributeAssignedEvent,
      ]);
      return {
        data: updatedTenant,
        metadata: { version: newVersion },
      };
    },

    async addDeclaredAttribute(
      {
        tenantAttributeSeed,
      }: { tenantAttributeSeed: tenantApi.DeclaredTenantAttributeSeed },
      {
        authData,
        logger,
        correlationId,
      }: WithLogger<AppContext<UIAuthData | M2MAdminAuthData>>
    ): Promise<WithMetadata<Tenant>> {
      const { tenant, delegationId } = await match(
        tenantAttributeSeed.delegationId
      )
        .with(P.nullish, async () => {
          logger.info(
            `Add declared attribute ${tenantAttributeSeed.id} to requester tenant ${authData.organizationId}`
          );
          const targetTenant = await retrieveTenant(
            authData.organizationId,
            readModelService
          );

          return { tenant: targetTenant, delegationId: undefined };
        })
        .otherwise(async (seedDelegationId) => {
          const delegationId: DelegationId = unsafeBrandId(seedDelegationId);
          const delegation =
            await readModelService.getActiveConsumerDelegation(delegationId);

          if (!delegation) {
            throw delegationNotFound(delegationId);
          }
          logger.info(
            `Add declared attribute ${tenantAttributeSeed.id} to delegator tenant ${delegation.delegatorId}`
          );

          if (delegation.delegateId !== authData.organizationId) {
            throw operationRestrictedToDelegate();
          }

          const targetTenant = await retrieveTenant(
            delegation.delegatorId,
            readModelService
          );

          return { tenant: targetTenant, delegationId };
        });

      const attribute = await retrieveAttribute(
        unsafeBrandId(tenantAttributeSeed.id),
        readModelService
      );

      if (attribute.kind !== attributeKind.declared) {
        throw attributeNotFound(attribute.id);
      }

      const declaredTenantAttribute = tenant.data.attributes.find(
        (attr): attr is DeclaredTenantAttribute =>
          attr.type === tenantAttributeType.DECLARED && attr.id === attribute.id
      );

      const conversion = await convertTenantToWrite(tenant, {
        correlationId,
        logger,
      });

      const updatedTenant: Tenant = conversion.convert({
        ...tenant.data,
        attributes: declaredTenantAttribute
          ? reassignDeclaredAttribute(
              tenant.data.attributes,
              attribute.id,
              delegationId
            )
          : assignDeclaredAttribute(
              tenant.data.attributes,
              attribute.id,
              delegationId
            ),
        updatedAt: new Date(),
      });

      const newVersion = await createTenantEvents(conversion, [
        toCreateEventTenantDeclaredAttributeAssigned(
          conversion.tenant.metadata.version,
          updatedTenant,
          unsafeBrandId(tenantAttributeSeed.id),
          correlationId
        ),
      ]);

      return {
        data: updatedTenant,
        metadata: { version: newVersion },
      };
    },

    async revokeCertifiedAttributeById(
      {
        tenantId,
        attributeId,
      }: {
        tenantId: TenantId;
        attributeId: AttributeId;
      },
      {
        authData,
        correlationId,
        logger,
      }: WithLogger<AppContext<UIAuthData | M2MAuthData | M2MAdminAuthData>>
    ): Promise<WithMetadata<Tenant>> {
      logger.info(
        `Revoke certified attribute ${attributeId} to tenantId ${tenantId}`
      );
      const requesterTenant = await retrieveTenant(
        authData.organizationId,
        readModelService
      );

      const certifierId = retrieveCertifierId(requesterTenant.data);

      const attribute = await retrieveAttribute(attributeId, readModelService);

      if (attribute.kind !== attributeKind.certified) {
        throw attributeNotFound(attribute.id);
      }

      if (!attribute.origin || attribute.origin !== certifierId) {
        throw attributeDoesNotBelongToCertifier(
          attribute.id,
          authData.organizationId,
          tenantId
        );
      }

      const targetTenant = await retrieveTenant(tenantId, readModelService);

      const certifiedTenantAttribute = targetTenant.data.attributes.find(
        (attr): attr is CertifiedTenantAttribute =>
          attr.type === tenantAttributeType.CERTIFIED && attr.id === attributeId
      );

      if (!certifiedTenantAttribute) {
        throw attributeNotFound(attributeId);
      }

      if (certifiedTenantAttribute.revocationTimestamp) {
        throw attributeAlreadyRevoked(
          tenantId,
          authData.organizationId,
          attributeId
        );
      }

      const tenantAfterRevocation = await revokeCertifiedAttribute(
        targetTenant.data,
        attributeId
      );

      const tenantKind = await getTenantKindLoadingCertifiedAttributes(
        readModelService,
        tenantAfterRevocation.attributes,
        tenantAfterRevocation.externalId,
        tenantAfterRevocation.selfcareInstitutionType
      );

      const conversion = await convertTenantToWrite(targetTenant, {
        correlationId,
        logger,
      });

      const tenantWithRevokedAttribute: Tenant = conversion.convert(
        tenantAfterRevocation
      );

      const tenantCertifiedAttributeRevokedEvent =
        toCreateEventTenantCertifiedAttributeRevoked(
          conversion.tenant.metadata.version,
          tenantWithRevokedAttribute,
          attributeId,
          correlationId
        );

      if (tenantWithRevokedAttribute.kind !== tenantKind) {
        const updatedTenant = {
          ...tenantWithRevokedAttribute,
          kind: tenantKind,
        };

        const tenantKindUpdatedEvent = toCreateEventTenantKindUpdated(
          conversion.tenant.metadata.version + 1,
          targetTenant.data.kind,
          updatedTenant,
          correlationId
        );

        const newVersion = await createTenantEvents(conversion, [
          tenantCertifiedAttributeRevokedEvent,
          tenantKindUpdatedEvent,
        ]);

        return {
          data: updatedTenant,
          metadata: { version: newVersion },
        };
      }

      const newVersion = await createTenantEvents(conversion, [
        tenantCertifiedAttributeRevokedEvent,
      ]);
      return {
        data: tenantWithRevokedAttribute,
        metadata: { version: newVersion },
      };
    },

    async revokeCertifiedDiscreteAttributeById(
      {
        tenantId,
        attributeId,
      }: {
        tenantId: TenantId;
        attributeId: AttributeId;
      },
      {
        authData,
        correlationId,
        logger,
      }: WithLogger<AppContext<UIAuthData | M2MAuthData | M2MAdminAuthData>>
    ): Promise<WithMetadata<Tenant>> {
      logger.info(
        `Revoke certified discrete attribute ${attributeId} from tenant ${tenantId}`
      );
      const requesterTenant = await retrieveTenant(
        authData.organizationId,
        readModelService
      );

      const certifierId = retrieveCertifierId(requesterTenant.data);

      const attribute = await retrieveAttribute(attributeId, readModelService);

      if (attribute.kind !== attributeKind.certifiedDiscrete) {
        throw attributeNotFound(attribute.id);
      }

      if (!attribute.origin || attribute.origin !== certifierId) {
        throw attributeDoesNotBelongToCertifier(
          attribute.id,
          authData.organizationId,
          tenantId
        );
      }

      const targetTenant = await retrieveTenant(tenantId, readModelService);

      const certifiedTenantAttribute = targetTenant.data.attributes.find(
        (attr): attr is CertifiedDiscreteTenantAttribute =>
          isCertifiedDiscreteTenantAttribute(attr, attributeId)
      );

      if (!certifiedTenantAttribute) {
        throw attributeNotFound(attributeId);
      }

      if (certifiedTenantAttribute.revocationTimestamp) {
        throw attributeAlreadyRevoked(
          tenantId,
          authData.organizationId,
          attributeId
        );
      }

      const tenantAfterRevocation = await revokeCertifiedAttribute(
        targetTenant.data,
        attributeId
      );

      const tenantKind = await getTenantKindLoadingCertifiedAttributes(
        readModelService,
        tenantAfterRevocation.attributes,
        tenantAfterRevocation.externalId,
        tenantAfterRevocation.selfcareInstitutionType
      );

      const conversion = await convertTenantToWrite(targetTenant, {
        correlationId,
        logger,
      });

      const tenantWithRevokedAttribute: Tenant = conversion.convert(
        tenantAfterRevocation
      );

      const tenantCertifiedAttributeRevokedEvent =
        toCreateEventTenantCertifiedDiscreteAttributeRevoked(
          conversion.tenant.metadata.version,
          tenantWithRevokedAttribute,
          attributeId,
          correlationId
        );

      if (tenantWithRevokedAttribute.kind !== tenantKind) {
        const updatedTenant = {
          ...tenantWithRevokedAttribute,
          kind: tenantKind,
        };

        const tenantKindUpdatedEvent = toCreateEventTenantKindUpdated(
          conversion.tenant.metadata.version + 1,
          targetTenant.data.kind,
          updatedTenant,
          correlationId
        );

        const newVersion = await createTenantEvents(conversion, [
          tenantCertifiedAttributeRevokedEvent,
          tenantKindUpdatedEvent,
        ]);

        return {
          data: updatedTenant,
          metadata: { version: newVersion },
        };
      }

      const newVersion = await createTenantEvents(conversion, [
        tenantCertifiedAttributeRevokedEvent,
      ]);

      return {
        data: tenantWithRevokedAttribute,
        metadata: { version: newVersion },
      };
    },

    async updateCertifiedDiscreteAttributeById(
      {
        tenantId,
        attributeId,
        tenantAttributeSeed,
      }: {
        tenantId: TenantId;
        attributeId: AttributeId;
        tenantAttributeSeed: tenantApi.UpdateCertifiedDiscreteTenantAttributeSeed;
      },
      {
        authData,
        correlationId,
        logger,
      }: WithLogger<AppContext<UIAuthData | M2MAuthData | M2MAdminAuthData>>
    ): Promise<WithMetadata<Tenant>> {
      const newValue = tenantAttributeSeed.certifiedDiscreteValue;

      logger.info(
        `Update certified discrete attribute ${attributeId} to value ${newValue} for tenant ${tenantId}`
      );

      const requesterTenant = await retrieveTenant(
        authData.organizationId,
        readModelService
      );

      const certifierId = retrieveCertifierId(requesterTenant.data);

      const attribute = await retrieveAttribute(attributeId, readModelService);

      if (attribute.kind !== attributeKind.certifiedDiscrete) {
        throw attributeNotFound(attribute.id);
      }

      if (!attribute.origin || attribute.origin !== certifierId) {
        throw attributeDoesNotBelongToCertifier(
          attribute.id,
          authData.organizationId,
          tenantId
        );
      }

      const targetTenant = await retrieveTenant(tenantId, readModelService);

      const certifiedTenantAttribute = targetTenant.data.attributes.find(
        (attr): attr is CertifiedDiscreteTenantAttribute =>
          isCertifiedDiscreteTenantAttribute(attr, attributeId)
      );

      if (!certifiedTenantAttribute) {
        throw attributeNotFound(attributeId);
      }

      if (certifiedTenantAttribute.revocationTimestamp) {
        throw certifiedDiscreteAttributeRevoked(tenantId, attributeId);
      }

      const previousValue = certifiedTenantAttribute.discreteValue;

      if (previousValue === newValue) {
        return {
          data: targetTenant.data,
          metadata: { version: targetTenant.metadata.version },
        };
      }

      const updatedAttributes = targetTenant.data.attributes.map((a) =>
        isCertifiedDiscreteTenantAttribute(a, attributeId)
          ? { ...a, discreteValue: newValue }
          : a
      );

      const tenantKind = await getTenantKindLoadingCertifiedAttributes(
        readModelService,
        updatedAttributes,
        targetTenant.data.externalId,
        targetTenant.data.selfcareInstitutionType
      );

      const conversion = await convertTenantToWrite(targetTenant, {
        correlationId,
        logger,
      });

      const tenantWithUpdatedAttribute: Tenant = conversion.convert({
        ...targetTenant.data,
        attributes: updatedAttributes,
        updatedAt: new Date(),
      });

      const tenantCertifiedDiscreteAttributeUpdatedEvent =
        toCreateEventTenantCertifiedDiscreteAttributeUpdated(
          conversion.tenant.metadata.version,
          tenantWithUpdatedAttribute,
          attributeId,
          previousValue,
          newValue,
          correlationId
        );

      if (tenantWithUpdatedAttribute.kind !== tenantKind) {
        const updatedTenant = {
          ...tenantWithUpdatedAttribute,
          kind: tenantKind,
        };

        const tenantKindUpdatedEvent = toCreateEventTenantKindUpdated(
          conversion.tenant.metadata.version + 1,
          targetTenant.data.kind,
          updatedTenant,
          correlationId
        );

        const newVersion = await createTenantEvents(conversion, [
          tenantCertifiedDiscreteAttributeUpdatedEvent,
          tenantKindUpdatedEvent,
        ]);

        return {
          data: updatedTenant,
          metadata: { version: newVersion },
        };
      }

      const newVersion = await createTenantEvents(conversion, [
        tenantCertifiedDiscreteAttributeUpdatedEvent,
      ]);

      return {
        data: tenantWithUpdatedAttribute,
        metadata: { version: newVersion },
      };
    },

    async verifyVerifiedAttribute(
      {
        tenantId,
        attributeId,
        agreementId,
        expirationDate,
      }: {
        tenantId: TenantId;
        attributeId: AttributeId;
        agreementId: AgreementId;
        expirationDate?: string;
      },
      {
        authData,
        logger,
        correlationId,
      }: WithLogger<AppContext<UIAuthData | M2MAdminAuthData>>
    ): Promise<WithMetadata<Tenant>> {
      logger.info(
        `Verifying attribute ${attributeId} to tenant ${tenantId} for agreement ${agreementId}`
      );

      const agreement = await retrieveAgreement(agreementId, readModelService);

      const error = attributeVerificationNotAllowed(tenantId, attributeId);

      const allowedStatuses: AgreementState[] = [
        agreementState.pending,
        agreementState.active,
        agreementState.suspended,
      ];

      if (!allowedStatuses.includes(agreement.state)) {
        throw error;
      }

      const producerDelegation =
        await readModelService.getActiveProducerDelegationByEservice(
          agreement.eserviceId
        );

      await assertVerifiedAttributeOperationAllowed({
        requesterId: authData.organizationId,
        producerDelegation,
        attributeId,
        agreement,
        readModelService,
        error,
      });

      const verifierId = agreement.producerId;

      if (verifierId === tenantId) {
        throw verifiedAttributeSelfVerificationNotAllowed();
      }

      const targetTenant = await retrieveTenant(tenantId, readModelService);

      const attribute = await retrieveAttribute(attributeId, readModelService);

      if (attribute.kind !== attributeKind.verified) {
        throw attributeNotFound(attribute.id);
      }

      const verifiedTenantAttribute = targetTenant.data.attributes.find(
        (attr): attr is VerifiedTenantAttribute =>
          attr.type === tenantAttributeType.VERIFIED && attr.id === attribute.id
      );

      // An expiration date in the past fails: the conversion follows
      const tenantWithVerifiedAttribute: Tenant = {
        ...targetTenant.data,
        attributes: verifiedTenantAttribute
          ? reassignVerifiedAttribute(
              targetTenant.data.attributes,
              verifiedTenantAttribute,
              verifierId,
              producerDelegation?.id,
              expirationDate
            )
          : assignVerifiedAttribute(
              targetTenant.data.attributes,
              verifierId,
              producerDelegation?.id,
              attributeId,
              expirationDate
            ),

        updatedAt: new Date(),
      };

      const conversion = await convertTenantToWrite(targetTenant, {
        correlationId,
        logger,
      });
      const updatedTenant = conversion.convert(tenantWithVerifiedAttribute);

      const newVersion = await createTenantEvents(conversion, [
        toCreateEventTenantVerifiedAttributeAssigned(
          conversion.tenant.metadata.version,
          updatedTenant,
          attributeId,
          correlationId
        ),
      ]);
      return {
        data: updatedTenant,
        metadata: { version: newVersion },
      };
    },

    async revokeVerifiedAttribute(
      {
        tenantId,
        attributeId,
        agreementId,
      }: {
        tenantId: TenantId;
        attributeId: AttributeId;
        agreementId: AgreementId;
      },
      {
        logger,
        authData,
        correlationId,
      }: WithLogger<AppContext<UIAuthData | M2MAdminAuthData>>
    ): Promise<WithMetadata<Tenant>> {
      logger.info(
        `Revoking verified attribute ${attributeId} to tenant ${tenantId}`
      );

      const targetTenant = await retrieveTenant(tenantId, readModelService);
      const agreement = await retrieveAgreement(agreementId, readModelService);

      const error = attributeRevocationNotAllowed(tenantId, attributeId);

      const allowedStatuses: AgreementState[] = [
        agreementState.pending,
        agreementState.active,
        agreementState.suspended,
      ];

      if (!allowedStatuses.includes(agreement.state)) {
        throw error;
      }

      const producerDelegation =
        await readModelService.getActiveProducerDelegationByEservice(
          agreement.eserviceId
        );

      await assertVerifiedAttributeOperationAllowed({
        requesterId: authData.organizationId,
        producerDelegation,
        attributeId,
        agreement,
        readModelService,
        error,
      });

      const revokerId = agreement.producerId;

      if (revokerId === tenantId) {
        throw verifiedAttributeSelfRevocationNotAllowed();
      }

      const verifiedTenantAttribute = targetTenant.data.attributes.find(
        (attr): attr is VerifiedTenantAttribute =>
          attr.type === tenantAttributeType.VERIFIED && attr.id === attributeId
      );

      if (!verifiedTenantAttribute) {
        throw attributeNotFound(attributeId);
      }

      const verifier = verifiedTenantAttribute.verifiedBy.find(
        (a) => a.id === revokerId
      );

      if (!verifier) {
        throw error;
      }

      const isInRevokedBy = verifiedTenantAttribute.revokedBy.some(
        (a) => a.id === revokerId
      );

      if (isInRevokedBy) {
        throw attributeAlreadyRevoked(tenantId, revokerId, attributeId);
      }

      const conversion = await convertTenantToWrite(targetTenant, {
        correlationId,
        logger,
      });

      const updatedTenant: Tenant = conversion.convert({
        ...targetTenant.data,
        updatedAt: new Date(),
        attributes: targetTenant.data.attributes.map((attr) =>
          attr.id === attributeId
            ? ({
                ...verifiedTenantAttribute,
                verifiedBy: verifiedTenantAttribute.verifiedBy.filter(
                  (v) => v.id !== revokerId
                ),
                revokedBy: [
                  ...verifiedTenantAttribute.revokedBy,
                  {
                    ...verifier,
                    id: revokerId,
                    delegationId: producerDelegation?.id,
                    revocationDate: new Date(),
                  },
                ],
              } satisfies VerifiedTenantAttribute)
            : attr
        ),
      });

      const newVersion = await createTenantEvents(conversion, [
        toCreateEventTenantVerifiedAttributeRevoked(
          conversion.tenant.metadata.version,
          updatedTenant,
          attributeId,
          correlationId
        ),
      ]);

      return {
        data: updatedTenant,
        metadata: { version: newVersion },
      };
    },

    async internalAssignCertifiedAttribute(
      {
        tenantOrigin,
        tenantExternalId,
        attributeOrigin,
        attributeExternalId,
      }: {
        tenantOrigin: string;
        tenantExternalId: string;
        attributeOrigin: string;
        attributeExternalId: string;
      },
      { logger, correlationId }: WithLogger<AppContext<InternalAuthData>>
    ): Promise<{ version: number }> {
      logger.info(
        `Assigning certified attribute (${attributeOrigin}/${attributeExternalId}) to tenant (${tenantOrigin}/${tenantExternalId})`
      );

      const tenantToModify = await retrieveTenantByExternalId({
        tenantOrigin,
        tenantExternalId,
        readModelService,
      });

      const attributeToAssign = await retrieveCertifiedAttribute({
        attributeOrigin,
        attributeExternalId,
        readModelService,
      });

      // Assigning an attribute already assigned fails: the conversion follows
      const tenantWithAssignedAttribute = assignCertifiedAttribute({
        targetTenant: tenantToModify.data,
        attribute: attributeToAssign,
      });

      const tenantKind = await getTenantKindLoadingCertifiedAttributes(
        readModelService,
        tenantWithAssignedAttribute.attributes,
        tenantWithAssignedAttribute.externalId,
        tenantWithAssignedAttribute.selfcareInstitutionType
      );

      const conversion = await convertTenantToWrite(tenantToModify, {
        correlationId,
        logger,
      });
      const tenantWithNewAttribute = conversion.convert(
        tenantWithAssignedAttribute
      );

      const tenantCertifiedAttributeAssignedEvent =
        toCreateEventTenantCertifiedAttributeAssigned(
          conversion.tenant.metadata.version,
          tenantWithNewAttribute,
          attributeToAssign.id,
          correlationId
        );

      if (tenantWithNewAttribute.kind !== tenantKind) {
        const updatedTenant: Tenant = {
          ...tenantWithNewAttribute,
          kind: tenantKind,
        };

        const tenantKindUpdatedEvent = toCreateEventTenantKindUpdated(
          conversion.tenant.metadata.version + 1,
          tenantToModify.data.kind,
          updatedTenant,
          correlationId
        );

        const newVersion = await createTenantEvents(conversion, [
          tenantCertifiedAttributeAssignedEvent,
          tenantKindUpdatedEvent,
        ]);
        return { version: newVersion };
      } else {
        const newVersion = await createTenantEvents(conversion, [
          tenantCertifiedAttributeAssignedEvent,
        ]);
        return { version: newVersion };
      }
    },

    async internalRevokeCertifiedAttribute(
      {
        tenantOrigin,
        tenantExternalId,
        attributeOrigin,
        attributeExternalId,
      }: {
        tenantOrigin: string;
        tenantExternalId: string;
        attributeOrigin: string;
        attributeExternalId: string;
      },
      { logger, correlationId }: WithLogger<AppContext<InternalAuthData>>
    ): Promise<{ version: number }> {
      logger.info(
        `Revoking certified attribute (${attributeOrigin}/${attributeExternalId}) from tenant (${tenantOrigin}/${tenantExternalId})`
      );

      const tenantToModify = await retrieveTenantByExternalId({
        tenantOrigin,
        tenantExternalId,
        readModelService,
      });

      const attributeToRevoke = await retrieveCertifiedAttribute({
        attributeOrigin,
        attributeExternalId,
        readModelService,
      });

      const certifiedAttribute = tenantToModify.data.attributes.find(
        (attr): attr is CertifiedTenantAttribute =>
          attr.type === tenantAttributeType.CERTIFIED &&
          attr.id === attributeToRevoke.id
      );

      if (!certifiedAttribute) {
        throw attributeNotFoundInTenant(
          attributeToRevoke.id,
          tenantToModify.data.id
        );
      }

      const tenantAfterRevocation = await revokeCertifiedAttribute(
        tenantToModify.data,
        attributeToRevoke.id
      );

      const tenantKind = await getTenantKindLoadingCertifiedAttributes(
        readModelService,
        tenantAfterRevocation.attributes,
        tenantAfterRevocation.externalId,
        tenantAfterRevocation.selfcareInstitutionType
      );

      const conversion = await convertTenantToWrite(tenantToModify, {
        correlationId,
        logger,
      });

      const tenantWithRevokedAttribute = conversion.convert(
        tenantAfterRevocation
      );

      const tenantCertifiedAttributeRevokedEvent =
        toCreateEventTenantCertifiedAttributeRevoked(
          conversion.tenant.metadata.version,
          tenantWithRevokedAttribute,
          attributeToRevoke.id,
          correlationId
        );

      if (tenantWithRevokedAttribute.kind !== tenantKind) {
        const updatedTenant: Tenant = {
          ...tenantWithRevokedAttribute,
          kind: tenantKind,
        };
        const tenantKindUpdatedEvent = toCreateEventTenantKindUpdated(
          conversion.tenant.metadata.version + 1,
          tenantToModify.data.kind,
          updatedTenant,
          correlationId
        );

        const newVersion = await createTenantEvents(conversion, [
          tenantCertifiedAttributeRevokedEvent,
          tenantKindUpdatedEvent,
        ]);
        return { version: newVersion };
      } else {
        const newVersion = await createTenantEvents(conversion, [
          tenantCertifiedAttributeRevokedEvent,
        ]);
        return { version: newVersion };
      }
    },
    async internalAssignCertifiedDiscreteAttribute(
      {
        tenantOrigin,
        tenantRemoteId,
        attributeOrigin,
        attributeExternalId,
        value,
      }: {
        tenantOrigin: string;
        tenantRemoteId: string;
        attributeOrigin: string;
        attributeExternalId: string;
        value: number;
      },
      { logger, correlationId }: WithLogger<AppContext<InternalAuthData>>
    ): Promise<{ version: number }> {
      logger.info(
        `Assigning certified discrete attribute (${attributeOrigin}/${attributeExternalId}) with value ${value} to tenant (${tenantOrigin}/${tenantRemoteId})`
      );

      const tenantToModify = await retrieveTenantByRemoteId({
        tenantOrigin,
        tenantRemoteId,
        readModelService,
      });

      const attributeToAssign = await retrieveCertifiedAttribute({
        attributeOrigin,
        attributeExternalId,
        readModelService,
      });

      const isAlreadyAssigned = tenantToModify.data.attributes.some(
        (a) =>
          a.id === attributeToAssign.id &&
          (!("revocationTimestamp" in a) || !a.revocationTimestamp)
      );

      if (isAlreadyAssigned) {
        throw certifiedDiscreteAttributeAlreadyAssigned(
          attributeToAssign.id,
          tenantToModify.data.id
        );
      }

      const newAttributes = [
        ...tenantToModify.data.attributes,
        {
          id: attributeToAssign.id,
          type: tenantAttributeType.CERTIFIED_DISCRETE,
          assignmentTimestamp: new Date(),
          revocationTimestamp: undefined,
          discreteValue: value,
        },
      ];

      const tenantKind = await getTenantKindLoadingCertifiedAttributes(
        readModelService,
        newAttributes,
        tenantToModify.data.externalId,
        tenantToModify.data.selfcareInstitutionType
      );

      const conversion = await convertTenantToWrite(tenantToModify, {
        correlationId,
        logger,
      });

      const tenantWithNewAttribute: Tenant = conversion.convert({
        ...tenantToModify.data,
        attributes: newAttributes,
        updatedAt: new Date(),
      });

      const primaryEvent =
        toCreateEventTenantCertifiedDiscreteAttributeAssigned(
          conversion.tenant.metadata.version,
          tenantWithNewAttribute,
          attributeToAssign.id,
          correlationId
        );

      if (tenantWithNewAttribute.kind !== tenantKind) {
        const updatedTenant: Tenant = {
          ...tenantWithNewAttribute,
          kind: tenantKind,
        };

        const tenantKindUpdatedEvent = toCreateEventTenantKindUpdated(
          conversion.tenant.metadata.version + 1,
          tenantToModify.data.kind,
          updatedTenant,
          correlationId
        );

        const newVersion = await createTenantEvents(conversion, [
          primaryEvent,
          tenantKindUpdatedEvent,
        ]);
        return { version: newVersion };
      } else {
        const newVersion = await createTenantEvents(conversion, [primaryEvent]);
        return { version: newVersion };
      }
    },

    async internalUpdateCertifiedDiscreteAttribute(
      {
        tenantOrigin,
        tenantRemoteId,
        attributeOrigin,
        attributeExternalId,
        value,
      }: {
        tenantOrigin: string;
        tenantRemoteId: string;
        attributeOrigin: string;
        attributeExternalId: string;
        value: number;
      },
      { logger, correlationId }: WithLogger<AppContext<InternalAuthData>>
    ): Promise<{ version: number }> {
      logger.info(
        `Updating certified discrete attribute (${attributeOrigin}/${attributeExternalId}) to value ${value} for tenant (${tenantOrigin}/${tenantRemoteId})`
      );

      const tenantToModify = await retrieveTenantByRemoteId({
        tenantOrigin,
        tenantRemoteId,
        readModelService,
      });

      const attributeToUpdate = await retrieveCertifiedAttribute({
        attributeOrigin,
        attributeExternalId,
        readModelService,
      });

      const existingAttribute = tenantToModify.data.attributes.find(
        (a) =>
          a.id === attributeToUpdate.id &&
          (!("revocationTimestamp" in a) || !a.revocationTimestamp)
      );

      if (
        !existingAttribute ||
        existingAttribute.type !== tenantAttributeType.CERTIFIED_DISCRETE
      ) {
        throw attributeNotFoundInTenant(
          attributeToUpdate.id,
          tenantToModify.data.id
        );
      }

      const previousValue = existingAttribute.discreteValue ?? 0;

      if (!existingAttribute) {
        throw attributeNotFoundInTenant(
          attributeToUpdate.id,
          tenantToModify.data.id
        );
      }

      if (previousValue === value) {
        logger.info(
          `Attribute ${attributeToUpdate.id} already assigned to tenant ${tenantToModify.data.id} with the same value (${value}). Skipping update.`
        );
        return { version: tenantToModify.metadata.version };
      }

      const newAttributes = tenantToModify.data.attributes.map((a) =>
        a.id === attributeToUpdate.id &&
        (!("revocationTimestamp" in a) || !a.revocationTimestamp)
          ? { ...a, discreteValue: value }
          : a
      );

      const tenantKind = await getTenantKindLoadingCertifiedAttributes(
        readModelService,
        newAttributes,
        tenantToModify.data.externalId,
        tenantToModify.data.selfcareInstitutionType
      );

      const conversion = await convertTenantToWrite(tenantToModify, {
        correlationId,
        logger,
      });

      const tenantWithUpdatedAttribute: Tenant = conversion.convert({
        ...tenantToModify.data,
        attributes: newAttributes,
        updatedAt: new Date(),
      });

      const updateEvent = toCreateEventTenantCertifiedDiscreteAttributeUpdated(
        conversion.tenant.metadata.version,
        tenantWithUpdatedAttribute,
        attributeToUpdate.id,
        previousValue,
        value,
        correlationId
      );

      if (tenantWithUpdatedAttribute.kind !== tenantKind) {
        const updatedTenant: Tenant = {
          ...tenantWithUpdatedAttribute,
          kind: tenantKind,
        };

        const tenantKindUpdatedEvent = toCreateEventTenantKindUpdated(
          conversion.tenant.metadata.version + 1,
          tenantToModify.data.kind,
          updatedTenant,
          correlationId
        );

        const newVersion = await createTenantEvents(conversion, [
          updateEvent,
          tenantKindUpdatedEvent,
        ]);
        return { version: newVersion };
      } else {
        const newVersion = await createTenantEvents(conversion, [updateEvent]);
        return { version: newVersion };
      }
    },

    async internalRevokeCertifiedDiscreteAttribute(
      {
        tenantOrigin,
        tenantRemoteId,
        attributeOrigin,
        attributeExternalId,
      }: {
        tenantOrigin: string;
        tenantRemoteId: string;
        attributeOrigin: string;
        attributeExternalId: string;
      },
      { logger, correlationId }: WithLogger<AppContext<InternalAuthData>>
    ): Promise<{ version: number }> {
      logger.info(
        `Revoking certified discrete attribute (${attributeOrigin}/${attributeExternalId}) from tenant (${tenantOrigin}/${tenantRemoteId})`
      );

      const tenantToModify = await retrieveTenantByRemoteId({
        tenantOrigin,
        tenantRemoteId,
        readModelService,
      });

      const attributeToRevoke = await retrieveCertifiedAttribute({
        attributeOrigin,
        attributeExternalId,
        readModelService,
      });

      const certifiedAttribute = tenantToModify.data.attributes.find((attr) =>
        isActiveCertifiedDiscreteTenantAttribute(attr, attributeToRevoke.id)
      );

      if (!certifiedAttribute) {
        throw attributeNotFoundInTenant(
          attributeToRevoke.id,
          tenantToModify.data.id
        );
      }

      const tenantAfterRevocation = await revokeCertifiedAttribute(
        tenantToModify.data,
        attributeToRevoke.id
      );

      const tenantKind = await getTenantKindLoadingCertifiedAttributes(
        readModelService,
        tenantAfterRevocation.attributes,
        tenantAfterRevocation.externalId,
        tenantAfterRevocation.selfcareInstitutionType
      );

      const conversion = await convertTenantToWrite(tenantToModify, {
        correlationId,
        logger,
      });

      const tenantWithRevokedAttribute = conversion.convert(
        tenantAfterRevocation
      );

      const tenantCertifiedAttributeRevokedEvent =
        toCreateEventTenantCertifiedDiscreteAttributeRevoked(
          conversion.tenant.metadata.version,
          tenantWithRevokedAttribute,
          attributeToRevoke.id,
          correlationId
        );

      if (tenantWithRevokedAttribute.kind !== tenantKind) {
        const updatedTenant: Tenant = {
          ...tenantWithRevokedAttribute,
          kind: tenantKind,
        };
        const tenantKindUpdatedEvent = toCreateEventTenantKindUpdated(
          conversion.tenant.metadata.version + 1,
          tenantToModify.data.kind,
          updatedTenant,
          correlationId
        );

        const newVersion = await createTenantEvents(conversion, [
          tenantCertifiedAttributeRevokedEvent,
          tenantKindUpdatedEvent,
        ]);
        return { version: newVersion };
      } else {
        const newVersion = await createTenantEvents(conversion, [
          tenantCertifiedAttributeRevokedEvent,
        ]);
        return { version: newVersion };
      }
    },
    async getCertifiedAttributesByCertifier(
      {
        offset,
        limit,
      }: {
        offset: number;
        limit: number;
      },
      { authData, logger }: WithLogger<AppContext<UIAuthData | M2MAuthData>>
    ): Promise<ListResult<tenantApi.CertifiedAttribute>> {
      logger.info(
        `Retrieving certified attributes for organization ${authData.organizationId}`
      );
      const tenant = await retrieveTenant(
        authData.organizationId,
        readModelService
      );

      const certifierId = retrieveCertifierId(tenant.data);

      return await readModelService.getCertifiedAttributesByCertifier({
        certifierId,
        offset,
        limit,
      });
    },

    async maintenanceTenantDelete(
      {
        tenantId,
        version,
      }: {
        tenantId: TenantId;
        version: number;
      },
      { logger, correlationId }: WithLogger<AppContext<MaintenanceAuthData>>
    ): Promise<void> {
      logger.info(`Deleting Tenant ${tenantId}`);

      const tenant = await retrieveTenant(tenantId, readModelService);

      // The tenant is deleted: its legacy mails, if any, are dropped without
      // creating a contact
      await repository.createEvent(
        toCreateEventMaintenanceTenantDeleted(
          version,
          { ...tenant.data, mails: [] },
          correlationId
        )
      );
    },

    async maintenanceTenantDeleteRemoteId(
      {
        tenantId,
        origin,
      }: {
        tenantId: TenantId;
        origin: string;
      },
      { logger, correlationId }: WithLogger<AppContext<MaintenanceAuthData>>
    ): Promise<void> {
      logger.info(
        `Deleting remote id with origin ${origin} from Tenant ${tenantId}`
      );

      const tenant = await retrieveTenant(tenantId, readModelService);

      if (!tenant.data.remoteIds?.some((r) => r.origin === origin)) {
        return;
      }

      const conversion = await convertTenantToWrite(tenant, {
        correlationId,
        logger,
      });

      const updatedTenant: Tenant = conversion.convert({
        ...tenant.data,
        remoteIds: (tenant.data.remoteIds ?? []).filter(
          (r) => r.origin !== origin
        ),
        updatedAt: new Date(),
      });

      await createTenantEvents(conversion, [
        toCreateEventMaintenanceTenantRemoteIdDeleted(
          conversion.tenant.metadata.version,
          updatedTenant,
          correlationId
        ),
      ]);
    },

    async maintenanceTenantUpdate(
      {
        tenantId,
        tenantUpdate,
        version,
      }: {
        tenantId: TenantId;
        tenantUpdate: tenantApi.MaintenanceTenantUpdate;
        version: number;
      },
      { logger, correlationId }: WithLogger<AppContext<MaintenanceAuthData>>
    ): Promise<void> {
      logger.info(`Maintenance update Tenant ${tenantId}`);

      const {
        features: apiFeatures,
        contactId,
        ...restTenantUpdate
      } = tenantUpdate;

      // The tenant contact is managed by contactId: V3 events carry no mails
      if (restTenantUpdate.mails.length > 0) {
        throw tenantMailsNotAllowed(tenantId);
      }

      const tenant = await retrieveTenant(tenantId, readModelService);

      if (version !== tenant.metadata.version) {
        throw tenantUpdateVersionMismatch(
          tenantId,
          tenant.metadata.version,
          version
        );
      }

      // The features are validated before the conversion
      const features = apiFeatures?.map(fromApiTenantFeature);

      // A contact set by the update replaces the legacy mails, if any: no
      // contact is created from them
      const conversion =
        contactId === undefined
          ? await convertTenantToWrite(tenant, { correlationId, logger })
          : noLegacyTenantConversion(tenant);

      const convertedTenantUpdate = {
        ...restTenantUpdate,
        mails: [],
        onboardedAt: new Date(restTenantUpdate.onboardedAt),
      };

      const updatedTenant: Tenant = {
        ...conversion.tenant.data,
        ...convertedTenantUpdate,
        subUnitType: convertedTenantUpdate.subUnitType,
        selfcareInstitutionType: convertedTenantUpdate.selfcareInstitutionType,
        ...(features !== undefined && { features }),
        ...(contactId !== undefined && {
          contactId: unsafeBrandId<ContactId>(contactId),
        }),
        updatedAt: new Date(),
      };

      await createTenantEvents(conversion, [
        toCreateEventMaintenanceTenantUpdated(
          conversion.tenant.metadata.version,
          updatedTenant,
          correlationId
        ),
      ]);
    },

    async deleteTenantMailById(
      {
        tenantId,
        mailId,
      }: {
        tenantId: TenantId;
        mailId: string;
      },
      { logger }: WithLogger<AppContext<UIAuthData>>
    ): Promise<void> {
      logger.info(`Deleting mail ${mailId} to Tenant ${tenantId}`);

      // The tenant contact is managed by contactId: V3 events carry no mails
      throw tenantMailsNotAllowed(tenantId);
    },

    async addTenantMail(
      {
        tenantId,
        mailSeed,
      }: {
        tenantId: TenantId;
        mailSeed: tenantApi.MailSeed;
      },
      { logger }: WithLogger<AppContext<UIAuthData>>
    ): Promise<void> {
      logger.info(`Adding mail of kind ${mailSeed.kind} to Tenant ${tenantId}`);

      // The tenant contact is managed by contactId: V3 events carry no mails
      throw tenantMailsNotAllowed(tenantId);
    },

    async addTenantContact(
      {
        tenantId,
        contactId,
      }: {
        tenantId: TenantId;
        contactId: ContactId;
      },
      {
        authData,
        logger,
        correlationId,
      }: WithLogger<AppContext<UIAuthData | M2MAdminAuthData>>
    ): Promise<WithMetadata<Tenant>> {
      logger.info(`Adding contact ${contactId} to Tenant ${tenantId}`);

      await assertRequesterAllowed(tenantId, authData);

      const tenant = await retrieveTenant(tenantId, readModelService);

      if (tenant.data.contactId === contactId) {
        throw tenantContactAlreadyAssigned(tenantId, contactId);
      }

      // A single contact per tenant: adding a new one replaces the current one.
      // It replaces the legacy mails too, with no contact created from them.
      const updatedTenant: Tenant = {
        ...tenant.data,
        mails: [],
        contactId,
        updatedAt: new Date(),
      };

      const { newVersion } = await repository.createEvent(
        toCreateEventTenantContactAdded(
          tenant.metadata.version,
          updatedTenant,
          contactId,
          correlationId
        )
      );

      return {
        data: updatedTenant,
        metadata: { version: newVersion },
      };
    },

    async deleteTenantContact(
      {
        tenantId,
        contactId,
      }: {
        tenantId: TenantId;
        contactId: ContactId;
      },
      {
        authData,
        logger,
        correlationId,
      }: WithLogger<AppContext<UIAuthData | M2MAdminAuthData>>
    ): Promise<WithMetadata<Tenant>> {
      logger.info(`Deleting contact ${contactId} from Tenant ${tenantId}`);

      await assertRequesterAllowed(tenantId, authData);

      const tenant = await retrieveTenant(tenantId, readModelService);

      if (tenant.data.contactId !== contactId) {
        throw tenantContactNotFound(tenantId, contactId);
      }

      // Not expected, but a tenant with a contact and legacy mails would not
      // be serializable as V3: its mails are removed too
      const updatedTenant: Tenant = {
        ...tenant.data,
        mails: [],
        contactId: undefined,
        updatedAt: new Date(),
      };

      const { newVersion } = await repository.createEvent(
        toCreateEventTenantContactDeleted(
          tenant.metadata.version,
          updatedTenant,
          contactId,
          correlationId
        )
      );

      return {
        data: updatedTenant,
        metadata: { version: newVersion },
      };
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
      { logger }: WithLogger<AppContext<UIAuthData>>
    ): Promise<ListResult<Tenant>> {
      logger.info(
        `Retrieving Producers with name = ${producerName}, limit = ${limit}, offset = ${offset}`
      );
      return readModelService.getProducers({ producerName, offset, limit });
    },
    async getConsumers(
      {
        consumerName,
        offset,
        limit,
      }: {
        consumerName: string | undefined;
        offset: number;
        limit: number;
      },
      { logger, authData }: WithLogger<AppContext<UIAuthData>>
    ): Promise<ListResult<Tenant>> {
      logger.info(
        `Retrieving Consumers with name = ${consumerName}, limit = ${limit}, offset = ${offset}`
      );
      return readModelService.getConsumers({
        consumerName,
        producerId: authData.organizationId,
        offset,
        limit,
      });
    },
    async getTenants(
      query: ApiGetTenantsFilters,
      {
        logger,
      }: WithLogger<AppContext<UIAuthData | M2MAuthData | M2MAdminAuthData>>
    ): Promise<ListResult<Tenant>> {
      logger.info(
        `Retrieving Tenants with name = ${query.name}, features = ${query.features}, externalIdOrigin = ${query.externalIdOrigin}, externalIdValue = ${query.externalIdValue}, limit = ${query.limit}, offset = ${query.offset}`
      );
      return readModelService.getTenants(query);
    },
    async getTenantById(
      id: TenantId,
      {
        logger,
      }: WithLogger<
        AppContext<
          UIAuthData | M2MAuthData | M2MAdminAuthData | InternalAuthData
        >
      >
    ): Promise<WithMetadata<Tenant>> {
      logger.info(`Retrieving tenant ${id}`);
      return await retrieveTenant(id, readModelService);
    },
    async getTenantByExternalId(
      externalId: ExternalId,
      { logger }: WithLogger<AppContext<UIAuthData | M2MAuthData>>
    ): Promise<Tenant> {
      logger.info(
        `Retrieving tenant with origin ${externalId.origin} and code ${externalId.value}`
      );
      const tenant = await retrieveTenantByExternalId({
        tenantOrigin: externalId.origin,
        tenantExternalId: externalId.value,
        readModelService,
      });

      return tenant.data;
    },
    async getTenantBySelfcareId(
      selfcareId: string,
      {
        logger,
      }: WithLogger<AppContext<UIAuthData | M2MAuthData | InternalAuthData>>
    ): Promise<Tenant> {
      logger.info(`Retrieving Tenant with Selfcare Id ${selfcareId}`);
      const tenant = await readModelService.getTenantBySelfcareId(selfcareId);
      if (!tenant) {
        throw tenantNotFoundBySelfcareId(selfcareId);
      }
      return tenant.data;
    },
    async internalUpsertTenant(
      internalTenantSeed: tenantApi.InternalTenantSeed,
      { correlationId, logger }: WithLogger<AppContext<InternalAuthData>>
    ): Promise<WithMetadata<Tenant>> {
      logger.info(
        `Updating tenant with external id ${internalTenantSeed.externalId.origin}/${internalTenantSeed.externalId.value} via internal request`
      );

      const existingTenant = await retrieveTenantByExternalId({
        tenantOrigin: internalTenantSeed.externalId.origin,
        tenantExternalId: internalTenantSeed.externalId.value,
        readModelService,
      });

      const attributesExternalIds = internalTenantSeed.certifiedAttributes.map(
        (externalId) =>
          ({
            value: externalId.code,
            origin: externalId.origin,
          }) satisfies ExternalId
      );

      const existingAttributes =
        attributesExternalIds.length > 0
          ? await readModelService.getAttributesByExternalIds(
              attributesExternalIds
            )
          : [];

      attributesExternalIds.forEach((attributeToAssign) => {
        if (
          !existingAttributes.some(
            (a) =>
              a?.origin === attributeToAssign.origin &&
              a?.code === attributeToAssign.value
          )
        ) {
          throw attributeNotFound(
            `${attributeToAssign.origin}/${attributeToAssign.value}`
          );
        }
      });

      // The tenant after each assignment. The events are built afterwards: the
      // assignments are validated first, then a legacy tenant is converted.
      const tenantsWithNewAttribute = existingAttributes.reduce(
        (
          acc: Array<{ attributeId: AttributeId; tenant: Tenant }>,
          attribute: Attribute
        ) => [
          ...acc,
          {
            attributeId: attribute.id,
            tenant: assignCertifiedAttribute({
              targetTenant: acc.at(-1)?.tenant ?? existingTenant.data,
              attribute,
            }),
          },
        ],
        []
      );
      const tenantWithNewAttributes =
        tenantsWithNewAttribute.at(-1)?.tenant ?? existingTenant.data;

      const newRemoteIds = (internalTenantSeed.remoteIds ?? []).filter(
        (seedRemoteId) =>
          !(tenantWithNewAttributes.remoteIds ?? []).some(
            (existing) =>
              existing.origin === seedRemoteId.origin &&
              existing.value === seedRemoteId.value
          )
      );

      const tenantsWithNewRemoteId = newRemoteIds.reduce(
        (acc: Tenant[], remoteId) => {
          const previousTenant = acc.at(-1) ?? tenantWithNewAttributes;
          const domainRemoteId = {
            ...remoteId,
            assignmentTimestamp: new Date(remoteId.assignmentTimestamp),
          };

          return [
            ...acc,
            {
              ...previousTenant,
              remoteIds: [
                ...(previousTenant.remoteIds ?? []).filter(
                  (existing) => existing.origin !== domainRemoteId.origin
                ),
                domainRemoteId,
              ],
            },
          ];
        },
        []
      );
      const tenantWithRemoteIds =
        tenantsWithNewRemoteId.at(-1) ?? tenantWithNewAttributes;

      const tenantKind = await getTenantKindLoadingCertifiedAttributes(
        readModelService,
        tenantWithRemoteIds.attributes,
        internalTenantSeed.externalId,
        tenantWithRemoteIds.selfcareInstitutionType
      );

      const tenantWithUpdatedKind: Tenant = {
        ...tenantWithRemoteIds,
        kind: tenantKind,
      };
      const isKindUpdated = existingTenant.data.kind !== tenantKind;

      if (
        tenantsWithNewAttribute.length === 0 &&
        tenantsWithNewRemoteId.length === 0 &&
        !isKindUpdated
      ) {
        return {
          data: tenantWithUpdatedKind,
          metadata: { version: existingTenant.metadata.version },
        };
      }

      const conversion = await convertTenantToWrite(existingTenant, {
        correlationId,
        logger,
      });
      const version = conversion.tenant.metadata.version;

      const events: Array<CreateEvent<TenantEvent>> = [
        ...tenantsWithNewAttribute.map(({ attributeId, tenant }, index) =>
          toCreateEventTenantCertifiedAttributeAssigned(
            version + index,
            conversion.convert(tenant),
            attributeId,
            correlationId
          )
        ),
        ...tenantsWithNewRemoteId.map((tenant, index) =>
          toCreateEventTenantRemoteIdAssigned(
            version + tenantsWithNewAttribute.length + index,
            conversion.convert(tenant),
            correlationId
          )
        ),
        ...(isKindUpdated
          ? [
              toCreateEventTenantKindUpdated(
                version +
                  tenantsWithNewAttribute.length +
                  tenantsWithNewRemoteId.length,
                existingTenant.data.kind,
                conversion.convert(tenantWithUpdatedKind),
                correlationId
              ),
            ]
          : []),
      ];

      const newVersion = await createTenantEvents(conversion, events);

      return {
        data: conversion.convert(tenantWithUpdatedKind),
        metadata: { version: newVersion },
      };
    },
    async m2mUpsertTenant(
      m2mTenantSeed: tenantApi.M2MTenantSeed,
      { authData, correlationId, logger }: WithLogger<AppContext<M2MAuthData>>
    ): Promise<Tenant> {
      logger.info(
        `Updating tenant with external id ${m2mTenantSeed.externalId.origin}/${m2mTenantSeed.externalId.value} via m2m request`
      );

      const requesterTenant = await retrieveTenant(
        authData.organizationId,
        readModelService
      );

      const certifierId = retrieveCertifierId(requesterTenant.data);

      const existingTenant = await retrieveTenantByExternalId({
        tenantOrigin: m2mTenantSeed.externalId.origin,
        tenantExternalId: m2mTenantSeed.externalId.value,
        readModelService,
      });

      const attributesExternalIds = m2mTenantSeed.certifiedAttributes.map(
        (externalId) =>
          ({
            value: externalId.code,
            origin: certifierId,
          }) satisfies ExternalId
      );

      const existingAttributes =
        await readModelService.getAttributesByExternalIds(
          attributesExternalIds
        );

      attributesExternalIds.forEach((attributeToAssign) => {
        if (
          !existingAttributes.some(
            (attr) =>
              attr?.origin === attributeToAssign.origin &&
              attr?.code === attributeToAssign.value
          )
        ) {
          throw attributeNotFound(
            `${attributeToAssign.origin}/${attributeToAssign.value}`
          );
        }
      });
      // The tenant after each assignment. The events are built afterwards: the
      // assignments are validated first, then a legacy tenant is converted.
      const tenantsWithNewAttribute = existingAttributes.reduce(
        (
          accumulator: Array<{ attributeId: AttributeId; tenant: Tenant }>,
          attribute: Attribute
        ) => [
          ...accumulator,
          {
            attributeId: attribute.id,
            tenant: assignCertifiedAttribute({
              targetTenant: accumulator.at(-1)?.tenant ?? existingTenant.data,
              attribute,
            }),
          },
        ],
        []
      );
      const tenantWithNewAttributes =
        tenantsWithNewAttribute.at(-1)?.tenant ?? existingTenant.data;

      const tenantKind = await getTenantKindLoadingCertifiedAttributes(
        readModelService,
        tenantWithNewAttributes.attributes,
        m2mTenantSeed.externalId,
        tenantWithNewAttributes.selfcareInstitutionType
      );

      const tenantWithUpdatedKind: Tenant = {
        ...tenantWithNewAttributes,
        kind: tenantKind,
      };
      const isKindUpdated = existingTenant.data.kind !== tenantKind;

      if (tenantsWithNewAttribute.length === 0 && !isKindUpdated) {
        return tenantWithUpdatedKind;
      }

      const conversion = await convertTenantToWrite(existingTenant, {
        correlationId,
        logger,
      });
      const version = conversion.tenant.metadata.version;

      const events: Array<CreateEvent<TenantEvent>> = [
        ...tenantsWithNewAttribute.map(({ attributeId, tenant }, index) =>
          toCreateEventTenantCertifiedAttributeAssigned(
            version + index,
            conversion.convert(tenant),
            attributeId,
            correlationId
          )
        ),
        ...(isKindUpdated
          ? [
              toCreateEventTenantKindUpdated(
                version + tenantsWithNewAttribute.length,
                existingTenant.data.kind,
                conversion.convert(tenantWithUpdatedKind),
                correlationId
              ),
            ]
          : []),
      ];

      await createTenantEvents(conversion, events);

      return conversion.convert(tenantWithUpdatedKind);
    },

    async addCertifierId(
      {
        tenantId,
        certifierId,
      }: {
        tenantId: TenantId;
        certifierId: string;
      },
      { correlationId, logger }: WithLogger<AppContext<MaintenanceAuthData>>
    ): Promise<Tenant> {
      logger.info(`Adding certifierId to Tenant ${tenantId}`);

      const tenant = await retrieveTenant(tenantId, readModelService);

      const certifierFeature = tenant.data.features.find(
        (a): a is TenantFeatureCertifier => a.type === "PersistentCertifier"
      );

      if (certifierFeature) {
        if (certifierId === certifierFeature.certifierId) {
          throw tenantIsAlreadyACertifier(tenant.data.id, certifierId);
        }

        const certifiedAttribute =
          await readModelService.getOneCertifiedAttributeByCertifier({
            certifierId: certifierFeature.certifierId,
          });
        if (certifiedAttribute) {
          throw certifierWithExistingAttributes(
            tenant.data.id,
            certifierFeature.certifierId
          );
        }
      }

      const conversion = await convertTenantToWrite(tenant, {
        correlationId,
        logger,
      });

      const updatedTenant: Tenant = conversion.convert({
        ...tenant.data,
        features: [
          ...tenant.data.features.filter(
            (feature) => feature.type !== "PersistentCertifier"
          ),
          {
            type: "PersistentCertifier",
            certifierId,
          },
        ],
        updatedAt: new Date(),
      });

      await createTenantEvents(conversion, [
        toCreateEventMaintenanceTenantPromotedToCertifier(
          conversion.tenant.metadata.version,
          updatedTenant,
          correlationId
        ),
      ]);
      return updatedTenant;
    },
    async m2mRevokeCertifiedAttribute(
      {
        tenantOrigin,
        tenantExternalId,
        attributeExternalId,
      }: {
        tenantOrigin: string;
        tenantExternalId: string;
        attributeExternalId: string;
      },
      { authData, correlationId, logger }: WithLogger<AppContext<M2MAuthData>>
    ): Promise<void> {
      logger.info(
        `Revoking certified attribute ${attributeExternalId} to tenant (${tenantOrigin}/${tenantExternalId}) via m2m request`
      );
      const requesterTenant = await retrieveTenant(
        authData.organizationId,
        readModelService
      );

      const certifierId = requesterTenant.data.features.find(
        (f): f is TenantFeatureCertifier => f.type === "PersistentCertifier"
      )?.certifierId;

      if (!certifierId) {
        throw tenantIsNotACertifier(requesterTenant.data.id);
      }
      const targetTenant = await retrieveTenantByExternalId({
        tenantOrigin,
        tenantExternalId,
        readModelService,
      });

      const attributeToRevoke = await retrieveCertifiedAttribute({
        attributeOrigin: certifierId,
        attributeExternalId,
        readModelService,
      });

      const attributePreviouslyAssigned = targetTenant.data.attributes.find(
        (attr): attr is CertifiedTenantAttribute =>
          attr.type === tenantAttributeType.CERTIFIED &&
          attr.id === attributeToRevoke.id
      );

      if (!attributePreviouslyAssigned) {
        throw attributeNotFoundInTenant(
          attributeToRevoke.id,
          targetTenant.data.id
        );
      }

      const tenantAfterRevocation = await revokeCertifiedAttribute(
        targetTenant.data,
        attributeToRevoke.id
      );

      const updatedTenantKind = await getTenantKindLoadingCertifiedAttributes(
        readModelService,
        tenantAfterRevocation.attributes,
        tenantAfterRevocation.externalId,
        tenantAfterRevocation.selfcareInstitutionType
      );

      const conversion = await convertTenantToWrite(targetTenant, {
        correlationId,
        logger,
      });

      const tenantWithAttributeRevoked = conversion.convert(
        tenantAfterRevocation
      );

      const attributeAssignmentEvent =
        toCreateEventTenantCertifiedAttributeRevoked(
          conversion.tenant.metadata.version,
          tenantWithAttributeRevoked,
          attributeToRevoke.id,
          correlationId
        );

      if (updatedTenantKind !== tenantWithAttributeRevoked.kind) {
        const tenantWithUpdatedKind: Tenant = {
          ...tenantWithAttributeRevoked,
          kind: updatedTenantKind,
        };
        const tenantKindUpdatedEvent = toCreateEventTenantKindUpdated(
          conversion.tenant.metadata.version + 1,
          tenantWithAttributeRevoked.kind,
          tenantWithUpdatedKind,
          correlationId
        );

        await createTenantEvents(conversion, [
          attributeAssignmentEvent,
          tenantKindUpdatedEvent,
        ]);
      } else {
        await createTenantEvents(conversion, [attributeAssignmentEvent]);
      }
    },
    async updateTenantDelegatedFeatures(
      {
        tenantFeatures,
      }: {
        tenantFeatures: bffApi.TenantDelegatedFeaturesFlagsUpdateSeed;
      },
      { authData, logger, correlationId }: WithLogger<AppContext<UIAuthData>>
    ): Promise<void> {
      logger.info(
        `Updating tenant delegated features for tenant ${authData.organizationId}`
      );

      const requesterTenant = await retrieveTenant(
        authData.organizationId,
        readModelService
      );

      assertTenantAllowedForDelegation(requesterTenant.data);

      const isDelegatedConsumerFeatureChanged =
        tenantFeatures.isDelegatedConsumerFeatureEnabled !==
        isFeatureAssigned(requesterTenant.data, "DelegatedConsumer");
      const isDelegatedProducerFeatureChanged =
        tenantFeatures.isDelegatedProducerFeatureEnabled !==
        isFeatureAssigned(requesterTenant.data, "DelegatedProducer");

      // Nothing to write: a legacy tenant is not converted
      if (
        !isDelegatedConsumerFeatureChanged &&
        !isDelegatedProducerFeatureChanged
      ) {
        return;
      }

      const conversion = await convertTenantToWrite(requesterTenant, {
        correlationId,
        logger,
      });
      const tenantToUpdate = conversion.tenant;

      const delegatedConsumerEvent = match(
        tenantFeatures.isDelegatedConsumerFeatureEnabled
      )
        .with(true, () =>
          assignTenantDelegatedConsumerFeature({
            tenant: tenantToUpdate,
            correlationId,
            logger,
          })
        )
        .with(false, () =>
          removeTenantDelegatedConsumerFeature({
            tenant: tenantToUpdate,
            correlationId,
            logger,
          })
        )
        .exhaustive();

      const updatedTenant: WithMetadata<Tenant> = delegatedConsumerEvent
        ? {
            ...tenantToUpdate,
            data: {
              ...delegatedConsumerEvent.updatedTenant,
            },
          }
        : tenantToUpdate;

      const delegatedProducerEvent = match(
        tenantFeatures.isDelegatedProducerFeatureEnabled
      )
        .with(true, () =>
          assignTenantDelegatedProducerFeature({
            tenant: updatedTenant,
            correlationId,
            logger,
          })
        )
        .with(false, () =>
          removeTenantDelegatedProducerFeature({
            tenant: updatedTenant,
            correlationId,
            logger,
          })
        )
        .exhaustive();

      await match([delegatedConsumerEvent, delegatedProducerEvent])
        .with(
          [P.nonNullable, P.nonNullable],
          async ([delegatedConsumerEvent, delegatedProducerEvent]) =>
            createTenantEvents(conversion, [
              delegatedConsumerEvent.event,
              {
                ...delegatedProducerEvent.event,
                version: tenantToUpdate.metadata.version + 1,
              },
            ])
        )
        .with([P.nonNullable, P.nullish], async ([delegatedConsumerEvent, _]) =>
          createTenantEvents(conversion, [delegatedConsumerEvent.event])
        )
        .with([P.nullish, P.nonNullable], async ([_, delegatedProducerEvent]) =>
          createTenantEvents(conversion, [delegatedProducerEvent.event])
        )
        .with([P.nullish, P.nullish], () => Promise.resolve())
        .exhaustive();
    },
    async getTenantVerifiedAttributeVerifiers(
      tenantId: TenantId,
      attributeId: AttributeId,
      { offset, limit }: { offset: number; limit: number },
      {
        logger,
      }: WithLogger<AppContext<UIAuthData | M2MAuthData | M2MAdminAuthData>>
    ): Promise<ListResult<TenantVerifier>> {
      logger.info(
        `Retrieving verifiers for verified attribute ${attributeId} of tenant ${tenantId}`
      );

      // Validate that tenant and verified attribute exist
      await retrieveTenantVerifiedAttribute(
        tenantId,
        attributeId,
        readModelService
      );

      return await readModelService.getTenantVerifiedAttributeVerifiers(
        tenantId,
        attributeId,
        { offset, limit }
      );
    },
    async getTenantVerifiedAttributeRevokers(
      tenantId: TenantId,
      attributeId: AttributeId,
      { offset, limit }: { offset: number; limit: number },
      {
        logger,
      }: WithLogger<AppContext<UIAuthData | M2MAuthData | M2MAdminAuthData>>
    ): Promise<ListResult<TenantRevoker>> {
      logger.info(
        `Retrieving revokers for verified attribute ${attributeId} of tenant ${tenantId}`
      );

      // Validate that tenant and verified attribute exist
      await retrieveTenantVerifiedAttribute(
        tenantId,
        attributeId,
        readModelService
      );

      return await readModelService.getTenantVerifiedAttributeRevokers(
        tenantId,
        attributeId,
        { offset, limit }
      );
    },
  };
}

function assignTenantDelegatedProducerFeature({
  tenant,
  correlationId,
  logger,
}: {
  tenant: WithMetadata<Tenant>;
  correlationId: CorrelationId;
  logger: Logger;
}): { event: CreateEvent<TenantEvent>; updatedTenant: Tenant } | null {
  if (isFeatureAssigned(tenant.data, "DelegatedProducer")) {
    return null;
  }

  logger.info(
    `Assigning delegated producer feature to tenant ${tenant.data.id}`
  );

  const updatedTenant: Tenant = {
    ...tenant.data,
    features: [
      ...tenant.data.features,
      { type: "DelegatedProducer", availabilityTimestamp: new Date() },
    ],
    updatedAt: new Date(),
  };

  const event = toCreateEventTenantDelegatedProducerFeatureAdded(
    tenant.metadata.version,
    updatedTenant,
    correlationId
  );

  return { event, updatedTenant };
}

function removeTenantDelegatedProducerFeature({
  tenant,
  correlationId,
  logger,
}: {
  tenant: WithMetadata<Tenant>;
  correlationId: CorrelationId;
  logger: Logger;
}): { event: CreateEvent<TenantEvent>; updatedTenant: Tenant } | null {
  if (!isFeatureAssigned(tenant.data, "DelegatedProducer")) {
    return null;
  }

  logger.info(
    `Removing delegated producer feature from tenant ${tenant.data.id}`
  );

  const updatedTenant: Tenant = {
    ...tenant.data,
    features: tenant.data.features.filter(
      (f) => f.type !== "DelegatedProducer"
    ),
    updatedAt: new Date(),
  };

  const event = toCreateEventTenantDelegatedProducerFeatureRemoved(
    tenant.metadata.version,
    updatedTenant,
    correlationId
  );

  return { event, updatedTenant };
}

function assignTenantDelegatedConsumerFeature({
  tenant,
  correlationId,
  logger,
}: {
  tenant: WithMetadata<Tenant>;
  correlationId: CorrelationId;
  logger: Logger;
}): { event: CreateEvent<TenantEvent>; updatedTenant: Tenant } | null {
  if (isFeatureAssigned(tenant.data, "DelegatedConsumer")) {
    return null;
  }

  logger.info(
    `Assigning delegated consumer feature to tenant ${tenant.data.id}`
  );

  const updatedTenant: Tenant = {
    ...tenant.data,
    features: [
      ...tenant.data.features,
      { type: "DelegatedConsumer", availabilityTimestamp: new Date() },
    ],
    updatedAt: new Date(),
  };

  const event = toCreateEventTenantDelegatedConsumerFeatureAdded(
    tenant.metadata.version,
    updatedTenant,
    correlationId
  );

  return { event, updatedTenant };
}

function removeTenantDelegatedConsumerFeature({
  tenant,
  correlationId,
  logger,
}: {
  tenant: WithMetadata<Tenant>;
  correlationId: CorrelationId;
  logger: Logger;
}): { event: CreateEvent<TenantEvent>; updatedTenant: Tenant } | null {
  if (!isFeatureAssigned(tenant.data, "DelegatedConsumer")) {
    return null;
  }

  logger.info(
    `Removing delegated consumer feature from tenant ${tenant.data.id}`
  );

  const updatedTenant: Tenant = {
    ...tenant.data,
    features: tenant.data.features.filter(
      (f) => f.type !== "DelegatedConsumer"
    ),
    updatedAt: new Date(),
  };

  const event = toCreateEventTenantDelegatedConsumerFeatureRemoved(
    tenant.metadata.version,
    updatedTenant,
    correlationId
  );

  return { event, updatedTenant };
}

function assignCertifiedAttribute({
  targetTenant,
  attribute,
}: {
  targetTenant: Tenant;
  attribute: Attribute;
}): Tenant {
  const certifiedTenantAttribute = targetTenant.attributes.find(
    (attr): attr is CertifiedTenantAttribute =>
      attr.type === tenantAttributeType.CERTIFIED && attr.id === attribute.id
  );

  if (!certifiedTenantAttribute) {
    // assigning attribute for the first time
    return {
      ...targetTenant,
      attributes: [
        ...targetTenant.attributes,
        {
          id: attribute.id,
          type: tenantAttributeType.CERTIFIED,
          assignmentTimestamp: new Date(),
          revocationTimestamp: undefined,
        },
      ],
      updatedAt: new Date(),
    };
  } else if (!certifiedTenantAttribute.revocationTimestamp) {
    throw certifiedAttributeAlreadyAssigned(attribute.id, targetTenant.id);
  } else {
    // re-assigning attribute if it was revoked
    return {
      ...targetTenant,
      attributes: targetTenant.attributes.map((a) =>
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
}

function buildVerifiedBy(
  verifiers: TenantVerifier[],
  organizationId: TenantId,
  producerDelegation: DelegationId | undefined,
  expirationDate: string | undefined
): TenantVerifier[] {
  const hasPreviouslyVerified = verifiers.find((i) => i.id === organizationId);
  return hasPreviouslyVerified
    ? verifiers.map((verification) =>
        verification.id === organizationId
          ? {
              id: organizationId,
              delegationId: producerDelegation,
              verificationDate: new Date(),
              expirationDate: expirationDate
                ? validateExpirationDate(new Date(expirationDate))
                : undefined,
              extensionDate: expirationDate
                ? new Date(expirationDate)
                : undefined,
            }
          : verification
      )
    : [
        ...verifiers,
        {
          id: organizationId,
          delegationId: producerDelegation,
          verificationDate: new Date(),
          expirationDate: expirationDate
            ? validateExpirationDate(new Date(expirationDate))
            : undefined,
          extensionDate: expirationDate ? new Date(expirationDate) : undefined,
        },
      ];
}

function assignDeclaredAttribute(
  attributes: TenantAttribute[],
  attributeId: AttributeId,
  delegationId: DelegationId | undefined
): TenantAttribute[] {
  return [
    ...attributes,
    {
      id: unsafeBrandId(attributeId),
      type: tenantAttributeType.DECLARED,
      assignmentTimestamp: new Date(),
      revocationTimestamp: undefined,
      delegationId,
    },
  ];
}

function reassignDeclaredAttribute(
  attributes: TenantAttribute[],
  attributeId: AttributeId,
  delegationId: DelegationId | undefined
): TenantAttribute[] {
  const targetAttribute = attributes.find(
    (attr): attr is DeclaredTenantAttribute =>
      attr.type === tenantAttributeType.DECLARED && attr.id === attributeId
  );
  if (!targetAttribute) {
    throw attributeNotFound(attributeId);
  }

  const newAttribute = {
    ...targetAttribute,
    delegationId,
    assignmentTimestamp: new Date(),
    revocationTimestamp: undefined,
  };

  return [
    ...attributes.filter((attr) => attr.id !== attributeId),
    newAttribute,
  ];
}

function assignVerifiedAttribute(
  attributes: TenantAttribute[],
  organizationId: TenantId,
  producerDelegationId: DelegationId | undefined,
  attributeId: AttributeId,
  expirationDate: string | undefined
): TenantAttribute[] {
  return [
    ...attributes,
    {
      id: attributeId,
      type: tenantAttributeType.VERIFIED,
      assignmentTimestamp: new Date(),
      verifiedBy: [
        {
          id: organizationId,
          delegationId: producerDelegationId,
          verificationDate: new Date(),
          expirationDate: expirationDate
            ? validateExpirationDate(new Date(expirationDate))
            : undefined,
          extensionDate: expirationDate ? new Date(expirationDate) : undefined,
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
  producerDelegationId: DelegationId | undefined,
  expirationDate: string | undefined
): TenantAttribute[] {
  return attributes.map((attr) =>
    attr.id === verifiedTenantAttribute.id
      ? {
          ...attr,
          verifiedBy: buildVerifiedBy(
            verifiedTenantAttribute.verifiedBy,
            organizationId,
            producerDelegationId,
            expirationDate
          ),
          revokedBy: verifiedTenantAttribute.revokedBy.filter(
            (i) => i.id !== organizationId
          ),
        }
      : attr
  );
}

async function revokeCertifiedAttribute(
  tenant: Tenant,
  attributeId: AttributeId
): Promise<Tenant> {
  return {
    ...tenant,
    updatedAt: new Date(),
    attributes: tenant.attributes.map((attr) =>
      attr.id === attributeId
        ? {
            ...attr,
            revocationTimestamp: new Date(),
          }
        : attr
    ),
  } satisfies Tenant;
}

function validateExpirationDate(expirationDate: Date): Date {
  assertValidExpirationDate(expirationDate);
  return expirationDate;
}

export type TenantService = ReturnType<typeof tenantServiceBuilder>;
