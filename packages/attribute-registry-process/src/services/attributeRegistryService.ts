import {
  AppContext,
  DB,
  WithLogger,
  eventRepository,
  UIAuthData,
  M2MAuthData,
  InternalAuthData,
  M2MAdminAuthData,
  retrieveOriginFromAuthData,
} from "pagopa-interop-commons";
import {
  Attribute,
  WithMetadata,
  attributeEventToBinaryData,
  attributeKind,
  generateId,
  TenantId,
  AttributeId,
  AttributeKind,
  ListResult,
  TenantFeatureCertifier,
  Tenant,
} from "pagopa-interop-models";
import { attributeRegistryApi } from "pagopa-interop-api-clients";
import { toCreateEventAttributeAdded } from "../model/domain/toEvent.js";
import {
  tenantIsNotACertifier,
  attributeDuplicateByName,
  attributeDuplicateByNameAndCode,
  attributeNotFound,
  originNotCompliant,
  tenantNotFound,
} from "../model/domain/errors.js";
import { config } from "../config/config.js";
import { ReadModelServiceSQL } from "./readModelServiceSQL.js";

const retrieveTenant = async (
  tenantId: TenantId,
  readModelService: Pick<ReadModelServiceSQL, "getTenantById">
): Promise<Tenant> => {
  const tenant = await readModelService.getTenantById(tenantId);
  if (tenant === undefined) {
    throw tenantNotFound(tenantId);
  }
  return tenant;
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function attributeRegistryServiceBuilder(
  dbInstance: DB,
  readModelService: ReadModelServiceSQL
) {
  const repository = eventRepository(dbInstance, attributeEventToBinaryData);

  return {
    async getAttributesByKindsNameOrigin(
      {
        kinds,
        name,
        origin,
        offset,
        limit,
      }: {
        kinds: AttributeKind[];
        name: string | undefined;
        origin: string | undefined;
        offset: number;
        limit: number;
      },
      { logger }: WithLogger<AppContext>
    ): Promise<ListResult<Attribute>> {
      logger.info(
        `Getting attributes with name = ${name}, limit = ${limit}, offset = ${offset}, kinds = ${kinds}`
      );
      return await readModelService.getAttributesByKindsNameOrigin({
        kinds,
        name,
        origin,
        offset,
        limit,
      });
    },

    async getAttributeByName(
      name: string,
      { logger }: WithLogger<AppContext>
    ): Promise<WithMetadata<Attribute>> {
      logger.info(`Retrieving attribute with name ${name}`);
      const attribute = await readModelService.getAttributeByName(name);
      if (attribute === undefined) {
        throw attributeNotFound(name);
      }
      return attribute;
    },

    async getAttributeByOriginAndCode(
      {
        origin,
        code,
      }: {
        origin: string;
        code: string;
      },
      { logger }: WithLogger<AppContext>
    ): Promise<WithMetadata<Attribute>> {
      logger.info(`Retrieving attribute ${origin}/${code}`);
      const attribute = await readModelService.getAttributeByOriginAndCode({
        origin,
        code,
      });
      if (attribute === undefined) {
        throw attributeNotFound(`${origin}/${code}`);
      }
      return attribute;
    },

    async getAttributeById(
      id: AttributeId,
      { logger }: WithLogger<AppContext>
    ): Promise<WithMetadata<Attribute>> {
      logger.info(`Retrieving attribute with ID ${id}`);
      const attribute = await readModelService.getAttributeById(id);
      if (attribute === undefined) {
        throw attributeNotFound(id);
      }
      return attribute;
    },

    async getAttributesByIds(
      {
        ids,
        offset,
        limit,
      }: {
        ids: AttributeId[];
        offset: number;
        limit: number;
      },
      { logger }: WithLogger<AppContext>
    ): Promise<ListResult<Attribute>> {
      logger.info(`Retrieving attributes in bulk by id in [${ids}]`);
      return await readModelService.getAttributesByIds({ ids, offset, limit });
    },

    async createDeclaredAttribute(
      apiDeclaredAttributeSeed: attributeRegistryApi.AttributeSeed,
      {
        authData,
        logger,
        correlationId,
      }: WithLogger<AppContext<UIAuthData | M2MAdminAuthData>>
    ): Promise<WithMetadata<Attribute>> {
      logger.info(
        `Creating declared attribute with name ${apiDeclaredAttributeSeed.name}}`
      );

      const origin = await retrieveOriginFromAuthData(
        authData,
        readModelService,
        retrieveTenant
      );
      if (!config.producerAllowedOrigins.includes(origin)) {
        throw originNotCompliant(origin);
      }

      const attributeWithSameName = await readModelService.getAttributeByName(
        apiDeclaredAttributeSeed.name
      );
      if (attributeWithSameName) {
        throw attributeDuplicateByName(apiDeclaredAttributeSeed.name);
      }

      const newDeclaredAttribute: Attribute = {
        id: generateId(),
        kind: attributeKind.declared,
        name: apiDeclaredAttributeSeed.name,
        description: apiDeclaredAttributeSeed.description,
        creationTime: new Date(),
        code: undefined,
        origin: undefined,
      };

      logger.info(
        `Declared attribute created with id ${newDeclaredAttribute.id}`
      );

      const event = toCreateEventAttributeAdded(
        newDeclaredAttribute,
        correlationId
      );
      const createdEvent = await repository.createEvent(event);

      return {
        data: newDeclaredAttribute,
        metadata: { version: createdEvent.newVersion },
      };
    },

    async createVerifiedAttribute(
      apiVerifiedAttributeSeed: attributeRegistryApi.AttributeSeed,
      {
        authData,
        logger,
        correlationId,
      }: WithLogger<AppContext<UIAuthData | M2MAdminAuthData>>
    ): Promise<WithMetadata<Attribute>> {
      logger.info(
        `Creating verified attribute with name ${apiVerifiedAttributeSeed.name}`
      );

      const origin = await retrieveOriginFromAuthData(
        authData,
        readModelService,
        retrieveTenant
      );
      if (!config.producerAllowedOrigins.includes(origin)) {
        throw originNotCompliant(origin);
      }

      const attributeWithSameName = await readModelService.getAttributeByName(
        apiVerifiedAttributeSeed.name
      );
      if (attributeWithSameName) {
        throw attributeDuplicateByName(apiVerifiedAttributeSeed.name);
      }

      const newVerifiedAttribute: Attribute = {
        id: generateId(),
        kind: attributeKind.verified,
        name: apiVerifiedAttributeSeed.name,
        description: apiVerifiedAttributeSeed.description,
        creationTime: new Date(),
        code: undefined,
        origin: undefined,
      };

      logger.info(
        `Verified attribute created with id ${newVerifiedAttribute.id}`
      );

      const event = toCreateEventAttributeAdded(
        newVerifiedAttribute,
        correlationId
      );
      const createdEvent = await repository.createEvent(event);

      return {
        data: newVerifiedAttribute,
        metadata: { version: createdEvent.newVersion },
      };
    },

    async createCertifiedAttribute(
      apiCertifiedAttributeSeed: attributeRegistryApi.CertifiedAttributeSeed,
      {
        authData,
        logger,
        correlationId,
      }: WithLogger<AppContext<UIAuthData | M2MAuthData | M2MAdminAuthData>>
    ): Promise<WithMetadata<Attribute>> {
      logger.info(
        `Creating certified attribute with code ${apiCertifiedAttributeSeed.code}`
      );
      const certifierPromise = getCertifierId(
        authData.organizationId,
        readModelService
      );
      const attributePromise = readModelService.getAttributeByCodeAndName(
        apiCertifiedAttributeSeed.code,
        apiCertifiedAttributeSeed.name
      );

      const [certifier, attributeWithSameName] = await Promise.all([
        certifierPromise,
        attributePromise,
      ]);

      if (attributeWithSameName) {
        throw attributeDuplicateByNameAndCode(
          apiCertifiedAttributeSeed.name,
          apiCertifiedAttributeSeed.code
        );
      }

      const newCertifiedAttribute: Attribute = {
        id: generateId(),
        kind: attributeKind.certified,
        name: apiCertifiedAttributeSeed.name,
        description: apiCertifiedAttributeSeed.description,
        creationTime: new Date(),
        code: apiCertifiedAttributeSeed.code,
        origin: certifier,
      };

      logger.info(
        `Certified attribute created with id ${newCertifiedAttribute.id}`
      );

      const event = await repository.createEvent(
        toCreateEventAttributeAdded(newCertifiedAttribute, correlationId)
      );

      return {
        data: newCertifiedAttribute,
        metadata: {
          version: event.newVersion,
        },
      };
    },

    async internalCreateCertifiedAttribute(
      apiInternalCertifiedAttributeSeed: attributeRegistryApi.InternalCertifiedAttributeSeed,
      { correlationId, logger }: WithLogger<AppContext<InternalAuthData>>
    ): Promise<Attribute> {
      logger.info(
        `Creating certified attribute with origin ${apiInternalCertifiedAttributeSeed.origin} and code ${apiInternalCertifiedAttributeSeed.code} - Internal Request`
      );

      const attributeWithSameNameAndCode =
        await readModelService.getAttributeByCodeAndName(
          apiInternalCertifiedAttributeSeed.code,
          apiInternalCertifiedAttributeSeed.name
        );
      if (attributeWithSameNameAndCode) {
        throw attributeDuplicateByNameAndCode(
          apiInternalCertifiedAttributeSeed.name,
          apiInternalCertifiedAttributeSeed.code
        );
      }

      const newInternalCertifiedAttribute: Attribute = {
        id: generateId(),
        kind: attributeKind.certified,
        name: apiInternalCertifiedAttributeSeed.name,
        description: apiInternalCertifiedAttributeSeed.description,
        creationTime: new Date(),
        code: apiInternalCertifiedAttributeSeed.code,
        origin: apiInternalCertifiedAttributeSeed.origin,
      };

      logger.info(
        `Certified attribute created with id ${newInternalCertifiedAttribute.id} - Internal Request`
      );

      const event = toCreateEventAttributeAdded(
        newInternalCertifiedAttribute,
        correlationId
      );
      await repository.createEvent(event);

      return newInternalCertifiedAttribute;
    },
  };
}

async function getCertifierId(
  tenantId: TenantId,
  readModelService: ReadModelServiceSQL
): Promise<string> {
  const tenant = await readModelService.getTenantById(tenantId);
  if (!tenant) {
    throw tenantNotFound(tenantId);
  }

  const certifier = tenant.features
    .filter(
      (feature): feature is TenantFeatureCertifier =>
        feature.type === "PersistentCertifier"
    )
    .find(({ certifierId }) => certifierId.trim().length > 0);

  if (certifier) {
    return certifier.certifierId;
  }
  throw tenantIsNotACertifier(tenantId);
}

export type AttributeRegistryService = ReturnType<
  typeof attributeRegistryServiceBuilder
>;
