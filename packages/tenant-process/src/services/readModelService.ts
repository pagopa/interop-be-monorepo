/* eslint-disable no-constant-condition */
/* eslint-disable functional/no-let */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { logger, ReadModelRepository } from "pagopa-interop-commons";
import {
  ErrorTypes,
  WithMetadata,
  Tenant,
  TenantAttribute,
  Attribute,
  ExternalId,
  AttributeNotFound,
  AgreementState,
  Agreement,
  EService,
} from "pagopa-interop-models";
import { z } from "zod";
import { config } from "../utilities/config.js";

const { tenants, attributes, agreements, eservices } =
  ReadModelRepository.init(config);

const getAgreementsFilters = (
  producerId: string,
  consumerId: string,
  agreementStates: AgreementState[]
): object => {
  const filters = {
    ...(producerId && { "data.producerId": producerId }),
    ...(consumerId && { "data.consumerId": consumerId }),
    ...(agreementStates.length > 0 && {
      "data.state": {
        $in: agreementStates.map((s) => s.toString()),
      },
    }),
  };
  return { $match: filters };
};

const getAllAgreements = async (
  producerId: string,
  consumerId: string,
  agreementStates: AgreementState[]
): Promise<Agreement[]> => {
  const limit = 50;
  let offset = 0;
  let results: Agreement[] = [];

  while (true) {
    const agreementsChunk = await getAgreementsConst(
      producerId,
      consumerId,
      agreementStates,
      offset,
      limit
    );

    results = results.concat(agreementsChunk);

    if (agreementsChunk.length < limit) {
      break;
    }

    offset += limit;
  }

  return results;
};

const getAgreementsConst = async (
  producerId: string,
  consumerId: string,
  agreementStates: AgreementState[],
  offset: number,
  limit: number
): Promise<Agreement[]> => {
  const data = await agreements
    .aggregate([
      getAgreementsFilters(producerId, consumerId, agreementStates),
      { $skip: offset },
      { $limit: limit },
    ])
    .toArray();

  const result = z.array(Agreement).safeParse(data);

  if (!result.success) {
    logger.error(
      `Unable to parse agreements items: result ${JSON.stringify(
        result
      )} - data ${JSON.stringify(data)} `
    );
    throw ErrorTypes.GenericError;
  }

  return result.data;
};

async function getAttributeByExternalId(
  externalId: ExternalId
): Promise<WithMetadata<Attribute>> {
  const data = await attributes.findOne(
    { "data.origin": externalId.origin, "data.code": externalId.value },
    { projection: { data: true, metadata: true } }
  );

  if (data) {
    const result = z
      .object({
        metadata: z.object({ version: z.number() }),
        data: Attribute,
      })
      .safeParse(data);

    if (!result.success) {
      logger.error(
        `Unable to parse tenant item: result ${JSON.stringify(
          result
        )} - data ${JSON.stringify(data)} `
      );

      throw ErrorTypes.GenericError;
    }

    return {
      data: result.data.data,
      metadata: { version: result.data.metadata.version },
    };
  } else {
    throw AttributeNotFound(`${externalId.origin}/${externalId.value}`);
  }
}

async function getAttributeById(
  attributeId: string
): Promise<WithMetadata<Attribute>> {
  const data = await attributes.findOne(
    { "data.id": attributeId },
    { projection: { data: true, metadata: true } }
  );

  if (data) {
    const result = z
      .object({
        metadata: z.object({ version: z.number() }),
        data: Attribute,
      })
      .safeParse(data);

    if (!result.success) {
      logger.error(
        `Unable to parse tenant item: result ${JSON.stringify(
          result
        )} - data ${JSON.stringify(data)} `
      );

      throw ErrorTypes.GenericError;
    }

    return {
      data: result.data.data,
      metadata: { version: result.data.metadata.version },
    };
  } else {
    throw AttributeNotFound(attributeId);
  }
}

export const readModelService = {
  async getAgreements(
    producerId: string,
    consumerId: string,
    agreementStates: AgreementState[]
  ): Promise<Agreement[]> {
    return getAllAgreements(producerId, consumerId, agreementStates);
  },

  async getAttributesByExternalIds(
    externalIds: ExternalId[]
  ): Promise<Array<WithMetadata<Attribute>>> {
    const attributesPromises = externalIds.map((externalId) =>
      getAttributeByExternalId(externalId)
    );
    return Promise.all(attributesPromises);
  },

  async getAttributesById(
    attributesIds: string[]
  ): Promise<Array<WithMetadata<Attribute>>> {
    const promiseAttribute = attributesIds.map((attributeId) =>
      getAttributeById(attributeId)
    );
    return Promise.all(promiseAttribute);
  },

  async getEServiceById(
    id: string
  ): Promise<WithMetadata<EService> | undefined> {
    const data = await eservices.findOne(
      { "data.id": id },
      { projection: { data: true, metadata: true } }
    );

    if (data) {
      const result = z
        .object({
          metadata: z.object({ version: z.number() }),
          data: EService,
        })
        .safeParse(data);

      if (!result.success) {
        logger.error(
          `Unable to parse eservices item: result ${JSON.stringify(
            result
          )} - data ${JSON.stringify(data)} `
        );

        throw ErrorTypes.GenericError;
      }

      return {
        data: result.data.data,
        metadata: { version: result.data.metadata.version },
      };
    }

    return undefined;
  },

  async getTenantById(
    tenantId: string
  ): Promise<WithMetadata<Tenant> | undefined> {
    const data = await tenants.findOne(
      { "data.id": tenantId },
      { projection: { data: true, metadata: true } }
    );

    if (data) {
      const result = z
        .object({
          metadata: z.object({ version: z.number() }),
          data: Tenant,
        })
        .safeParse(data);

      if (!result.success) {
        logger.error(
          `Unable to parse tenant item: result ${JSON.stringify(
            result
          )} - data ${JSON.stringify(data)} `
        );

        throw ErrorTypes.GenericError;
      }

      return {
        data: result.data.data,
        metadata: { version: result.data.metadata.version },
      };
    }
    return undefined;
  },

  async getTenantByName(
    name: string
  ): Promise<WithMetadata<Tenant> | undefined> {
    const data = await tenants.findOne(
      {
        "data.name": {
          $regex: `^${name}$$`,
          $options: "i",
        },
      },
      {
        projection: { data: true, metadata: true },
      }
    );
    if (data) {
      const result = z
        .object({
          metadata: z.object({ version: z.number() }),
          data: Tenant,
        })
        .safeParse(data);
      if (!result.success) {
        logger.error(
          `Unable to parse tenant item: result ${JSON.stringify(
            result
          )} - data ${JSON.stringify(data)} `
        );
        throw ErrorTypes.GenericError;
      }
      return {
        data: result.data.data,
        metadata: { version: result.data.metadata.version },
      };
    }
    return undefined;
  },
};
