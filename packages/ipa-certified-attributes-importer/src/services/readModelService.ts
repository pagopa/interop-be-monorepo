import { ReadModelRepository } from "pagopa-interop-commons";
import { Tenant } from "pagopa-interop-models";
import { z } from "zod";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelServiceBuilder(
  readModelRepository: ReadModelRepository
) {
  const { tenants } = readModelRepository;
  return {
    getIPATenants: async (): Promise<Tenant[]> => {
      const data = await tenants
        .find({ "data.externalId.origin": "IPA" })
        .toArray();

      return z.array(Tenant).parse(data);
    },
  };
}

export type ReadModelService = ReturnType<typeof readModelServiceBuilder>;
