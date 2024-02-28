import {
  AuthData,
  CreateEvent,
  DB,
  eventRepository,
  logger,
} from "pagopa-interop-commons";
import {
  AttributeEvent,
  Attribute,
  WithMetadata,
  attributeEventToBinaryData,
  attributeKind,
  generateId,
  TenantId,
  unsafeBrandId,
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
  originNotCompliant,
  tenantNotFound,
} from "../model/domain/errors.js";
import { ReadModelService } from "./readModelService.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function attributeRegistryServiceBuilder(
  dbInstance: DB,
  readModelService: ReadModelService
) {
  const repository = eventRepository(dbInstance, attributeEventToBinaryData);

  return {
    async createDeclaredAttribute(
      apiDeclaredAttributeSeed: ApiDeclaredAttributeSeed,
      authData: AuthData
    ): Promise<AttributeId> {
      logger.info(
        `Creating declared attribute with name ${apiDeclaredAttributeSeed.name}}`
      );
      if (authData.externalId.origin !== "IPA") {
        throw originNotCompliant("IPA");
      }

      return unsafeBrandId<AttributeId>(
        await repository.createEvent(
          createDeclaredAttributeLogic({
            attribute: await readModelService.getAttributeByName(
              apiDeclaredAttributeSeed.name
            ),
            apiDeclaredAttributeSeed,
          })
        )
      );
    },

    async createVerifiedAttribute(
      apiVerifiedAttributeSeed: ApiVerifiedAttributeSeed,
      authData: AuthData
    ): Promise<AttributeId> {
      logger.info(
        `Creating verified attribute with name ${apiVerifiedAttributeSeed.name}`
      );
      if (authData.externalId.origin !== "IPA") {
        throw originNotCompliant("IPA");
      }

      return unsafeBrandId<AttributeId>(
        await repository.createEvent(
          createVerifiedAttributeLogic({
            attribute: await readModelService.getAttributeByName(
              apiVerifiedAttributeSeed.name
            ),
            apiVerifiedAttributeSeed,
          })
        )
      );
    },
    async getCertifierId(tenantId: TenantId): Promise<string> {
      const tenant = await readModelService.getTenantById(tenantId);
      if (!tenant) {
        throw tenantNotFound(tenantId);
      }

      const certifier = tenant.data.features
        .filter(({ type }) => type === "Certifier")
        .find(({ certifierId }) => certifierId.trim().length > 0);

      if (certifier) {
        return certifier.certifierId;
      }
      throw OrganizationIsNotACertifier(tenantId);
    },
    async createCertifiedAttribute(
      apiCertifiedAttributeSeed: ApiCertifiedAttributeSeed,
      authData: AuthData
    ): Promise<AttributeId> {
      logger.info(
        `Creating certified attribute with code ${apiCertifiedAttributeSeed.code}`
      );
      const certifierPromise = this.getCertifierId(authData.organizationId);
      const attributePromise = readModelService.getAttributeByCodeAndName(
        apiCertifiedAttributeSeed.code,
        apiCertifiedAttributeSeed.name
      );

      const [certifier, attribute] = await Promise.all([
        certifierPromise,
        attributePromise,
      ]);

      return unsafeBrandId<AttributeId>(
        await repository.createEvent(
          createCertifiedAttributeLogic({
            attribute,
            apiCertifiedAttributeSeed,
            certifier,
          })
        )
      );
    },
    async createInternalCertifiedAttribute(
      apiInternalCertifiedAttributeSeed: ApiInternalCertifiedAttributeSeed
    ): Promise<AttributeId> {
      logger.info(
        `Creating certified attribute with origin ${apiInternalCertifiedAttributeSeed.origin} and code ${apiInternalCertifiedAttributeSeed.code} - Internal Request`
      );
      return unsafeBrandId<AttributeId>(
        await repository.createEvent(
          createInternalCertifiedAttributeLogic({
            attribute: await readModelService.getAttributeByCodeAndName(
              apiInternalCertifiedAttributeSeed.code,
              apiInternalCertifiedAttributeSeed.name
            ),
            apiInternalCertifiedAttributeSeed,
          })
        )
      );
    },
    async getAttributesByKindsNameOrigin({
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
    }): Promise<ListResult<Attribute>> {
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
      name: string
    ): Promise<WithMetadata<Attribute> | undefined> {
      logger.info(`Retrieving attribute with name ${name}`);
      return await readModelService.getAttributeByName(name);
    },
    async getAttributeByOriginAndCode({
      origin,
      code,
    }: {
      origin: string;
      code: string;
    }): Promise<WithMetadata<Attribute> | undefined> {
      logger.info(`Retrieving attribute ${origin}/${code}`);
      return await readModelService.getAttributeByOriginAndCode({
        origin,
        code,
      });
    },
    async getAttributeById(
      id: AttributeId
    ): Promise<WithMetadata<Attribute> | undefined> {
      logger.info(`Retrieving attribute with ID ${id}`);
      return await readModelService.getAttributeById(id);
    },
    async getAttributesByIds({
      ids,
      offset,
      limit,
    }: {
      ids: AttributeId[];
      offset: number;
      limit: number;
    }): Promise<ListResult<Attribute>> {
      logger.info(`Retrieving attributes in bulk by id in [${ids}]`);
      return await readModelService.getAttributesByIds({ ids, offset, limit });
    },
  };
}

export type AttributeRegistryService = ReturnType<
  typeof attributeRegistryServiceBuilder
>;

export function createDeclaredAttributeLogic({
  attribute,
  apiDeclaredAttributeSeed,
}: {
  attribute: WithMetadata<Attribute> | undefined;
  apiDeclaredAttributeSeed: ApiDeclaredAttributeSeed;
}): CreateEvent<AttributeEvent> {
  if (attribute) {
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

  logger.info(`Declared attribute created with id ${newDeclaredAttribute.id}`);
  return toCreateEventAttributeAdded(newDeclaredAttribute);
}

export function createVerifiedAttributeLogic({
  attribute,
  apiVerifiedAttributeSeed,
}: {
  attribute: WithMetadata<Attribute> | undefined;
  apiVerifiedAttributeSeed: ApiVerifiedAttributeSeed;
}): CreateEvent<AttributeEvent> {
  if (attribute) {
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

  logger.info(`Verified attribute created with id ${newVerifiedAttribute.id}`);
  return toCreateEventAttributeAdded(newVerifiedAttribute);
}

export function createCertifiedAttributeLogic({
  attribute,
  apiCertifiedAttributeSeed,
  certifier,
}: {
  attribute: WithMetadata<Attribute> | undefined;
  apiCertifiedAttributeSeed: ApiCertifiedAttributeSeed;
  certifier: string;
}): CreateEvent<AttributeEvent> {
  if (attribute) {
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
  return toCreateEventAttributeAdded(newCertifiedAttribute);
}

export function createInternalCertifiedAttributeLogic({
  attribute,
  apiInternalCertifiedAttributeSeed,
}: {
  attribute: WithMetadata<Attribute> | undefined;
  apiInternalCertifiedAttributeSeed: ApiInternalCertifiedAttributeSeed;
}): CreateEvent<AttributeEvent> {
  if (attribute) {
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
  return toCreateEventAttributeAdded(newInternalCertifiedAttribute);
}
