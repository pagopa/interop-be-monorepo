import {
  AuthData,
  logger,
  ReadModelRepository,
  readmodelDbConfig,
} from "pagopa-interop-commons";
import {
  DescriptorState,
  Document,
  EService,
  ErrorTypes,
  Agreement,
  AgreementState,
  descriptorState,
  agreementState,
  ListResult,
  WithMetadata,
  emptyListResult,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { z } from "zod";
import { Consumer, consumer } from "../model/domain/models.js";

const { eservices, agreements } = ReadModelRepository.init(readmodelDbConfig);

function arrayToFilter<T, F extends object>(
  array: T[],
  f: (array: T[]) => F
): F | undefined {
  return array.length > 0 ? f(array) : undefined;
}

export const readModelService = {
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
      name?: { value: string; exactMatch: boolean };
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

    const nameFilter = name
      ? {
          "data.name": {
            $regex: name.exactMatch ? `^${name.value}$$` : name.value,
            $options: "i",
          },
        }
      : {};

    const aggregationPipeline = [
      {
        $match: {
          ...nameFilter,
          ...arrayToFilter(states, (states) => ({
            "data.descriptors": { $elemMatch: { state: { $in: states } } },
          })),
          ...arrayToFilter(ids, (ids) => ({ "data.id": { $in: ids } })),
          ...arrayToFilter(producersIds, (producersIds) => ({
            "data.producerId": { $in: producersIds },
          })),
        },
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
      .aggregate([...aggregationPipeline, { $skip: offset }, { $limit: limit }])
      .toArray();

    const result = z.array(EService).safeParse(data.map((d) => d.data));
    if (!result.success) {
      logger.error(
        `Unable to parse eservices items: result ${JSON.stringify(
          result
        )} - data ${JSON.stringify(data)} `
      );

      throw ErrorTypes.GenericError;
    }

    return {
      results: result.data,
      totalCount: await ReadModelRepository.getTotalCount(
        eservices,
        aggregationPipeline
      ),
    };
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
        },
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
      .aggregate([...aggregationPipeline, { $skip: offset }, { $limit: limit }])
      .toArray();

    const result = z.array(consumer).safeParse(data);
    if (!result.success) {
      logger.error(
        `Unable to parse consumers: result ${JSON.stringify(
          result
        )} - data ${JSON.stringify(data)} `
      );

      throw ErrorTypes.GenericError;
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
    descriptorId: string,
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
          ...arrayToFilter(eservicesIds, (eservicesIds) => ({
            "data.eserviceId": { $in: eservicesIds },
          })),
          ...arrayToFilter(consumersIds, (consumersIds) => ({
            "data.consumerId": { $in: consumersIds },
          })),
          ...arrayToFilter(producersIds, (producersIds) => ({
            "data.producerId": { $in: producersIds },
          })),
          ...arrayToFilter(states, (states) => ({
            "data.state": { $elemMatch: { state: { $in: states } } },
          })),
        },
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
    const result = z.array(Agreement).safeParse(data);

    if (!result.success) {
      logger.error(
        `Unable to parse agreements: result ${JSON.stringify(
          result
        )} - data ${JSON.stringify(data)} `
      );

      throw ErrorTypes.GenericError;
    }

    return result.data;
  },
};
