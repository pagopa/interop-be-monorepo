import { ReadModelRepository } from "pagopa-interop-commons";
import {
  Attribute,
  attributeKind,
  PUBLIC_ADMINISTRATIONS_IDENTIFIER,
  Tenant,
} from "pagopa-interop-models";
import { z } from "zod";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelServiceBuilder(
  readModelRepository: ReadModelRepository
) {
  const { tenants, attributes } = readModelRepository;
  return {
    getIPATenants: async (): Promise<Tenant[]> => {
      const data = await tenants
        .find({ "data.externalId.origin": PUBLIC_ADMINISTRATIONS_IDENTIFIER })
        .toArray();

      return z.array(Tenant).parse(data);
    },
    getAttributes: async (): Promise<Attribute[]> => {
      const data = await attributes
        .find({
          "data.kind": attributeKind.certified,
          "data.origin": PUBLIC_ADMINISTRATIONS_IDENTIFIER,
        })
        .toArray();

      return z.array(Attribute).parse(data);
    },
  };
}

export type ReadModelService = ReturnType<typeof readModelServiceBuilder>;
