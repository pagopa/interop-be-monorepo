import { DB } from "pagopa-interop-commons";
import { ReadModelService } from "./readModelService.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function authorizationServiceBuilder(
  _dbInstance: DB,
  _readModelService: ReadModelService
) {
  // const repository = eventRepository(dbInstance, authorizationEventToBinaryData);

  return {
    sample(): string {
      return "sample";
    },
  };
}

export type AuthorizationService = ReturnType<
  typeof authorizationServiceBuilder
>;
