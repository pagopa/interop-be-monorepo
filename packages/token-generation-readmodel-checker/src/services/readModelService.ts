import { ReadModelRepository } from "pagopa-interop-commons";
import {
  Agreement,
  Client,
  EService,
  genericInternalError,
  Purpose,
} from "pagopa-interop-models";
import { z } from "zod";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelServiceBuilder(readModel: ReadModelRepository) {
  return {
    async getAllReadModelPurposes(): Promise<Purpose[]> {
      const data = await readModel.purposes.find().toArray();

      if (!data) {
        return [];
      } else {
        const results = z.array(Purpose).safeParse(data.map((d) => d.data));
        if (!results.success) {
          throw genericInternalError(
            `Unable to parse purpose items: results ${JSON.stringify(
              results
            )} - data ${JSON.stringify(data)} `
          );
        }
        return results.data;
      }
    },

    async getAllReadModelAgreements(): Promise<Agreement[]> {
      const data = await readModel.agreements.find().toArray();

      if (!data) {
        return [];
      } else {
        const results = z.array(Agreement).safeParse(data.map((d) => d.data));
        if (!results.success) {
          throw genericInternalError(
            `Unable to parse agreement items: results ${JSON.stringify(
              results
            )} - data ${JSON.stringify(data)} `
          );
        }
        return results.data;
      }
    },

    async getAllReadModelClients(): Promise<Client[]> {
      const data = await readModel.clients.find().toArray();

      if (!data) {
        return [];
      } else {
        const results = z.array(Client).safeParse(data.map((d) => d.data));
        if (!results.success) {
          throw genericInternalError(
            `Unable to parse client items: results ${JSON.stringify(
              results
            )} - data ${JSON.stringify(data)} `
          );
        }
        return results.data;
      }
    },

    async getAllReadModelEServices(): Promise<EService[]> {
      const data = await readModel.eservices.find().toArray();

      if (!data) {
        return [];
      } else {
        const results = z.array(EService).safeParse(data.map((d) => d.data));
        if (!results.success) {
          throw genericInternalError(
            `Unable to parse eservice items: results ${JSON.stringify(
              results
            )} - data ${JSON.stringify(data)} `
          );
        }
        return results.data;
      }
    },
  };
}
export type ReadModelService = ReturnType<typeof readModelServiceBuilder>;
