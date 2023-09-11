import { AggregationCursor, MongoClient } from "mongodb";
import { z } from "zod";
import {
  Document,
  PersistentAgreement,
  PersistentAgreementState,
  DescriptorState,
  EService,
  descriptorState,
  persistentAgreementState,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { AuthData, logger } from "pagopa-interop-commons";

import {
  Consumer,
  ListResult,
  WithMetadata,
  consumer,
  emptyListResult,
} from "../model/domain/models.js";
import { config } from "../utilities/config.js";

const {
  readModelDbUsername: username,
  readModelDbPassword: password,
  readModelDbHost: host,
  readModelDbPort: port,
  readModelDbName: database,
} = config;

const mongoDBConectionURI = `mongodb://${username}:${password}@${host}:${port}`;
const client = new MongoClient(mongoDBConectionURI);

const db = client.db(database);
const eServices = db.collection("eservices");
const agreements = db.collection("agreements");

function arrayToFilter<T, F extends object>(
  array: T[],
  f: (array: T[]) => F
): F | undefined {
  return array.length > 0 ? f(array) : undefined;
}

async function getTotalCount(
  query: AggregationCursor<Document>
): Promise<number> {
  const data = await query.toArray();
  const result = z.array(z.object({ count: z.number() })).safeParse(data);

  if (result.success && result.data.length > 0) {
    return result.data[0].count;
  }

  logger.warn(
    `Unable to get total count from aggregation pipeline: result ${JSON.stringify(
      result
    )} - data ${JSON.stringify(data)} `
  );
  return 0;
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
      agreementStates: PersistentAgreementState[];
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

    const data = await eServices
      .aggregate([...aggregationPipeline, { $skip: offset }, { $limit: limit }])
      .toArray();

    const result = z.array(EService).safeParse(data.map((d) => d.data));
    if (!result.success) {
      logger.warn(
        `Unable to parse eservices items: result ${JSON.stringify(
          result
        )} - data ${JSON.stringify(data)} `
      );

      return emptyListResult;
    }

    return {
      results: result.data,
      totalCount: await getTotalCount(
        eServices.aggregate([...aggregationPipeline, { $count: "count" }])
      ),
    };
  },
  async getEServiceById(
    id: string
  ): Promise<WithMetadata<EService> | undefined> {
    const data = await eServices.findOne(
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
        logger.warn(
          `Unable to parse eservices item: result ${JSON.stringify(
            result
          )} - data ${JSON.stringify(data)} `
        );

        return undefined;
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
          "data.descriptors.state": {
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
            $in: [
              persistentAgreementState.active,
              persistentAgreementState.suspended,
            ],
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

    const data = await eServices
      .aggregate([...aggregationPipeline, { $skip: offset }, { $limit: limit }])
      .toArray();

    const result = z.array(consumer).safeParse(data);
    if (!result.success) {
      logger.warn(
        `Unable to parse consumers: result ${JSON.stringify(
          result
        )} - data ${JSON.stringify(data)} `
      );

      return emptyListResult;
    }

    return {
      results: result.data,
      totalCount: await getTotalCount(
        eServices.aggregate([...aggregationPipeline, { $count: "count" }])
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
    states: PersistentAgreementState[]
  ): Promise<PersistentAgreement[]> {
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
    const result = z.array(PersistentAgreement).safeParse(data);

    if (!result.success) {
      logger.warn(
        `Unable to parse agreements: result ${JSON.stringify(
          result
        )} - data ${JSON.stringify(data)} `
      );

      return [];
    }

    return result.data;
  },
};
