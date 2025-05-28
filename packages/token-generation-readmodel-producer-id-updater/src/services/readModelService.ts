import { ReadModelRepository } from "pagopa-interop-commons";
import { Agreement, genericInternalError } from "pagopa-interop-models";
import { z } from "zod";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelServiceBuilder(readModel: ReadModelRepository) {
  return {
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
  };
}
export type ReadModelService = ReturnType<typeof readModelServiceBuilder>;
