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
  ListResult,
  EService,
} from "pagopa-interop-models";
import { z } from "zod";
import { config } from "../utilities/config.js";

const { tenants, attributes, agreements, eservices } =
  ReadModelRepository.init(config);

const getAgreementsFilters = (
  producerId: string | undefined,
  consumerId: string | undefined,
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
  producerId: string | undefined,
  consumerId: string | undefined,
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
  producerId: string | undefined,
  consumerId: string | undefined,
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

async function getAttributeByExternalCode(
  code: string,
  origin: string
): Promise<WithMetadata<Attribute>> {
  const data = await attributes.findOne(
    { "data.code": code, "data.origin": origin },
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
    throw AttributeNotFound(`${origin}/${code}`);
  }
}
export const readModelService = {
  async getAgreements(
    producerId: string | undefined,
    consumerId: string | undefined,
    agreementStates: AgreementState[]
  ): Promise<Agreement[]> {
    return getAllAgreements(producerId, consumerId, agreementStates);
  },

  async getAttributes(
    attributes: ExternalId[]
  ): Promise<Array<WithMetadata<Attribute>>> {
    const promiseAttribute = attributes.map((attribute) =>
      getAttributeByExternalCode(attribute.origin, attribute.value)
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

  async getAttributeById(
    attributeId: string
  ): Promise<WithMetadata<TenantAttribute> | undefined> {
    const data = await tenants.findOne(
      { "data.id": attributeId },
      { projection: { data: true, metadata: true } }
    );

    if (data) {
      const result = z
        .object({
          metadata: z.object({ version: z.number() }),
          data: TenantAttribute,
        })
        .safeParse(data);

      if (!result.success) {
        logger.error(
          `Unable to parse attribute item: result ${JSON.stringify(
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
