/*  =======================================================================
  IMPORTANT: This service mocks all operations performed throught read models
===========================================================================  */

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
} from "models";
import { match } from "ts-pattern";
import * as api from "../model/generated/api.js";
import { AuthData } from "../auth/authData.js";

const mongoUri = "mongodb://root:example@localhost:27017";
const client = new MongoClient(mongoUri);

const db = client.db("readmodel");
const catalog = db.collection("eservices");
const agreements = db.collection("agreements");

type EService = z.infer<typeof api.schemas.EService>;

export const readModelGateway = {
  async getEServices(
    authData: AuthData,
    eservicesIds: string[],
    producersIds: string[],
    states: DescriptorState[],
    agreementStates: PersistentAgreementState[],
    offset: number,
    limit: number,
    name?: { value: string; exactMatch: boolean }
  ): Promise<CatalogItem[]> {
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
      return [];
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
          nameFilter,
          "data.descriptors": { $elemMatch: { state: { $in: states } } },
          "data.id": { $in: ids },
          "data.producerId": { $in: producersIds },
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
      .aggregate(aggregationPipeline)
      .sort({ lowerName: 1 })
      .skip(offset)
      .limit(limit)
      .toArray();

    const result = z.array(catalogItem).safeParse(data.map((d) => d.data));
    return result.success ? result.data : [];
  },
  async getEServiceById(id: string): Promise<CatalogItem | undefined> {
    const data = await catalog.findOne({ id });

    const result = catalogItem.safeParse(data);
    return result.success ? result.data : undefined;
  },
  async getEServiceByName(_name: string): Promise<EService | undefined> {
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
  async getEServiceConsumers(
    id: string,
    offset: number,
    limit: number
  ): Promise<unknown> {
    const data = await catalog.find({ id }).skip(offset).limit(limit).toArray();
    const result = catalogItem.safeParse(data);
    return result.success ? result.data : 0;
  },
  async getDocumentById(
    eServiceId: string,
    descriptorId: string,
    documentId: string
  ): Promise<Document | undefined> {
    const catalog = await this.getEServiceById(eServiceId);
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
          "data.eserviceId": { $in: eservicesIds },
          "data.consumerId": { $in: consumersIds },
          "data.producerId": { $in: producersIds },
          "data.state": { $elemMatch: { state: { $in: states } } },
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
