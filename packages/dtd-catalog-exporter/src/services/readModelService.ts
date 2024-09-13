/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { ReadModelRepository } from "pagopa-interop-commons";
import {
  TenantReadModel,
  AttributeReadmodel,
  EServiceReadModel,
  genericInternalError,
  AttributeId,
} from "pagopa-interop-models";
import { z } from "zod";

export function readModelServiceBuilder(
  readModelRepository: ReadModelRepository
) {
  const { eservices, attributes, tenants } = readModelRepository;

  return {
    /**
     * Fetches all active e-services from the database, validates them and returns them.
     * The e-services is considered active if it has at least one descriptor with state "Published" or "Suspended".
     *
     * @returns The array of e-services
     */
    async getActiveEServices(): Promise<EServiceReadModel[]> {
      const data = await eservices
        .find({ "data.descriptors.state": { $in: ["Published", "Suspended"] } })
        .map(({ data }) => data)
        .toArray();

      const result = z.array(EServiceReadModel).safeParse(data);

      if (!result.success) {
        throw genericInternalError(
          `Unable to parse eservices items: result ${JSON.stringify(
            result
          )} - data ${JSON.stringify(data)} `
        );
      }

      return result.data;
    },

    /**
     * Fetches all the attributes from the database filtering by the passed attribute ids;
     *
     * @param attributeIds - The array of attributes ids
     * @returns The array of attributes
     * */
    async getEServicesAttributes(
      attributeIds: AttributeId[]
    ): Promise<AttributeReadmodel[]> {
      const data = await attributes
        .find({ "data.id": { $in: attributeIds } })
        .map(({ data }) => data)
        .toArray();

      const result = z.array(AttributeReadmodel).safeParse(data);

      if (!result.success) {
        throw genericInternalError(
          `Unable to parse attributes items: result ${JSON.stringify(
            result
          )} - data ${JSON.stringify(data)} `
        );
      }

      return result.data;
    },

    /**
     * Fetches all the tenants from the database filtering by the passed tenant ids;
     *
     * @param eservices - The array of e-services which all the attributes ids will be taken from
     * @returns The array of attributes
     * */
    async getEServicesTenants(tenantIds: string[]): Promise<TenantReadModel[]> {
      const data = await tenants
        .find({ "data.id": { $in: tenantIds } })
        .map(({ data }) => data)
        .toArray();

      const result = z.array(TenantReadModel).safeParse(data);

      if (!result.success) {
        throw genericInternalError(
          `Unable to parse tenants items: result ${JSON.stringify(
            result
          )} - data ${JSON.stringify(data)} `
        );
      }

      return result.data;
    },
  };
}
