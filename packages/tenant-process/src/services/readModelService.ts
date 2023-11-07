import { z } from "zod";
import { logger, ReadModelRepository } from "pagopa-interop-commons";
import { ErrorTypes, WithMetadata } from "pagopa-interop-models";
import { Tenant } from "pagopa-interop-models";
import { config } from "../utilities/config.js";

const { tenants } = ReadModelRepository.init(config);

type TenantInput =
  | { "data.id": string }
  | {
      "data.externalId.value": string;
      "data.externalId.origin": string;
    }
  | { "data.selfcareId": string };

export const readModelService = {
  async getTenant(
    inputObject: TenantInput
  ): Promise<WithMetadata<Tenant> | undefined> {
    const data = await tenants.findOne(inputObject, {
      projection: { data: true, metadata: true },
    });
    if (data) {
      const result = z
        .object({
          metadata: z.object({ version: z.number() }),
          data: Tenant,
        })
        .safeParse(data);
      if (!result.success) {
        logger.error(
          `Unable to parse tenant item: result ${JSON.stringify(
            result
          )} - data ${JSON.stringify(data)} `
        );
        throw ErrorTypes.GenericError;
      }
      return {
        data: result.data.data,
        metadata: { version: result.data.metadata.version },
      };
    }
    return undefined;
  },

  async getTenantById(id: string): Promise<WithMetadata<Tenant> | undefined> {
    return this.getTenant({ "data.id": id });
  },

  async getTenantByExternalId({
    origin,
    code,
  }: {
    origin: string;
    code: string;
  }): Promise<WithMetadata<Tenant> | undefined> {
    return this.getTenant({
      "data.externalId.value": code,
      "data.externalId.origin": origin,
    });
  },

  async getTenantBySelfcareId(
    selfcareId: string
  ): Promise<WithMetadata<Tenant> | undefined> {
    return this.getTenant({ "data.selfcareId": selfcareId });
  },
};
