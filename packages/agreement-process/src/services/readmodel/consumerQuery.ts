import { ListResult } from "pagopa-interop-models";
import { CompactOrganization } from "../../model/domain/models.js";
import { ReadModelService } from "./readModelService.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function consumerQueryBuilder(readModelService: ReadModelService) {
  return {
    listConsumers: (
      name: string | undefined,
      limit: number,
      offset: number
    ): Promise<ListResult<CompactOrganization>> =>
      readModelService.listConsumers(name, limit, offset),
  };
}

export type ConsumerQuery = ReturnType<typeof consumerQueryBuilder>;
