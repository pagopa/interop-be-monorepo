import { ReadModelRepository } from "pagopa-interop-commons";
import { Attribute } from "pagopa-interop-models";
import { IvassReadModelTenant } from "../model/tenant.js";

const projectUnrevokedCertifiedAttributes = {
  _id: 0,
  "data.id": 1,
  "data.externalId": 1,
  "data.features": 1,
  "data.attributes": {
    $filter: {
      input: "$data.attributes",
      as: "attribute",
      cond: {
        $and: [
          { $eq: ["$$attribute.type", "PersistentCertifiedAttribute"] },
          { $lt: ["$$attribute.revocationTimestamp", null] },
        ],
      },
    },
  },
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelQueriesBuilder(readModelClient: ReadModelRepository) {
  return {
    /**
     * Retrieve tenants that match the given tax codes, with their unrevoked certified attribute
     */
    async getIVASSTenants(
      externalId: string[]
    ): Promise<IvassReadModelTenant[]> {
      return await readModelClient.tenants
        .aggregate([
          {
            $match: {
              "data.externalId.origin": "IVASS",
              "data.externalId.value": { $in: externalId },
            },
          },
          {
            $project: projectUnrevokedCertifiedAttributes,
          },
        ])
        .map(({ data }) => IvassReadModelTenant.parse(data))
        .toArray();
    },

    async getTenantsWithAttributes(
      attributeIds: string[]
    ): Promise<IvassReadModelTenant[]> {
      return await readModelClient.tenants
        .aggregate([
          {
            $match: {
              "data.attributes.id": { $in: attributeIds },
            },
          },
          {
            $project: projectUnrevokedCertifiedAttributes,
          },
        ])
        .map(({ data }) => IvassReadModelTenant.parse(data))
        .toArray();
    },

    async getTenantById(tenantId: string): Promise<IvassReadModelTenant> {
      const result = await readModelClient.tenants
        .aggregate([
          {
            $match: {
              "data.id": tenantId,
            },
          },
          {
            $project: projectUnrevokedCertifiedAttributes,
          },
        ])
        .map(({ data }) => IvassReadModelTenant.parse(data))
        .toArray();

      if (result.length === 0) {
        throw Error(`Tenant with id ${tenantId} not found`);
      } else {
        return result[0];
      }
    },

    async getAttributeByExternalId(
      origin: string,
      code: string
    ): Promise<Attribute> {
      const result = await readModelClient.attributes
        .find(
          {
            "data.origin": origin,
            "data.code": code,
          },
          {
            projection: { data: true, metadata: true },
          }
        )
        .map(({ data }) => Attribute.parse(data))
        .toArray();

      if (result.length === 0) {
        throw Error(
          `Attribute with origin ${origin} and code ${code} not found`
        );
      } else {
        return result[0];
      }
    },
  };
}

export type ReadModelQueries = ReturnType<typeof readModelQueriesBuilder>;
