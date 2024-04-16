import {
  AuthData,
  DB,
  LoggerCtx,
  eventRepository,
  logger,
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
} from "pagopa-interop-models";
import {
  ApiCertifiedAttributeSeed,
  ApiDeclaredAttributeSeed,
  ApiInternalCertifiedAttributeSeed,
  ApiVerifiedAttributeSeed,
} from "../model/types.js";
import { toCreateEventAttributeAdded } from "../model/domain/toEvent.js";
import {
  OrganizationIsNotACertifier,
  attributeDuplicate,
  attributeNotFound,
  originNotCompliant,
  tenantNotFound,
} from "../model/domain/errors.js";
import { config } from "../utilities/config.js";
import { ReadModelService } from "./readModelService.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function attributeRegistryServiceBuilder(
  dbInstance: DB,
  readModelService: ReadModelService
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
      loggerCtx: LoggerCtx
    ): Promise<ListResult<Attribute>> {
      logger.info(
        `Getting attributes with name = ${name}, limit = ${limit}, offset = ${offset}, kinds = ${kinds}`,
        loggerCtx
      );
      return await readModelService.getAttributesByKindsNameOrigin(
        {
          kinds,
          name,
          origin,
          offset,
          limit,
        },
        loggerCtx
      );
    },

    async getAttributeByName(
      name: string,
      loggerCtx: LoggerCtx
    ): Promise<WithMetadata<Attribute>> {
      logger.info(`Retrieving attribute with name ${name}`, loggerCtx);
      const attribute = await readModelService.getAttributeByName(
        name,
        loggerCtx
      );
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
      loggerCtx: LoggerCtx
    ): Promise<WithMetadata<Attribute>> {
      logger.info(`Retrieving attribute ${origin}/${code}`, loggerCtx);
      const attribute = await readModelService.getAttributeByOriginAndCode(
        {
          origin,
          code,
        },
        loggerCtx
      );
      if (attribute === undefined) {
        throw attributeNotFound(`${origin}/${code}`);
      }
      return attribute;
    },

    async getAttributeById(
      id: AttributeId,
      loggerCtx: LoggerCtx
    ): Promise<WithMetadata<Attribute>> {
      logger.info(`Retrieving attribute with ID ${id}`, loggerCtx);
      const attribute = await readModelService.getAttributeById(id, loggerCtx);
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
      loggerCtx: LoggerCtx
    ): Promise<ListResult<Attribute>> {
      logger.info(`Retrieving attributes in bulk by id in [${ids}]`, loggerCtx);
      return await readModelService.getAttributesByIds(
        { ids, offset, limit },
        loggerCtx
      );
    },

    async createDeclaredAttribute(
      apiDeclaredAttributeSeed: ApiDeclaredAttributeSeed,
      authData: AuthData,
      correlationId: string
    ): Promise<Attribute> {
      const loggerCtx = {
        userId: authData.userId,
        organizationId: authData.organizationId,
        correlationId,
      };

      logger.info(
        `Creating declared attribute with name ${apiDeclaredAttributeSeed.name}}`,
        loggerCtx
      );

      if (!config.producerAllowedOrigins.includes(authData.externalId.origin)) {
        throw originNotCompliant(authData.externalId.origin);
      }

      const attributeWithSameName = await readModelService.getAttributeByName(
        apiDeclaredAttributeSeed.name,
        loggerCtx
      );
      if (attributeWithSameName) {
        throw attributeDuplicate(apiDeclaredAttributeSeed.name);
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
        `Declared attribute created with id ${newDeclaredAttribute.id}`,
        loggerCtx
      );

      const event = toCreateEventAttributeAdded(
        newDeclaredAttribute,
        correlationId
      );
      await repository.createEvent(event, loggerCtx);

      return newDeclaredAttribute;
    },

    async createVerifiedAttribute(
      apiVerifiedAttributeSeed: ApiVerifiedAttributeSeed,
      authData: AuthData,
      correlationId: string
    ): Promise<Attribute> {
      const loggerCtx = {
        userId: authData.userId,
        organizationId: authData.organizationId,
        correlationId,
      };

      logger.info(
        `Creating verified attribute with name ${apiVerifiedAttributeSeed.name}`,
        loggerCtx
      );
      if (!config.producerAllowedOrigins.includes(authData.externalId.origin)) {
        throw originNotCompliant(authData.externalId.origin);
      }

      const attributeWithSameName = await readModelService.getAttributeByName(
        apiVerifiedAttributeSeed.name,
        loggerCtx
      );
      if (attributeWithSameName) {
        throw attributeDuplicate(apiVerifiedAttributeSeed.name);
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
        `Verified attribute created with id ${newVerifiedAttribute.id}`,
        loggerCtx
      );

      const event = toCreateEventAttributeAdded(
        newVerifiedAttribute,
        correlationId
      );
      await repository.createEvent(event, loggerCtx);

      return newVerifiedAttribute;
    },

    async createCertifiedAttribute(
      apiCertifiedAttributeSeed: ApiCertifiedAttributeSeed,
      authData: AuthData,
      correlationId: string
    ): Promise<Attribute> {
      const loggerCtx = {
        userId: authData.userId,
        organizationId: authData.organizationId,
        correlationId,
      };

      logger.info(
        `Creating certified attribute with code ${apiCertifiedAttributeSeed.code}`,
        loggerCtx
      );
      const certifierPromise = getCertifierId(
        authData.organizationId,
        readModelService,
        loggerCtx
      );
      const attributePromise = readModelService.getAttributeByCodeAndName(
        apiCertifiedAttributeSeed.code,
        apiCertifiedAttributeSeed.name,
        loggerCtx
      );

      const [certifier, attributeWithSameName] = await Promise.all([
        certifierPromise,
        attributePromise,
      ]);

      if (attributeWithSameName) {
        throw attributeDuplicate(apiCertifiedAttributeSeed.name);
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
        `Certified attribute created with id ${newCertifiedAttribute.id}`,
        loggerCtx
      );

      const event = toCreateEventAttributeAdded(
        newCertifiedAttribute,
        correlationId
      );
      await repository.createEvent(event, loggerCtx);

      return newCertifiedAttribute;
    },

    async createInternalCertifiedAttribute(
      apiInternalCertifiedAttributeSeed: ApiInternalCertifiedAttributeSeed,
      authData: AuthData,
      correlationId: string
    ): Promise<Attribute> {
      const loggerCtx = {
        userId: authData.userId,
        organizationId: authData.organizationId,
        correlationId,
      };

      logger.info(
        `Creating certified attribute with origin ${apiInternalCertifiedAttributeSeed.origin} and code ${apiInternalCertifiedAttributeSeed.code} - Internal Request`,
        loggerCtx
      );

      const attributeWithSameNameAndCode =
        await readModelService.getAttributeByCodeAndName(
          apiInternalCertifiedAttributeSeed.code,
          apiInternalCertifiedAttributeSeed.name,
          loggerCtx
        );
      if (attributeWithSameNameAndCode) {
        throw attributeDuplicate(apiInternalCertifiedAttributeSeed.name);
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
        `Certified attribute created with id ${newInternalCertifiedAttribute.id} - Internal Request`,
        loggerCtx
      );

      const event = toCreateEventAttributeAdded(
        newInternalCertifiedAttribute,
        correlationId
      );
      await repository.createEvent(event, loggerCtx);

      return newInternalCertifiedAttribute;
    },
  };
}

async function getCertifierId(
  tenantId: TenantId,
  readModelService: ReadModelService,
  loggerCtx: LoggerCtx
): Promise<string> {
  const tenant = await readModelService.getTenantById(tenantId, loggerCtx);
  if (!tenant) {
    throw tenantNotFound(tenantId);
  }

  const certifier = tenant.features
    .filter(({ type }) => type === "PersistentCertifier")
    .find(({ certifierId }) => certifierId.trim().length > 0);

  if (certifier) {
    return certifier.certifierId;
  }
  throw OrganizationIsNotACertifier(tenantId);
}

export type AttributeRegistryService = ReturnType<
  typeof attributeRegistryServiceBuilder
>;
