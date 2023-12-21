import { EService, WithMetadata } from "pagopa-interop-models";
import { ReadModelService } from "./readModelService.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function eserviceQueryBuilder(readModelService: ReadModelService) {
  return {
    getEServiceById: async (
      id: string
    ): Promise<WithMetadata<EService> | undefined> =>
      await readModelService.getEServiceById(id),
  };
}

export type EserviceQuery = ReturnType<typeof eserviceQueryBuilder>;
