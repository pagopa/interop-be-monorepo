import { EService } from "pagopa-interop-models";
import { Logger } from "pagopa-interop-commons";
import { ReadModelService } from "./readModelService.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function eserviceQueryBuilder(readModelService: ReadModelService) {
  return {
    getEServiceById: async (
      id: string,
      logger: Logger
    ): Promise<EService | undefined> =>
      await readModelService.getEServiceById(id, logger),
  };
}

export type EserviceQuery = ReturnType<typeof eserviceQueryBuilder>;
