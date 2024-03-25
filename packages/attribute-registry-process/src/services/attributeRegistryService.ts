import {
  AuthData,
  CreateEvent,
  DB,
  eventRepository,
} from "pagopa-interop-commons";
import {
  AttributeEvent,
  Attribute,
  WithMetadata,
  attributeEventToBinaryData,
  attributeKind,
  generateId,
  unsafeBrandId,
  AttributeId,
  operationForbidden,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
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
  tenantNotFound,
} from "../model/domain/errors.js";
import { ReadModelService } from "./readModelService.js";
import { assertProducerAllowedOrigins } from "./validators.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function attributeRegistryServiceBuilder(
  dbInstance: DB,
  readModelService: ReadModelService
) {
  const repository = eventRepository(dbInstance, attributeEventToBinaryData);

  return {
    async createDeclaredAttribute(
      apiDeclaredAttributeSeed: ApiDeclaredAttributeSeed,
      authData: AuthData,
      correlationId: string
    ): Promise<AttributeId> {
      assertProducerAllowedOrigins(authData);

      return unsafeBrandId<AttributeId>(
        await repository.createEvent(
          createDeclaredAttributeLogic(
            {
              attribute: await readModelService.getAttributeByName(
                apiDeclaredAttributeSeed.name
              ),
              apiDeclaredAttributeSeed,
            },
            correlationId
          )
        )
      );
    },

    async createVerifiedAttribute(
      apiVerifiedAttributeSeed: ApiVerifiedAttributeSeed,
      authData: AuthData,
      correlationId: string
    ): Promise<AttributeId> {
      assertProducerAllowedOrigins(authData);

      return unsafeBrandId<AttributeId>(
        await repository.createEvent(
          createVerifiedAttributeLogic(
            {
              attribute: await readModelService.getAttributeByName(
                apiVerifiedAttributeSeed.name
              ),
              apiVerifiedAttributeSeed,
            },
            correlationId
          )
        )
      );
    },
    async getCertifierId(authData: AuthData): Promise<string> {
      const tenantId = match(authData)
        .with(
          { tokenType: "m2m" },
          { tokenType: "ui" },
          (d) => d.organizationId
        )
        .with({ tokenType: "empty" }, { tokenType: "internal" }, () => {
          throw operationForbidden;
        })
        .exhaustive();

      const tenant = await readModelService.getTenantById(tenantId);
      if (!tenant) {
        throw tenantNotFound(tenantId);
      }

      const certifier = tenant.data.features
        .filter(({ type }) => type === "PersistentCertifier")
        .find(({ certifierId }) => certifierId.trim().length > 0);

      if (certifier) {
        return certifier.certifierId;
      }
      throw OrganizationIsNotACertifier(tenantId);
    },
    async createCertifiedAttribute(
      apiCertifiedAttributeSeed: ApiCertifiedAttributeSeed,
      authData: AuthData,
      correlationId: string
    ): Promise<AttributeId> {
      const certifierPromise = this.getCertifierId(authData);
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
          createCertifiedAttributeLogic(
            {
              attribute,
              apiCertifiedAttributeSeed,
              certifier,
            },
            correlationId
          )
        )
      );
    },
    async createInternalCertifiedAttribute(
      apiInternalCertifiedAttributeSeed: ApiInternalCertifiedAttributeSeed,
      correlationId: string
    ): Promise<AttributeId> {
      return unsafeBrandId<AttributeId>(
        await repository.createEvent(
          createInternalCertifiedAttributeLogic(
            {
              attribute: await readModelService.getAttributeByCodeAndName(
                apiInternalCertifiedAttributeSeed.code,
                apiInternalCertifiedAttributeSeed.name
              ),
              apiInternalCertifiedAttributeSeed,
            },
            correlationId
          )
        )
      );
    },
  };
}

export type AttributeRegistryService = ReturnType<
  typeof attributeRegistryServiceBuilder
>;

export function createDeclaredAttributeLogic(
  {
    attribute,
    apiDeclaredAttributeSeed,
  }: {
    attribute: WithMetadata<Attribute> | undefined;
    apiDeclaredAttributeSeed: ApiDeclaredAttributeSeed;
  },
  correlationId: string
): CreateEvent<AttributeEvent> {
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

  return toCreateEventAttributeAdded(newDeclaredAttribute, correlationId);
}

export function createVerifiedAttributeLogic(
  {
    attribute,
    apiVerifiedAttributeSeed,
  }: {
    attribute: WithMetadata<Attribute> | undefined;
    apiVerifiedAttributeSeed: ApiVerifiedAttributeSeed;
  },
  correlationId: string
): CreateEvent<AttributeEvent> {
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

  return toCreateEventAttributeAdded(newVerifiedAttribute, correlationId);
}

export function createCertifiedAttributeLogic(
  {
    attribute,
    apiCertifiedAttributeSeed,
    certifier,
  }: {
    attribute: WithMetadata<Attribute> | undefined;
    apiCertifiedAttributeSeed: ApiCertifiedAttributeSeed;
    certifier: string;
  },
  correlationId: string
): CreateEvent<AttributeEvent> {
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

  return toCreateEventAttributeAdded(newCertifiedAttribute, correlationId);
}

export function createInternalCertifiedAttributeLogic(
  {
    attribute,
    apiInternalCertifiedAttributeSeed,
  }: {
    attribute: WithMetadata<Attribute> | undefined;
    apiInternalCertifiedAttributeSeed: ApiInternalCertifiedAttributeSeed;
  },
  correlationId: string
): CreateEvent<AttributeEvent> {
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

  return toCreateEventAttributeAdded(
    newInternalCertifiedAttribute,
    correlationId
  );
}
