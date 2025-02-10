import { ReadModelRepository } from "pagopa-interop-commons";
import {
  Agreement,
  EService,
  EServiceId,
  Tenant,
  genericInternalError,
} from "pagopa-interop-models";
import { z } from "zod";

export type ReadModelService = {
  getEServiceById: (id: string) => Promise<EService | undefined>;
  getTenantById: (tenantId: string) => Promise<Tenant | undefined>;
  getAgreementsByEserviceId: (
    eserviceId: EServiceId
  ) => Promise<Agreement[] | undefined>;
};

export function readModelServiceBuilder(
  readModelRepository: ReadModelRepository
): ReadModelService {
  const { eservices, tenants, agreements } = readModelRepository;

  async function getEServiceById(id: string): Promise<EService | undefined> {
    const data = await eservices.findOne(
      { "data.id": id },
      { projection: { data: true } }
    );

    if (data) {
      const result = EService.safeParse(data.data);

      if (!result.success) {
        throw genericInternalError(
          `Unable to parse eservices item: result ${JSON.stringify(
            result
          )} - data ${JSON.stringify(data)} `
        );
      }

      return result.data;
    }

    return undefined;
  }

  async function getTenantById(tenantId: string): Promise<Tenant | undefined> {
    const data = await tenants.findOne(
      { "data.id": tenantId },
      { projection: { data: true } }
    );

    if (data) {
      const result = Tenant.safeParse(data.data);

      if (!result.success) {
        throw genericInternalError(
          `Unable to parse tenant item: result ${JSON.stringify(
            result
          )} - data ${JSON.stringify(data)} `
        );
      }

      return result.data;
    }
    return undefined;
  }

  async function getAgreementsByEserviceId(
    eserviceId: EServiceId
  ): Promise<Agreement[] | undefined> {
    const data = await agreements
      .find({ "data.eserviceId": eserviceId }, { projection: { data: true } })
      .toArray();

    if (data) {
      const result = z
        .array(Agreement)
        .safeParse(data.map((agreement) => agreement.data));

      if (!result.success) {
        throw genericInternalError(
          `Unable to parse tenant item: result ${JSON.stringify(
            result
          )} - data ${JSON.stringify(data)} `
        );
      }

      return result.data;
    }
    return undefined;
  }
  return {
    getEServiceById,
    getTenantById,
    getAgreementsByEserviceId,
  };
}
