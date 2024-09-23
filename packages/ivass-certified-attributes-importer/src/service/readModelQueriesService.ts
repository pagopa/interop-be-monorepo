import { ReadModelRepository } from "pagopa-interop-commons";
import { Attribute, Tenant } from "pagopa-interop-models";

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

export class ReadModelQueries {
  constructor(private readModelClient: ReadModelRepository) {}

  /**
   * Retrieve tenants that match the given tax codes, with their unrevoked certified attribute
   */
  public async getIVASSTenants(externalId: string[]): Promise<Tenant[]> {
    return await this.readModelClient.tenants
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
      .map(({ data }) => Tenant.parse(data))
      .toArray();
  }

  public async getTenantsWithAttributes(
    attributeIds: string[]
  ): Promise<Tenant[]> {
    return await this.readModelClient.tenants
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
      .map(({ data }) => Tenant.parse(data))
      .toArray();
  }

  public async getTenantById(tenantId: string): Promise<Tenant> {
    const result = await this.readModelClient.tenants
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
      .map(({ data }) => Tenant.parse(data))
      .toArray();

    if (result.length === 0) {
      throw Error(`Tenant with id ${tenantId} not found`);
    } else {
      return result[0];
    }
  }

  public async getAttributeByExternalId(
    origin: string,
    code: string
  ): Promise<Attribute> {
    const result = await this.readModelClient.attributes
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
      throw Error(`Attribute with origin ${origin} and code ${code} not found`);
    } else {
      return result[0];
    }
  }
}
