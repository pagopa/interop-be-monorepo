/*  =======================================================================
  IMPORTANT: This service mocks all operations performed throught read models
===========================================================================  */

import { MongoClient } from "mongodb";
import { z } from "zod";
import { catalogItem, CatalogItem, Document } from "models";
import * as api from "../model/generated/api.js";

const mongoUri = "mongodb://root:example@localhost:27017";
const client = new MongoClient(mongoUri);

const db = client.db("readmodel");
const catalog = db.collection("catalog");

type EService = z.infer<typeof api.schemas.EService>;

export const readModelGateway = {
  async getEServices(): Promise<CatalogItem[]> {
    const data = await catalog.find({}).toArray();

    const result = z.array(catalogItem).safeParse(data);
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
};
