import {
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
  EService,
  genericError,
  ListResult,
  agreementState,
  AttributeId,
  TenantId,
  EServiceId,
  attributeKind,
} from "pagopa-interop-models";
import { z } from "zod";
import { Document, Filter, WithId } from "mongodb";
import { attributeNotFound } from "../model/domain/errors.js";
import { TenantProcessConfig } from "../utilities/config.js";
import { ApiCertifiedAttribute } from "../model/domain/models.js";

function listTenantsFilters(
  name: string | undefined
): Filter<{ data: Tenant }> {
  const nameFilter = name
    ? {
        "data.name": {
          $regex: name,
          $options: "i",
        },
      }
    : {};

  const withSelfcareIdFilter = {
    "data.selfcareId": {
      $exists: true,
    },
  };

  return {
    ...nameFilter,
    ...withSelfcareIdFilter,
  };
}

export const getTenants = async ({
  tenants,
  aggregationPipeline,
  offset,
  limit,
  allowDiskUse = false,
}: {
  tenants: TenantCollection;
  aggregationPipeline: Array<Filter<Tenant>>;
  offset: number;
  limit: number;
  allowDiskUse?: boolean;
}): Promise<{
  results: Tenant[];
  totalCount: number;
}> => {
  const data = await tenants
    .aggregate([...aggregationPipeline, { $skip: offset }, { $limit: limit }], {
      allowDiskUse,
    })
    .toArray();

  const result = z.array(Tenant).safeParse(data.map((d) => d.data));

  if (!result.success) {
    logger.error(
      `Unable to parse tenants items: result ${JSON.stringify(
        result
      )} - data ${JSON.stringify(data)} `
    );
    throw genericError("Unable to parse tenants items");
  }
  return {
    results: result.data,
    totalCount: await ReadModelRepository.getTotalCount(
      tenants,
      aggregationPipeline,
      allowDiskUse
    ),
  };
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
  const { attributes, eservices, tenants } = ReadModelRepository.init(config);
  return {
    async getTenantsByName({
      name,
      offset,
      limit,
    }: {
      name: string | undefined;
      offset: number;
      limit: number;
    }): Promise<ListResult<Tenant>> {
      const query = listTenantsFilters(name);
      const aggregationPipeline = [
        { $match: query },
        { $project: { data: 1, lowerName: { $toLower: "$data.name" } } },
        { $sort: { lowerName: 1 } },
      ];

      return getTenants({
        tenants,
        aggregationPipeline,
        offset,
        limit,
      });
    },

    async getTenantById(
      id: TenantId
    ): Promise<WithMetadata<Tenant> | undefined> {
      return getTenant(tenants, { "data.id": id });
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
      externalId: ExternalId
    ): Promise<WithMetadata<Tenant> | undefined> {
      return getTenant(tenants, {
        "data.externalId.value": externalId.value,
        "data.externalId.origin": externalId.origin,
      });
    },

    async getTenantBySelfcareId(
      selfcareId: string
    ): Promise<WithMetadata<Tenant> | undefined> {
      return getTenant(tenants, { "data.selfcareId": selfcareId });
    },

    async getConsumers({
      name,
      producerId,
      offset,
      limit,
    }: {
      name: string | undefined;
      producerId: TenantId;
      offset: number;
      limit: number;
    }): Promise<ListResult<Tenant>> {
      const query = listTenantsFilters(name);

      const aggregationPipeline = [
        { $match: query },
        {
          $lookup: {
            from: "agreements",
            localField: "data.id",
            foreignField: "data.consumerId",
            as: "agreements",
          },
        },
        {
          $match: {
            $and: [
              { "agreements.data.producerId": producerId },
              {
                "agreements.data.state": {
                  $in: [agreementState.active, agreementState.suspended],
                },
              },
            ],
          },
        },
        { $project: { data: 1, lowerName: { $toLower: "$data.name" } } },
        { $sort: { lowerName: 1 } },
      ];

      return getTenants({
        tenants,
        aggregationPipeline,
        offset,
        limit,
        allowDiskUse: true,
      });
    },

    async getProducers({
      name,
      offset,
      limit,
    }: {
      name: string | undefined;
      offset: number;
      limit: number;
    }): Promise<ListResult<Tenant>> {
      const query = listTenantsFilters(name);
      const aggregationPipeline = [
        { $match: query },
        {
          $lookup: {
            from: "eservices",
            localField: "data.id",
            foreignField: "data.producerId",
            as: "eservices",
          },
        },
        { $match: { eservices: { $not: { $size: 0 } } } },
        { $project: { data: 1, lowerName: { $toLower: "$data.name" } } },
        { $sort: { lowerName: 1 } },
      ];

      return getTenants({
        tenants,
        aggregationPipeline,
        offset,
        limit,
        allowDiskUse: true,
      });
    },
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
      attributeIds: AttributeId[]
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

    async getEServiceById(
      id: EServiceId
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

    async getCertifiedAttributes({
      certifierId,
      offset,
      limit,
    }: {
      certifierId: string;
      offset: number;
      limit: number;
    }): Promise<ListResult<ApiCertifiedAttribute>> {
      const aggregationPipeline: Document[] = [
        {
          $match: {
            "data.kind": attributeKind.certified,
            "data.origin": certifierId,
          },
        },
        {
          $lookup: {
            from: "tenants",
            localField: "data.id",
            foreignField: "data.attributes.id",
            as: "tenants",
          },
        },
        { $unwind: "$tenants" },
        { $unwind: "$tenants.data.attributes" },
        {
          $addFields: {
            notRevoked: {
              $cond: {
                if: {
                  $and: [
                    { $eq: ["$tenants.data.attributes.id", "$data.id"] },
                    { $not: ["$tenants.data.attributes.revocationTimestamp"] },
                  ],
                },
                then: true,
                else: false,
              },
            },
          },
        },
        {
          $match: {
            notRevoked: true,
          },
        },
        {
          $project: {
            _id: 0,
            id: "$tenants.data.id",
            name: "$tenants.data.name",
            attributeId: "$data.id",
            attributeName: "$data.name",
            lowerName: { $toLower: "$tenants.data.name" },
          },
        },
        {
          $sort: {
            lowerName: 1,
          },
        },
      ];

      const data = await tenants
        .aggregate(
          [...aggregationPipeline, { $skip: offset }, { $limit: limit }],
          { allowDiskUse: true }
        )
        .toArray();

      const result = z.array(ApiCertifiedAttribute).safeParse(data);

      if (!result.success) {
        logger.error(
          `Unable to parse attributes items: result ${JSON.stringify(
            result
          )} - data ${JSON.stringify(data)} `
        );

        throw genericError("Unable to parse attributes items");
      }

      return {
        results: result.data,
        totalCount: await ReadModelRepository.getTotalCount(
          attributes,
          aggregationPipeline
        ),
      };
    },
  };
}

export type ReadModelService = ReturnType<typeof readModelServiceBuilder>;
