import {
  AuthData,
  CreateEvent,
  eventRepository,
  initDB,
} from "pagopa-interop-commons";
import {
  Attribute,
  ExternalId,
  Tenant,
  TenantAttribute,
  TenantEvent,
  TenantFeature,
  TenantKind,
  TenantMail,
  WithMetadata,
  tenantAttributeType,
  tenantEventToBinaryData,
} from "pagopa-interop-models";
import { v4 as uuidv4 } from "uuid";
import { TenantProcessConfig } from "../utilities/config.js";
import {
  toCreateEventTenantAdded,
  toCreateEventTenantUpdated,
} from "../model/domain/toEvent.js";
import { UpdateVerifiedTenantAttributeSeed } from "../model/domain/models.js";
import {
  ApiInternalTenantSeed,
  ApiM2MTenantSeed,
  ApiSelfcareTenantSeed,
} from "../model/types.js";
import { tenantDuplicate } from "../model/domain/errors.js";
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
    async createTenant(
      apiTenantSeed:
        | ApiSelfcareTenantSeed
        | ApiM2MTenantSeed
        | ApiInternalTenantSeed,
      attributesExternalIds: ExternalId[],
      kind: TenantKind
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
        })
      );
    },

    async updateTenantVerifiedAttribute({
      verifierId,
      tenantId,
      attributeId,
      updateVerifiedTenantAttributeSeed,
    }: {
      verifierId: string;
      tenantId: string;
      attributeId: string;
      updateVerifiedTenantAttributeSeed: UpdateVerifiedTenantAttributeSeed;
    }): Promise<void> {
      const tenant = await readModelService.getTenantById(tenantId);

      await repository.createEvent(
        await updateTenantVerifiedAttributeLogic({
          verifierId,
          tenant,
          tenantId,
          attributeId,
          updateVerifiedTenantAttributeSeed,
        })
      );
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
        const newTenant: Tenant = {
          id: uuidv4(),
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
  };
}

async function updateTenantVerifiedAttributeLogic({
  verifierId,
  tenant,
  tenantId,
  attributeId,
  updateVerifiedTenantAttributeSeed,
}: {
  verifierId: string;
  tenant: WithMetadata<Tenant> | undefined;
  tenantId: string;
  attributeId: string;
  updateVerifiedTenantAttributeSeed: UpdateVerifiedTenantAttributeSeed;
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
    updatedTenant
  );
}

export async function updateTenantLogic({
  tenant,
  selfcareId,
  features,
  mails,
  kind,
}: {
  tenant: WithMetadata<Tenant>;
  selfcareId: string | undefined;
  features: TenantFeature[];
  mails: TenantMail[];
  kind: TenantKind;
}): Promise<CreateEvent<TenantEvent>> {
  const newTenant: Tenant = {
    ...tenant.data,
    selfcareId,
    features,
    mails,
    kind,
    updatedAt: new Date(),
  };

  return toCreateEventTenantUpdated(
    tenant.data.id,
    tenant.metadata.version,
    newTenant
  );
}

export function createTenantLogic({
  tenant,
  apiTenantSeed,
  kind,
  attributes,
}: {
  tenant: WithMetadata<Tenant> | undefined;
  apiTenantSeed:
    | ApiSelfcareTenantSeed
    | ApiM2MTenantSeed
    | ApiInternalTenantSeed;
  kind: TenantKind;
  attributes: Array<WithMetadata<Attribute>>;
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
export type TenantService = ReturnType<typeof tenantServiceBuilder>;

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

  return toCreateEventTenantUpdated(
    tenant.data.id,
    tenant.metadata.version,
    updatedTenant
  );
}
