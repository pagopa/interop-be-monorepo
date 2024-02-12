import {
  AuthData,
  logger,
  ReadModelRepository,
  ReadModelFilter,
  EServiceCollection,
} from "pagopa-interop-commons";
import {
  DescriptorState,
  Document,
  EService,
  Agreement,
  AgreementState,
  descriptorState,
  agreementState,
  ListResult,
  emptyListResult,
  genericError,
  DescriptorId,
  WithMetadata,
  Attribute,
  EServiceId,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { z } from "zod";
import { Filter, WithId } from "mongodb";
import { Consumer, consumer } from "../model/domain/models.js";

async function getEService(
  eservices: EServiceCollection,
  filter: Filter<WithId<WithMetadata<EService>>>
): Promise<WithMetadata<EService> | undefined> {
  const data = await eservices.findOne(filter, {
    projection: { data: true, metadata: true },
  });
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
        `Unable to parse eService item: result ${JSON.stringify(
          result
        )} - data ${JSON.stringify(data)} `
      );
      throw genericError("Unable to parse eService item");
    }
    return {
      data: result.data.data,
      metadata: { version: result.data.metadata.version },
    };
  }
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelServiceBuilder(
  readModelRepository: ReadModelRepository
) {
  const eservices = readModelRepository.eservices;
  const agreements = readModelRepository.agreements;
  const attributes = readModelRepository.attributes;
  return {
    async getEServices(
      authData: AuthData,
      {
        eservicesIds,
        producersIds,
        states,
        agreementStates,
        name,
      }: {
        eservicesIds: string[];
        producersIds: string[];
        states: DescriptorState[];
        agreementStates: AgreementState[];
        name?: string;
      },
      offset: number,
      limit: number
    ): Promise<ListResult<EService>> {
      const ids = await match(agreementStates.length)
        .with(0, () => eservicesIds)
        .otherwise(async () =>
          (
            await this.listAgreements(
              eservicesIds,
              [authData.organizationId],
              [],
              agreementStates
            )
          ).map((a) => a.eserviceId)
        );

      if (agreementStates.length > 0 && ids.length === 0) {
        return emptyListResult;
      }

      const nameFilter: ReadModelFilter<EService> = name
        ? {
            "data.name": {
              $regex: name,
              $options: "i",
            },
          }
        : {};

      const aggregationPipeline = [
        {
          $match: {
            ...nameFilter,
            ...ReadModelRepository.arrayToFilter(states, {
              "data.descriptors": { $elemMatch: { state: { $in: states } } },
            }),
            ...ReadModelRepository.arrayToFilter(ids, {
              "data.id": { $in: ids },
            }),
            ...ReadModelRepository.arrayToFilter(producersIds, {
              "data.producerId": { $in: producersIds },
            }),
          } satisfies ReadModelFilter<EService>,
        },
        {
          $project: {
            data: 1,
            computedColumn: { $toLower: ["$data.name"] },
          },
        },
        {
          $sort: { computedColumn: 1 },
        },
      ];

      const data = await eservices
        .aggregate([
          ...aggregationPipeline,
          { $skip: offset },
          { $limit: limit },
        ])
        .toArray();

      const result = z.array(EService).safeParse(data.map((d) => d.data));
      if (!result.success) {
        logger.error(
          `Unable to parse eservices items: result ${JSON.stringify(
            result
          )} - data ${JSON.stringify(data)} `
        );

        throw genericError("Unable to parse eservices items");
      }

      return {
        results: result.data,
        totalCount: await ReadModelRepository.getTotalCount(
          eservices,
          aggregationPipeline
        ),
      };
    },
    async getEServiceByNameAndProducerId({
      name,
      producerId,
    }: {
      name: string;
      producerId: string;
    }): Promise<WithMetadata<EService> | undefined> {
      return getEService(eservices, {
        "data.name": {
          $regex: `^${name}$$`,
          $options: "i",
        },
        "data.producerId": producerId,
      });
    },
    async getEServiceById(
      id: string
    ): Promise<WithMetadata<EService> | undefined> {
      return getEService(eservices, { "data.id": id });
    },
    async getEServiceConsumers(
      eServiceId: string,
      offset: number,
      limit: number
    ): Promise<ListResult<Consumer>> {
      const aggregationPipeline = [
        {
          $match: {
            "data.id": eServiceId,
            "data.descriptors": {
              $elemMatch: {
                state: {
                  $in: [
                    descriptorState.published,
                    descriptorState.deprecated,
                    descriptorState.suspended,
                  ],
                },
              },
            },
          } satisfies ReadModelFilter<EService>,
        },
        {
          $lookup: {
            from: "agreements",
            localField: "data.id",
            foreignField: "data.eserviceId",
            as: "agreements",
          },
        },
        {
          $unwind: "$agreements",
        },
        {
          $lookup: {
            from: "tenants",
            localField: "agreements.data.consumerId",
            foreignField: "data.id",
            as: "tenants",
          },
        },
        { $unwind: "$tenants" },
        {
          $match: {
            "agreements.data.state": {
              $in: [agreementState.active, agreementState.suspended],
            },
          },
        },
        {
          $addFields: {
            validDescriptor: {
              $filter: {
                input: "$data.descriptors",
                as: "fd",
                cond: {
                  $eq: ["$$fd.id", "$agreements.data.descriptorId"],
                },
              },
            },
          },
        },
        {
          $unwind: "$validDescriptor",
        },
        {
          $match: {
            validDescriptor: { $exists: true },
          },
        },
        {
          $project: {
            descriptorVersion: "$validDescriptor.version",
            descriptorState: "$validDescriptor.state",
            agreementState: "$agreements.data.state",
            consumerName: "$tenants.data.name",
            consumerExternalId: "$tenants.data.externalId.value",
            lowerName: { $toLower: ["$tenants.data.name"] },
          },
        },
        {
          $sort: { lowerName: 1 },
        },
      ];

      const data = await eservices
        .aggregate([
          ...aggregationPipeline,
          { $skip: offset },
          { $limit: limit },
        ])
        .toArray();

      const result = z.array(consumer).safeParse(data);
      if (!result.success) {
        logger.error(
          `Unable to parse consumers: result ${JSON.stringify(
            result
          )} - data ${JSON.stringify(data)} `
        );

        throw genericError("Unable to parse consumers");
      }

      return {
        results: result.data,
        totalCount: await ReadModelRepository.getTotalCount(
          eservices,
          aggregationPipeline
        ),
      };
    },
    async getDocumentById(
      eServiceId: string,
      descriptorId: DescriptorId,
      documentId: string
    ): Promise<Document | undefined> {
      const eService = await this.getEServiceById(eServiceId);
      return eService?.data.descriptors
        .find((d) => d.id === descriptorId)
        ?.docs.find((d) => d.id === documentId);
    },
    async listAgreements(
      eservicesIds: string[],
      consumersIds: string[],
      producersIds: string[],
      states: AgreementState[]
    ): Promise<Agreement[]> {
      const aggregationPipeline = [
        {
          $match: {
            ...ReadModelRepository.arrayToFilter(eservicesIds, {
              "data.eserviceId": { $in: eservicesIds },
            }),
            ...ReadModelRepository.arrayToFilter(consumersIds, {
              "data.consumerId": { $in: consumersIds },
            }),
            ...ReadModelRepository.arrayToFilter(producersIds, {
              "data.producerId": { $in: producersIds },
            }),
            ...ReadModelRepository.arrayToFilter(states, {
              "data.state": { $in: states },
            }),
          } satisfies ReadModelFilter<Agreement>,
        },
        {
          $project: {
            data: 1,
          },
        },
        {
          $sort: { "data.id": 1 },
        },
      ];
      const data = await agreements.aggregate(aggregationPipeline).toArray();
      const result = z.array(Agreement).safeParse(data.map((a) => a.data));

      if (!result.success) {
        logger.error(
          `Unable to parse agreements: result ${JSON.stringify(
            result
          )} - data ${JSON.stringify(data)} `
        );

        throw genericError("Unable to parse agreements");
      }

      return result.data;
    },

    async listAgreementsForEServiceDescriptor({
      eServiceId,
      descriptorId,
    }: {
      eServiceId: EServiceId;
      descriptorId: DescriptorId;
    }): Promise<Agreement[]> {
      const aggregationPipeline = [
        {
          $match: {
            "data.eserviceId": { $eq: eServiceId },
            "data.descriptorId": { $eq: descriptorId },
            "data.state": {
              $in: [agreementState.active, agreementState.suspended],
            },
          } satisfies ReadModelFilter<Agreement>,
        },
        {
          $project: {
            data: 1,
          },
        },
        {
          $sort: { "data.id": 1 },
        },
      ];
      const data = await agreements.aggregate(aggregationPipeline).toArray();
      const result = z.array(Agreement).safeParse(data.map((a) => a.data));

      if (!result.success) {
        logger.error(
          `Unable to parse agreements: result ${JSON.stringify(
            result
          )} - data ${JSON.stringify(data)} `
        );

        throw genericError("Unable to parse agreements");
      }

      return result.data;
    },

    async getAttributesByIds(attributesIds: string[]): Promise<Attribute[]> {
      const data = await attributes
        .find({
          "data.id": { $in: attributesIds },
        })
        .toArray();

      const result = z.array(Attribute).safeParse(data.map((d) => d.data));
      if (!result.success) {
        logger.error(
          `Unable to parse attributes items: result ${JSON.stringify(
            result
          )} - data ${JSON.stringify(data)} `
        );

        throw genericError("Unable to parse attributes items");
      }

      return result.data;
    },
  };
}

export type ReadModelService = ReturnType<typeof readModelServiceBuilder>;
