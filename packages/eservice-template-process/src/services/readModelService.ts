import {
  EServiceTemplateCollection,
  ReadModelRepository,
  TenantCollection,
} from "pagopa-interop-commons";
import {
  Attribute,
  AttributeId,
  EServiceTemplate,
  EServiceTemplateId,
  ListResult,
  Tenant,
  TenantId,
  TenantReadModel,
  WithMetadata,
  descriptorState,
  genericInternalError,
} from "pagopa-interop-models";
import { Filter, WithId } from "mongodb";
import { z } from "zod";
import {
  ApiGetEServiceTemplateIstancesFilters,
  EServiceTemplateInstance,
} from "../model/domain/models.js";

async function getEServiceTemplate(
  eserviceTemplates: EServiceTemplateCollection,
  filter: Filter<WithId<WithMetadata<EServiceTemplate>>>
): Promise<WithMetadata<EServiceTemplate> | undefined> {
  const data = await eserviceTemplates.findOne(filter, {
    projection: { data: true, metadata: true },
  });
  if (!data) {
    return undefined;
  } else {
    const result = z
      .object({
        metadata: z.object({ version: z.number() }),
        data: EServiceTemplate,
      })
      .safeParse(data);
    if (!result.success) {
      throw genericInternalError(
        `Unable to parse eService item: result ${JSON.stringify(
          result
        )} - data ${JSON.stringify(data)} `
      );
    }
    return {
      data: result.data.data,
      metadata: { version: result.data.metadata.version },
    };
  }
}

async function getTenant(
  tenants: TenantCollection,
  filter: Filter<WithId<WithMetadata<TenantReadModel>>>
): Promise<Tenant | undefined> {
  const data = await tenants.findOne(filter, {
    projection: { data: true, metadata: true },
  });

  if (!data) {
    return undefined;
  }
  const result = Tenant.safeParse(data.data);

  if (!result.success) {
    throw genericInternalError(
      `Unable to parse tenant item: result ${JSON.stringify(
        result
      )} - data ${JSON.stringify(data)} `
    );
  }

  return result.data;
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelServiceBuilder({
  eserviceTemplates,
  tenants,
  attributes,
  eservices,
}: ReadModelRepository) {
  return {
    async getEServiceTemplateById(
      id: EServiceTemplateId
    ): Promise<WithMetadata<EServiceTemplate> | undefined> {
      return getEServiceTemplate(eserviceTemplates, { "data.id": id });
    },

    async getEServiceTemplateByNameAndCreatorId({
      name,
      creatorId,
    }: {
      name: string;
      creatorId: TenantId;
    }): Promise<WithMetadata<EServiceTemplate> | undefined> {
      return getEServiceTemplate(eserviceTemplates, {
        "data.name": {
          $regex: `^${ReadModelRepository.escapeRegExp(name)}$$`,
          $options: "i",
        },
        "data.creatorId": creatorId,
      });
    },

    async getTenantById(id: TenantId): Promise<Tenant | undefined> {
      return getTenant(tenants, { "data.id": id });
    },

    async getAttributesByIds(
      attributesIds: AttributeId[]
    ): Promise<Attribute[]> {
      const data = await attributes
        .find({
          "data.id": { $in: attributesIds },
        })
        .toArray();

      const result = z.array(Attribute).safeParse(data.map((d) => d.data));
      if (!result.success) {
        throw genericInternalError(
          `Unable to parse attributes items: result ${JSON.stringify(
            result
          )} - data ${JSON.stringify(data)} `
        );
      }

      return result.data;
    },

    async getEServiceTemplateInstances({
      eserviceTemplate,
      filters,
      offset,
      limit,
    }: {
      eserviceTemplate: EServiceTemplate;
      filters: ApiGetEServiceTemplateIstancesFilters;
      offset: number;
      limit: number;
    }): Promise<ListResult<EServiceTemplateInstance>> {
      const { producerName, states } = filters;

      const producerNameFilter = producerName
        ? {
            "data.producerName": {
              $regex: ReadModelRepository.escapeRegExp(producerName),
              $options: "i",
            },
          }
        : {};

      const descriptorsStateFilter =
        states.length > 0
          ? {
              "data.latestVersion.state": { $in: states },
            }
          : {};

      const aggregationPipeline = [
        {
          $match: {
            "data.templateId": eserviceTemplate.id,
            $or: [
              { "data.descriptors.1": { $exists: true } },
              {
                "data.descriptors": { $size: 1 },
                "data.descriptors.0.state": {
                  $ne: descriptorState.draft,
                },
              },
            ],
          },
        },
        {
          $lookup: {
            from: "tenants",
            localField: "data.producerId",
            foreignField: "data.id",
            as: "producer",
          },
        },
        {
          $addFields: {
            "data.producerName": { $arrayElemAt: ["$producer.data.name", 0] },
          },
        },
        { $match: producerNameFilter },
        {
          $addFields: {
            "data.descriptors": {
              $filter: {
                input: "$data.descriptors",
                as: "descriptor",
                cond: {
                  $ne: ["$$descriptor.state", descriptorState.draft],
                },
              },
            },
          },
        },
        {
          $unwind: "$data.descriptors",
        },
        {
          $sort: {
            "data.descriptors.version": -1,
          },
        },
        {
          $group: {
            _id: "$_id",
            data: { $first: "$data" },
            latestVersion: { $first: "$data.descriptors" },
          },
        },
        {
          $addFields: {
            "data.latestVersion": "$latestVersion",
          },
        },
        { $match: descriptorsStateFilter },
        {
          $project: {
            id: "$data.id",
            instanceId: "$data.instanceId",
            producerName: "$data.producerName",
            state: "$data.latestVersion.state",
            templateVersionId: "$data.latestVersion.templateVersionId",
            lowerProducerName: {
              $toLower: "$data.producerName",
            },
          },
        },
        {
          $sort: { lowerProducerName: 1 },
        },
      ];

      const data = await eservices
        .aggregate(
          [...aggregationPipeline, { $skip: offset }, { $limit: limit }],
          { allowDiskUse: true }
        )
        .map((data) => ({
          id: data.id,
          instanceId: data.instanceId,
          producerName: data.producerName,
          state: data.state,
          version: eserviceTemplate.versions.find(
            (v) => v.id === data.templateVersionId
          )?.version,
        }))
        .toArray();

      const result = z.array(EServiceTemplateInstance).safeParse(data);

      if (!result.success) {
        throw genericInternalError(
          `Unable to parse eservice instance items: result ${JSON.stringify(
            result
          )} - data ${JSON.stringify(data)} `
        );
      }

      return {
        results: result.data,
        totalCount: await ReadModelRepository.getTotalCount(
          eservices,
          aggregationPipeline
        ),
      };
    },
  };
}

export type ReadModelService = ReturnType<typeof readModelServiceBuilder>;
