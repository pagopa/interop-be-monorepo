import { WithId } from "mongodb";
import { Filter } from "mongodb";
import {
  AgreementCollection,
  AttributeCollection,
  logger,
  ReadModelRepository,
  TenantCollection,
} from "pagopa-interop-commons";
import {
  WithMetadata,
  Tenant,
  Attribute,
  ExternalId,
  AgreementState,
  Agreement,
  EService,
  genericError,
} from "pagopa-interop-models";
import { z } from "zod";
import { TenantProcessConfig } from "../utilities/config.js";
import { attributeNotFound } from "../model/domain/errors.js";

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
  agreements: AgreementCollection,
  producerId: string,
  consumerId: string,
  agreementStates: AgreementState[]
): Promise<Agreement[]> => {
  const limit = 50;
  // eslint-disable-next-line functional/no-let
  let offset = 0;
  // eslint-disable-next-line functional/no-let
  let results: Agreement[] = [];

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const agreementsChunk = await getAgreementsChunk(
      agreements,
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

async function getAttribute(
  attributes: AttributeCollection,
  filter: Filter<WithId<WithMetadata<Attribute>>>
): Promise<WithMetadata<Attribute> | undefined> {
  const data = await attributes.findOne(filter, {
    projection: { data: true, metadata: true },
  });
  if (!data) {
    return undefined;
  } else {
    const result = z
      .object({
        metadata: z.object({ version: z.number() }),
        data: Attribute,
      })
      .safeParse(data);
    if (!result.success) {
      logger.error(
        `Unable to parse attribute item: result ${JSON.stringify(
          result
        )} - data ${JSON.stringify(data)} `
      );
      throw genericError("Unable to parse attribute item");
    }
    return {
      data: result.data.data,
      metadata: { version: result.data.metadata.version },
    };
  }
}

const getAgreementsChunk = async (
  agreements: AgreementCollection,
  producerId: string,
  consumerId: string,
  agreementStates: AgreementState[],
  offset: number,
  limit: number
  // eslint-disable-next-line max-params
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
    throw genericError("Unable to parse agreements items");
  }

  return result.data;
};

async function getTenant(
  tenants: TenantCollection,
  filter: Filter<WithId<WithMetadata<Tenant>>>
): Promise<WithMetadata<Tenant> | undefined> {
  const data = await tenants.findOne(filter, {
    projection: { data: true, metadata: true },
  });

  if (!data) {
    return undefined;
  } else {
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

      throw genericError("Unable to parse tenant item");
    }

    return {
      data: result.data.data,
      metadata: { version: result.data.metadata.version },
    };
  }
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelServiceBuilder(config: TenantProcessConfig) {
  const { attributes, agreements, eservices, tenants } =
    ReadModelRepository.init(config);

  return {
    async getAttributesByExternalIds(
      externalIds: ExternalId[]
    ): Promise<Array<WithMetadata<Attribute>>> {
      const fetchAttributeByExternalId = async (
        externalId: ExternalId
      ): Promise<WithMetadata<Attribute>> => {
        const data = await getAttribute(attributes, {
          "data.origin": externalId.origin,
          "data.code": externalId.value,
        });
        if (!data) {
          throw attributeNotFound(`${externalId.origin}/${externalId.value}`);
        }
        return data;
      };

      const attributesPromises = externalIds.map(fetchAttributeByExternalId);
      return Promise.all(attributesPromises);
    },

    async getAttributesById(
      attributeIds: string[]
    ): Promise<Array<WithMetadata<Attribute>>> {
      const fetchAttributeById = async (
        id: string
      ): Promise<WithMetadata<Attribute>> => {
        const data = await getAttribute(attributes, { "data.id": id });
        if (!data) {
          throw attributeNotFound(id);
        }
        return data;
      };

      const attributePromises = attributeIds.map(fetchAttributeById);
      return Promise.all(attributePromises);
    },
    async getAgreements(
      producerId: string,
      consumerId: string,
      agreementStates: AgreementState[]
    ): Promise<Agreement[]> {
      return getAllAgreements(
        agreements,
        producerId,
        consumerId,
        agreementStates
      );
    },

    async getEServiceById(
      id: string
    ): Promise<WithMetadata<EService> | undefined> {
      const data = await eservices.findOne(
        { "data.id": id },
        { projection: { data: true, metadata: true } }
      );

      if (!data) {
        return undefined;
      } else {
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

          throw genericError("Unable to parse eservices item");
        }

        return {
          data: result.data.data,
          metadata: { version: result.data.metadata.version },
        };
      }
    },

    async getTenantById(
      tenantId: string
    ): Promise<WithMetadata<Tenant> | undefined> {
      return getTenant(tenants, { "data.id": tenantId });
    },

    async getTenantByName(
      name: string
    ): Promise<WithMetadata<Tenant> | undefined> {
      return getTenant(tenants, {
        "data.name": {
          $regex: `^${name}$$`,
          $options: "i",
        },
      });
    },

    async getTenantByExternalId(
      tenantExternalId: ExternalId
    ): Promise<WithMetadata<Tenant> | undefined> {
      return getTenant(tenants, {
        "data.externalId.code": tenantExternalId.value,
        "data.externalId.origin": tenantExternalId.origin,
      });
    },

    async getTenantBySelfcareId(
      selfcareId: string
    ): Promise<WithMetadata<Tenant> | undefined> {
      return getTenant(tenants, { "data.selfcareId": selfcareId });
    },
  };
}

export type ReadModelService = ReturnType<typeof readModelServiceBuilder>;
