import { MongoClient } from "mongodb";
import { logger } from "pagopa-interop-commons";
import {
  ErrorTypes,
  PersistentAgreement,
  WithMetadata,
} from "pagopa-interop-models";

import { z } from "zod";
import { config } from "../utilities/config.js";

const {
  readModelDbUsername: username,
  readModelDbPassword: password,
  readModelDbHost: host,
  readModelDbPort: port,
  readModelDbName: database,
} = config;

const mongoDBConectionURI = `mongodb://${username}:${password}@${host}:${port}`;
const client = new MongoClient(mongoDBConectionURI, {
  retryWrites: false,
});
const db = client.db(database);
const agreements = db.collection("agreements");

export const readModelService = {
  async readAgreementById(
    agreementId: string
  ): Promise<WithMetadata<PersistentAgreement> | undefined> {
    const data = await agreements.findOne(
      { "data.id": agreementId },
      { projection: { data: true, metadata: true } }
    );

    if (data) {
      const result = z
        .object({
          data: PersistentAgreement,
          metadata: z.object({ version: z.number() }),
        })
        .safeParse(data);
      if (!result.success) {
        logger.error(`Agreement ${agreementId} not found`);
        throw ErrorTypes.GenericError;
      }
      return {
        data: result.data.data,
        metadata: { version: result.data.metadata.version },
      };
    }

    return undefined;
  },
};
