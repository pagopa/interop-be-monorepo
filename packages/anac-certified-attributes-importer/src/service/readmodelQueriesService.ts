import { ReadModelRepository } from "pagopa-interop-commons";
import { Attribute } from "pagopa-interop-models";
import { AnacReadModelTenant } from "../model/tenant.js";

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
     * Retrieve all PA tenants that matches the given IPA codes, with their unrevoked certified attribute
     */
    async getPATenants(ipaCodes: string[]): Promise<AnacReadModelTenant[]> {
      return await readModelClient.tenants
        .aggregate([
          {
            $match: {
              "data.externalId.origin": "IPA",
              "data.externalId.value": { $in: ipaCodes },
            },
          },
          {
            $project: projectUnrevokedCertifiedAttributes,
          },
        ])
        .map(({ data }) => AnacReadModelTenant.parse(data))
        .toArray();
    },

    /**
     * Retrieve all non-PA tenants that matches the given tax codes, with their unrevoked certified attribute
     */
    async getNonPATenants(taxCodes: string[]): Promise<AnacReadModelTenant[]> {
      return await readModelClient.tenants
        .aggregate([
          {
            $match: {
              "data.externalId.origin": { $ne: "IPA" },
              "data.externalId.value": { $in: taxCodes },
            },
          },
          {
            $project: projectUnrevokedCertifiedAttributes,
          },
        ])
        .map(({ data }) => AnacReadModelTenant.parse(data))
        .toArray();
    },

    async getTenantById(tenantId: string): Promise<AnacReadModelTenant> {
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
        .map(({ data }) => AnacReadModelTenant.parse(data))
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

    async getTenantsWithAttributes(
      attributeIds: string[]
    ): Promise<AnacReadModelTenant[]> {
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
        .map(({ data }) => AnacReadModelTenant.parse(data))
        .toArray();
    },
  };
}

export type ReadModelQueries = ReturnType<typeof readModelQueriesBuilder>;
