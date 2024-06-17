import { ReadModelRepository } from "pagopa-interop-commons";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelServiceBuilder(
  _readModelRepository: ReadModelRepository
) {
  // const { clients } = readModelRepository;

  return {
    sample(): string {
      return "sample";
    },
  };
}

export type ReadModelService = ReturnType<typeof readModelServiceBuilder>;
