import {
  AppContext,
  DB,
  Logger,
  WithLogger,
  eventRepository,
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
import { toCreateEventAttributeAdded } from "../model/domain/toEvent.js";
import {
  OrganizationIsNotACertifier,
  attributeDuplicate,
  attributeNotFound,
  originNotCompliant,
  tenantNotFound,
} from "../model/domain/errors.js";
import { config } from "../utilities/config.js";
import {
  ApiCertifiedAttributeSeed,
  ApiDeclaredAttributeSeed,
  ApiInternalCertifiedAttributeSeed,
  ApiVerifiedAttributeSeed,
} from "../model/types.js";
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
      logger: Logger
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
      logger: Logger
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
      logger: Logger
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
      logger: Logger
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
      logger: Logger
    ): Promise<ListResult<Attribute>> {
      logger.info(`Retrieving attributes in bulk by id in [${ids}]`);
      return await readModelService.getAttributesByIds({ ids, offset, limit });
    },

    async createDeclaredAttribute(
      apiDeclaredAttributeSeed: ApiDeclaredAttributeSeed,
      { authData, correlationId, logger }: WithLogger<AppContext>
    ): Promise<Attribute> {
      logger.info(
        `Creating declared attribute with name ${apiDeclaredAttributeSeed.name}}`
      );

      if (!config.producerAllowedOrigins.includes(authData.externalId.origin)) {
        throw originNotCompliant(authData.externalId.origin);
      }

      const attributeWithSameName = await readModelService.getAttributeByName(
        apiDeclaredAttributeSeed.name
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
        `Declared attribute created with id ${newDeclaredAttribute.id}`
      );

      const event = toCreateEventAttributeAdded(
        newDeclaredAttribute,
        correlationId
      );
      await repository.createEvent(event);

      return newDeclaredAttribute;
    },

    async createVerifiedAttribute(
      apiVerifiedAttributeSeed: ApiVerifiedAttributeSeed,
      { authData, correlationId, logger }: WithLogger<AppContext>
    ): Promise<Attribute> {
      logger.info(
        `Creating verified attribute with name ${apiVerifiedAttributeSeed.name}`
      );
      if (!config.producerAllowedOrigins.includes(authData.externalId.origin)) {
        throw originNotCompliant(authData.externalId.origin);
      }

      const attributeWithSameName = await readModelService.getAttributeByName(
        apiVerifiedAttributeSeed.name
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
        `Verified attribute created with id ${newVerifiedAttribute.id}`
      );

      const event = toCreateEventAttributeAdded(
        newVerifiedAttribute,
        correlationId
      );
      await repository.createEvent(event);

      return newVerifiedAttribute;
    },

    async createCertifiedAttribute(
      apiCertifiedAttributeSeed: ApiCertifiedAttributeSeed,
      { authData, correlationId, logger }: WithLogger<AppContext>
    ): Promise<Attribute> {
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
        `Certified attribute created with id ${newCertifiedAttribute.id}`
      );

      const event = toCreateEventAttributeAdded(
        newCertifiedAttribute,
        correlationId
      );
      await repository.createEvent(event);

      return newCertifiedAttribute;
    },

    async createInternalCertifiedAttribute(
      apiInternalCertifiedAttributeSeed: ApiInternalCertifiedAttributeSeed,
      { correlationId, logger }: WithLogger<AppContext>
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
  readModelService: ReadModelService
): Promise<string> {
  const tenant = await readModelService.getTenantById(tenantId);
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
