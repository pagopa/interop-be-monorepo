import crypto from "crypto";
import {
  DB,
  eventRepository,
  Logger,
  WithLogger,
  AppContext,
  CreateEvent,
  getLatestTenantMailOfKind,
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
  TenantMail,
  TenantEvent,
  tenantMailKind,
  TenantFeatureCertifier,
  CorrelationId,
  tenantKind,
  AgreementId,
  Agreement,
  AgreementState,
  DelegationId,
  TenantRevoker,
} from "pagopa-interop-models";
import { ExternalId } from "pagopa-interop-models";
import { bffApi, tenantApi } from "pagopa-interop-api-clients";
import { match, P } from "ts-pattern";
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
  toCreateEventTenantMailDeleted,
  toCreateEventTenantMailAdded,
  toCreateEventTenantVerifiedAttributeAssigned,
  toCreateEventMaintenanceTenantPromotedToCertifier,
  toCreateEventTenantVerifiedAttributeRevoked,
  toCreateEventMaintenanceTenantUpdated,
  toCreateEventTenantDelegatedProducerFeatureAdded,
  toCreateEventTenantDelegatedProducerFeatureRemoved,
  toCreateEventTenantDelegatedConsumerFeatureRemoved,
  toCreateEventTenantDelegatedConsumerFeatureAdded,
} from "../model/domain/toEvent.js";
import {
  attributeAlreadyRevoked,
  attributeDoesNotBelongToCertifier,
  attributeNotFound,
  attributeNotFoundInTenant,
  attributeRevocationNotAllowed,
  attributeVerificationNotAllowed,
  certifiedAttributeAlreadyAssigned,
  certifierWithExistingAttributes,
  mailAlreadyExists,
  mailNotFound,
  tenantIsNotACertifier,
  tenantNotFoundByExternalId,
  tenantNotFoundBySelfcareId,
  tenantNotFound,
  tenantIsAlreadyACertifier,
  verifiedAttributeSelfRevocationNotAllowed,
  agreementNotFound,
  notValidMailAddress,
  delegationNotFound,
  operationRestrictedToDelegate,
  verifiedAttributeSelfVerificationNotAllowed,
} from "../model/domain/errors.js";
import { ApiGetTenantsFilters } from "../model/domain/models.js";
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
  assertRequesterDelegationsAllowedOrigin,
  getTenantKind,
  isFeatureAssigned,
} from "./validators.js";
import { ReadModelServiceSQL } from "./readModelServiceSQL.js";

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

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function tenantServiceBuilder(
  dbInstance: DB,
  readModelService: ReadModelServiceSQL
) {
  const repository = eventRepository(dbInstance, tenantEventToBinaryData);
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
          existingTenant.data.externalId
        );

        const updatedTenant: Tenant = {
          ...existingTenant.data,
          kind: tenantKind,
          selfcareId: tenantSeed.selfcareId,
          onboardedAt: new Date(tenantSeed.onboardedAt),
          updatedAt: new Date(),
        };

        logger.info(
          `Creating tenant with external id ${tenantSeed.externalId} via SelfCare request"`
        );
        await repository.createEvent(
          toCreateEventTenantOnboardDetailsUpdated(
            existingTenant.data.id,
            existingTenant.metadata.version,
            updatedTenant,
            correlationId
          )
        );
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
          mails: formatTenantMail(tenantSeed.digitalAddress),
          selfcareId: tenantSeed.selfcareId,
          onboardedAt: new Date(tenantSeed.onboardedAt),
          subUnitType: tenantSeed.subUnitType,
          createdAt: new Date(),
          kind: match(getTenantKind([], tenantSeed.externalId))
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

      const updatedTenant: Tenant = {
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
      };

      const event = await repository.createEvent(
        toCreateEventTenantDeclaredAttributeRevoked(
          requesterTenant.metadata.version,
          updatedTenant,
          unsafeBrandId(attributeId),
          correlationId
        )
      );
      return {
        data: updatedTenant,
        metadata: { version: event.newVersion },
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

      const tenantWithNewAttribute = assignCertifiedAttribute({
        targetTenant: targetTenant.data,
        attribute,
      });

      const tenantCertifiedAttributeAssignedEvent =
        toCreateEventTenantCertifiedAttributeAssigned(
          targetTenant.metadata.version,
          tenantWithNewAttribute,
          attribute.id,
          correlationId
        );

      const tenantKind = await getTenantKindLoadingCertifiedAttributes(
        readModelService,
        tenantWithNewAttribute.attributes,
        tenantWithNewAttribute.externalId
      );

      const updatedTenant = {
        ...tenantWithNewAttribute,
        kind: tenantKind,
      };

      if (tenantWithNewAttribute.kind !== tenantKind) {
        const tenantKindUpdatedEvent = toCreateEventTenantKindUpdated(
          targetTenant.metadata.version + 1,
          targetTenant.data.kind,
          updatedTenant,
          correlationId
        );

        const createdEvents = await repository.createEvents([
          tenantCertifiedAttributeAssignedEvent,
          tenantKindUpdatedEvent,
        ]);

        return {
          data: updatedTenant,
          metadata: {
            version: createdEvents.latestNewVersions.get(updatedTenant.id) ?? 0,
          },
        };
      }
      const { newVersion } = await repository.createEvent(
        tenantCertifiedAttributeAssignedEvent
      );
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
          const delegation = await readModelService.getActiveConsumerDelegation(
            delegationId
          );

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

      const updatedTenant: Tenant = {
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
      };

      const event = await repository.createEvent(
        toCreateEventTenantDeclaredAttributeAssigned(
          tenant.metadata.version,
          updatedTenant,
          unsafeBrandId(tenantAttributeSeed.id),
          correlationId
        )
      );

      return {
        data: updatedTenant,
        metadata: { version: event.newVersion },
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

      const tenantWithRevokedAttribute: Tenant = await revokeCertifiedAttribute(
        targetTenant.data,
        attributeId
      );

      const tenantCertifiedAttributeRevokedEvent =
        toCreateEventTenantCertifiedAttributeRevoked(
          targetTenant.metadata.version,
          tenantWithRevokedAttribute,
          attributeId,
          correlationId
        );

      const tenantKind = await getTenantKindLoadingCertifiedAttributes(
        readModelService,
        tenantWithRevokedAttribute.attributes,
        tenantWithRevokedAttribute.externalId
      );

      if (tenantWithRevokedAttribute.kind !== tenantKind) {
        const updatedTenant = {
          ...tenantWithRevokedAttribute,
          kind: tenantKind,
        };

        const tenantKindUpdatedEvent = toCreateEventTenantKindUpdated(
          targetTenant.metadata.version + 1,
          targetTenant.data.kind,
          updatedTenant,
          correlationId
        );

        const createdEvents = await repository.createEvents([
          tenantCertifiedAttributeRevokedEvent,
          tenantKindUpdatedEvent,
        ]);

        return {
          data: updatedTenant,
          metadata: {
            version: createdEvents.latestNewVersions.get(updatedTenant.id) ?? 0,
          },
        };
      }

      const { newVersion } = await repository.createEvent(
        tenantCertifiedAttributeRevokedEvent
      );
      return {
        data: tenantWithRevokedAttribute,
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

      const updatedTenant: Tenant = {
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

      const event = await repository.createEvent(
        toCreateEventTenantVerifiedAttributeAssigned(
          targetTenant.metadata.version,
          updatedTenant,
          attributeId,
          correlationId
        )
      );
      return {
        data: updatedTenant,
        metadata: { version: event.newVersion },
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

      const updatedTenant: Tenant = {
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
      };

      const event = await repository.createEvent(
        toCreateEventTenantVerifiedAttributeRevoked(
          targetTenant.metadata.version,
          updatedTenant,
          attributeId,
          correlationId
        )
      );

      return {
        data: updatedTenant,
        metadata: { version: event.newVersion },
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
    ): Promise<void> {
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

      const tenantWithNewAttribute = assignCertifiedAttribute({
        targetTenant: tenantToModify.data,
        attribute: attributeToAssign,
      });

      const tenantCertifiedAttributeAssignedEvent =
        toCreateEventTenantCertifiedAttributeAssigned(
          tenantToModify.metadata.version,
          tenantWithNewAttribute,
          attributeToAssign.id,
          correlationId
        );

      const tenantKind = await getTenantKindLoadingCertifiedAttributes(
        readModelService,
        tenantWithNewAttribute.attributes,
        tenantWithNewAttribute.externalId
      );

      if (tenantWithNewAttribute.kind !== tenantKind) {
        const updatedTenant: Tenant = {
          ...tenantWithNewAttribute,
          kind: tenantKind,
        };

        const tenantKindUpdatedEvent = toCreateEventTenantKindUpdated(
          tenantToModify.metadata.version + 1,
          tenantToModify.data.kind,
          updatedTenant,
          correlationId
        );

        await repository.createEvents([
          tenantCertifiedAttributeAssignedEvent,
          tenantKindUpdatedEvent,
        ]);
      } else {
        await repository.createEvent(tenantCertifiedAttributeAssignedEvent);
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
    ): Promise<void> {
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

      const tenantWithRevokedAttribute = await revokeCertifiedAttribute(
        tenantToModify.data,
        attributeToRevoke.id
      );

      const tenantCertifiedAttributeRevokedEvent =
        toCreateEventTenantCertifiedAttributeRevoked(
          tenantToModify.metadata.version,
          tenantWithRevokedAttribute,
          attributeToRevoke.id,
          correlationId
        );

      const tenantKind = await getTenantKindLoadingCertifiedAttributes(
        readModelService,
        tenantWithRevokedAttribute.attributes,
        tenantWithRevokedAttribute.externalId
      );

      if (tenantWithRevokedAttribute.kind !== tenantKind) {
        const updatedTenant: Tenant = {
          ...tenantWithRevokedAttribute,
          kind: tenantKind,
        };
        const tenantKindUpdatedEvent = toCreateEventTenantKindUpdated(
          tenantToModify.metadata.version + 1,
          tenantToModify.data.kind,
          updatedTenant,
          correlationId
        );

        await repository.createEvents([
          tenantCertifiedAttributeRevokedEvent,
          tenantKindUpdatedEvent,
        ]);
      } else {
        await repository.createEvent(tenantCertifiedAttributeRevokedEvent);
      }
    },

    async getCertifiedAttributes(
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

      return await readModelService.getCertifiedAttributes({
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

      await repository.createEvent(
        toCreateEventMaintenanceTenantDeleted(
          version,
          tenant.data,
          correlationId
        )
      );
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

      const tenant = await retrieveTenant(tenantId, readModelService);

      const convertedTenantUpdate = {
        ...tenantUpdate,
        mails: tenantUpdate.mails.map((mail) => ({
          ...mail,
          createdAt: new Date(mail.createdAt),
        })),
        onboardedAt: new Date(tenantUpdate.onboardedAt),
      };

      const updatedTenant: Tenant = {
        ...tenant.data,
        ...convertedTenantUpdate,
        subUnitType: convertedTenantUpdate.subUnitType,
        updatedAt: new Date(),
      };

      await repository.createEvent(
        toCreateEventMaintenanceTenantUpdated(
          version,
          updatedTenant,
          correlationId
        )
      );
    },

    async deleteTenantMailById(
      {
        tenantId,
        mailId,
      }: {
        tenantId: TenantId;
        mailId: string;
      },
      { authData, logger, correlationId }: WithLogger<AppContext<UIAuthData>>
    ): Promise<void> {
      logger.info(`Deleting mail ${mailId} to Tenant ${tenantId}`);

      await assertRequesterAllowed(tenantId, authData);

      const tenant = await retrieveTenant(tenantId, readModelService);

      if (!tenant.data.mails.find((m) => m.id === mailId)) {
        throw mailNotFound(mailId);
      }

      const updatedTenant: Tenant = {
        ...tenant.data,
        mails: tenant.data.mails.filter((mail) => mail.id !== mailId),
        updatedAt: new Date(),
      };

      await repository.createEvent(
        toCreateEventTenantMailDeleted(
          tenant.metadata.version,
          updatedTenant,
          mailId,
          correlationId
        )
      );
    },

    async addTenantMail(
      {
        tenantId,
        mailSeed,
      }: {
        tenantId: TenantId;
        mailSeed: tenantApi.MailSeed;
      },
      { authData, logger, correlationId }: WithLogger<AppContext<UIAuthData>>
    ): Promise<void> {
      logger.info(`Adding mail of kind ${mailSeed.kind} to Tenant ${tenantId}`);

      await assertRequesterAllowed(tenantId, authData);

      const tenant = await retrieveTenant(tenantId, readModelService);

      const validatedAddress = validateAddress(mailSeed.address);

      // could be simplified when the tenants will have only one mail of each kind
      const latestMail = getLatestTenantMailOfKind(
        tenant.data.mails,
        mailSeed.kind
      );

      if (latestMail?.address === validatedAddress) {
        throw mailAlreadyExists();
      }

      const filteredMails = tenant.data.mails.filter(
        (mail) => mail.kind !== mailSeed.kind
      );

      const newMail: TenantMail = {
        kind: mailSeed.kind,
        address: validatedAddress,
        description: mailSeed.description,
        id: crypto.createHash("sha256").update(validatedAddress).digest("hex"),
        createdAt: new Date(),
      };

      const updatedTenant: Tenant = {
        ...tenant.data,
        mails: [...filteredMails, newMail],
        updatedAt: new Date(),
      };

      await repository.createEvent(
        toCreateEventTenantMailAdded(
          tenant.metadata.version,
          updatedTenant,
          newMail.id,
          correlationId
        )
      );
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
    ): Promise<Tenant> {
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
          } satisfies ExternalId)
      );

      const existingAttributes =
        await readModelService.getAttributesByExternalIds(
          attributesExternalIds
        );

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

      const { events, tenantWithNewAttributes } = existingAttributes.reduce(
        (
          acc: {
            events: Array<CreateEvent<TenantEvent>>;
            tenantWithNewAttributes: Tenant;
          },
          attribute: Attribute,
          index
        ) => {
          const tenantWithNewAttribute = assignCertifiedAttribute({
            targetTenant: acc.tenantWithNewAttributes,
            attribute,
          });

          const version = existingTenant.metadata.version + index;
          const attributeAssignmentEvent =
            toCreateEventTenantCertifiedAttributeAssigned(
              version,
              tenantWithNewAttribute,
              attribute.id,
              correlationId
            );
          return {
            events: [...acc.events, attributeAssignmentEvent],
            tenantWithNewAttributes: tenantWithNewAttribute,
          };
        },
        {
          events: [],
          tenantWithNewAttributes: existingTenant.data,
        }
      );

      const tenantKind = await getTenantKindLoadingCertifiedAttributes(
        readModelService,
        tenantWithNewAttributes.attributes,
        internalTenantSeed.externalId
      );

      const tenantWithUpdatedKind: Tenant = {
        ...tenantWithNewAttributes,
        kind: tenantKind,
      };

      if (existingTenant.data.kind !== tenantKind) {
        const tenantKindUpdatedEvent = toCreateEventTenantKindUpdated(
          existingTenant.metadata.version + events.length,
          existingTenant.data.kind,
          tenantWithUpdatedKind,
          correlationId
        );
        // eslint-disable-next-line functional/immutable-data
        events.push(tenantKindUpdatedEvent);
      }
      await repository.createEvents(events);

      return tenantWithUpdatedKind;
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
          } satisfies ExternalId)
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
      const { events, tenantWithNewAttributes } = existingAttributes.reduce(
        (
          accumulator: {
            events: Array<CreateEvent<TenantEvent>>;
            tenantWithNewAttributes: Tenant;
          },
          attribute: Attribute,
          index
        ) => {
          const tenantWithNewAttribute = assignCertifiedAttribute({
            targetTenant: accumulator.tenantWithNewAttributes,
            attribute,
          });

          const version = existingTenant.metadata.version + index;
          const attributeAssignmentEvent =
            toCreateEventTenantCertifiedAttributeAssigned(
              version,
              tenantWithNewAttribute,
              attribute.id,
              correlationId
            );
          return {
            events: [...accumulator.events, attributeAssignmentEvent],
            tenantWithNewAttributes: tenantWithNewAttribute,
          };
        },
        {
          events: [],
          tenantWithNewAttributes: existingTenant.data,
        }
      );

      const tenantKind = await getTenantKindLoadingCertifiedAttributes(
        readModelService,
        tenantWithNewAttributes.attributes,
        m2mTenantSeed.externalId
      );

      const tenantWithUpdatedKind: Tenant = {
        ...tenantWithNewAttributes,
        kind: tenantKind,
      };

      if (existingTenant.data.kind !== tenantKind) {
        const tenantKindUpdatedEvent = toCreateEventTenantKindUpdated(
          existingTenant.metadata.version + events.length,
          existingTenant.data.kind,
          tenantWithUpdatedKind,
          correlationId
        );
        // eslint-disable-next-line functional/immutable-data
        events.push(tenantKindUpdatedEvent);
      }
      await repository.createEvents(events);

      return tenantWithUpdatedKind;
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

      const updatedTenant: Tenant = {
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
      };

      await repository.createEvent(
        toCreateEventMaintenanceTenantPromotedToCertifier(
          tenant.metadata.version,
          updatedTenant,
          correlationId
        )
      );
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

      const tenantWithAttributeRevoked = await revokeCertifiedAttribute(
        targetTenant.data,
        attributeToRevoke.id
      );

      const attributeAssignmentEvent =
        toCreateEventTenantCertifiedAttributeRevoked(
          targetTenant.metadata.version,
          tenantWithAttributeRevoked,
          attributeToRevoke.id,
          correlationId
        );

      const updatedTenantKind = await getTenantKindLoadingCertifiedAttributes(
        readModelService,
        tenantWithAttributeRevoked.attributes,
        tenantWithAttributeRevoked.externalId
      );

      if (updatedTenantKind !== tenantWithAttributeRevoked.kind) {
        const tenantWithUpdatedKind: Tenant = {
          ...tenantWithAttributeRevoked,
          kind: updatedTenantKind,
        };
        const tenantKindUpdatedEvent = toCreateEventTenantKindUpdated(
          targetTenant.metadata.version + 1,
          tenantWithAttributeRevoked.kind,
          tenantWithUpdatedKind,
          correlationId
        );

        await repository.createEvents([
          attributeAssignmentEvent,
          tenantKindUpdatedEvent,
        ]);
      } else {
        await repository.createEvent(attributeAssignmentEvent);
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

      assertRequesterDelegationsAllowedOrigin(authData);

      const requesterTenant = await retrieveTenant(
        authData.organizationId,
        readModelService
      );

      const delegatedConsumerEvent = match(
        tenantFeatures.isDelegatedConsumerFeatureEnabled
      )
        .with(true, () =>
          assignTenantDelegatedConsumerFeature({
            tenant: requesterTenant,
            correlationId,
            logger,
          })
        )
        .with(false, () =>
          removeTenantDelegatedConsumerFeature({
            tenant: requesterTenant,
            correlationId,
            logger,
          })
        )
        .exhaustive();

      const updatedTenant: WithMetadata<Tenant> = delegatedConsumerEvent
        ? {
            ...requesterTenant,
            data: {
              ...delegatedConsumerEvent.updatedTenant,
            },
          }
        : requesterTenant;

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
            repository.createEvents([
              delegatedConsumerEvent.event,
              {
                ...delegatedProducerEvent.event,
                version: requesterTenant.metadata.version + 1,
              },
            ])
        )
        .with([P.nonNullable, P.nullish], async ([delegatedConsumerEvent, _]) =>
          repository.createEvent(delegatedConsumerEvent.event)
        )
        .with([P.nullish, P.nonNullable], async ([_, delegatedProducerEvent]) =>
          repository.createEvent(delegatedProducerEvent.event)
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
function validateAddress(address: string): string {
  // Here I am removing the non-printing control characters
  const removeNonPrintingcontrolCharacters = address.replace(
    // eslint-disable-next-line no-control-regex
    /[\x00-\x1F\x7F]/g,
    ""
  );

  // Here I am removing the extra spaces and tabs
  const sanitizedMail = removeNonPrintingcontrolCharacters
    .replace(/\s+/g, "")
    .trim();

  // same path used by the frontend
  // Taken from HTML spec: https://html.spec.whatwg.org/multipage/input.html#valid-e-mail-address
  const emailPattern =
    // eslint-disable-next-line no-useless-escape
    /^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  if (!emailPattern.test(sanitizedMail)) {
    throw notValidMailAddress();
  }
  return sanitizedMail;
}

function formatTenantMail(
  digitalAddress: tenantApi.MailSeed | undefined
): TenantMail[] {
  if (!digitalAddress) {
    return [];
  }
  const validatedAddress = validateAddress(digitalAddress.address);
  return [
    {
      id: crypto.createHash("sha256").update(validatedAddress).digest("hex"),
      kind: tenantMailKind.DigitalAddress,
      address: validatedAddress,
      description: digitalAddress.description,
      createdAt: new Date(),
    },
  ];
}

export type TenantService = ReturnType<typeof tenantServiceBuilder>;
