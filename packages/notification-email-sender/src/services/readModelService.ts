import { ReadModelRepository } from "pagopa-interop-commons";
import {
  Agreement,
  EService,
  EServiceId,
  Tenant,
  agreementState,
  genericInternalError,
} from "pagopa-interop-models";
import { z } from "zod";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelServiceBuilder(
  readModelRepository: ReadModelRepository
) {
  const { eservices, tenants, agreements } = readModelRepository;
  return {
    async getEServiceById(id: string): Promise<EService | undefined> {
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
    },

    async getTenantById(tenantId: string): Promise<Tenant | undefined> {
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
    },

    async getAgreementsByEserviceId(
      eserviceId: EServiceId
    ): Promise<Agreement[] | undefined> {
      const data = await agreements
        .find(
          {
            "data.eserviceId": eserviceId,
            "data.state": {
              $in: [
                agreementState.active,
                agreementState.suspended,
                agreementState.pending,
              ],
            },
          },
          { projection: { data: true } }
        )
        .toArray();

      if (data) {
        const result = z
          .array(Agreement)
          .safeParse(data.map((agreement) => agreement.data));

        if (!result.success) {
          throw genericInternalError(
            `Unable to parse agreement item: result ${JSON.stringify(
              result
            )} - data ${JSON.stringify(data)} `
          );
        }

        return result.data;
      }
      return undefined;
    },
  };
}

export type ReadModelService = ReturnType<typeof readModelServiceBuilder>;
