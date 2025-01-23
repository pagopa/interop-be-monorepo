import { ReadModelRepository } from "pagopa-interop-commons";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelServiceBuilder(
  _readModelRepository: ReadModelRepository
) {
  return {};
}

export type ReadModelService = ReturnType<typeof readModelServiceBuilder>;
