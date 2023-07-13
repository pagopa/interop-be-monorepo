/*  =======================================================================
  IMPORTANT: This service mocks all operations performed throught read models
===========================================================================  */

import { MongoClient } from "mongodb";
import { catalogItem } from "models";
import { z } from "zod";
import * as api from "../model/generated/api.js";

const mongoUri = "mongodb://root:example@localhost:27017";
const client = new MongoClient(mongoUri);

const db = client.db("readmodel");
const catalog = db.collection("catalog");

type EService = z.infer<typeof api.schemas.EService>;

export const readModelGateway = {
  async getEServiceById(
    id: string
  ): Promise<z.infer<typeof catalogItem> | undefined> {
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
};
