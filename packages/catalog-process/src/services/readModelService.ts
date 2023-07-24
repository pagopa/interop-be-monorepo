import { MongoClient } from "mongodb";
import { z } from "zod";
import {
  catalogItem,
  CatalogItem,
  Document,
  persistentAgreement,
  PersistentAgreement,
  PersistentAgreementState,
  DescriptorState,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { AuthData } from "pagopa-interop-commons";

import {
  Consumer,
  ListResult,
  consumer,
  emptyListResult,
} from "../model/domain/models.js";
import { config } from "../utilities/config.js";

const client = new MongoClient(config.mongoUri);

const db = client.db("readmodel");
const catalog = db.collection("eservices");
const agreements = db.collection("agreements");

function arrayToFilter<T, F extends object>(
  array: T[],
  f: (array: T[]) => F
): F | undefined {
  return array.length > 0 ? f(array) : undefined;
}

export const readModelGateway = {
  async getCatalogItems(
    authData: AuthData,
    eservicesIds: string[],
    producersIds: string[],
    states: DescriptorState[],
    agreementStates: PersistentAgreementState[],
    offset: number,
    limit: number,
    name?: { value: string; exactMatch: boolean }
  ): Promise<ListResult<CatalogItem>> {
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

    const data = await catalog
      .aggregate([...aggregationPipeline, { $skip: offset }, { $limit: limit }])
      .toArray();

    const result = z.array(catalogItem).safeParse(data.map((d) => d.data));
    return result.success
      ? {
          results: result.data,
          totalCount: (
            await catalog
              .aggregate([...aggregationPipeline, { $count: "count" }])
              .toArray()
          )[0].count as number,
        }
      : emptyListResult;
  },
  async getCatalogItemById(
    id: string
  ): Promise<(CatalogItem & { version: number }) | undefined> {
    const data = await catalog.findOne(
      { "data.id": id },
      { projection: { data: true, metadata: true } }
    );

    if (data) {
      const result = z
        .object({
          metadata: z.object({ version: z.number() }),
          data: catalogItem,
        })
        .safeParse(data);
      return result.success
        ? { ...result.data.data, version: result.data.metadata.version }
        : undefined;
    }

    return undefined;
  },
  async getEServiceDescriptorDocumentById(_id: string): Promise<
    | {
        version: number;
        prettyName: string;
        name: string;
        contentType: string;
        path: string;
        checksum: string;
        serverUrls: string[];
        isInInterface: boolean;
      }
    | undefined
  > {
    return undefined;
  },
  async getCatalogItemConsumers(
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
              state: { $in: ["PUBLISHED", "DEPRECATED", "SUSPENDED"] },
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
          "agreements.data.state": { $in: ["ACTIVE", "SUSPENDED"] },
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

    const data = await catalog
      .aggregate([...aggregationPipeline, { $skip: offset }, { $limit: limit }])
      .toArray();

    const result = z.array(consumer).safeParse(data);
    return result.success
      ? {
          results: result.data,
          totalCount: (
            await catalog
              .aggregate([...aggregationPipeline, { $count: "count" }])
              .toArray()
          )[0].count as number,
        }
      : emptyListResult;
  },
  async getDocumentById(
    eServiceId: string,
    descriptorId: string,
    documentId: string
  ): Promise<Document | undefined> {
    const catalog = await this.getCatalogItemById(eServiceId);
    return catalog?.descriptors
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
    const result = z.array(persistentAgreement).safeParse(data);
    return result.success ? result.data : [];
  },
};
