import { ReadModelRepository } from "pagopa-interop-commons";
import {
  Agreement,
  ClientId,
  EService,
  EServiceId,
  Purpose,
  PurposeId,
  TenantId,
  agreementState,
  genericInternalError,
  unsafeBrandId,
} from "pagopa-interop-models";
import { z } from "zod";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelServiceBuilder(
  readModelRepository: ReadModelRepository
) {
  const { agreements, clients, eservices, purposes } = readModelRepository;

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

    async getClientsIdsFromPurpose(purposeId: PurposeId): Promise<ClientId[]> {
      const data = await clients
        .find(
          {
            $or: [
              {
                "data.purposes.purpose.purposeId": purposeId,
              },
              {
                "data.purposes": purposeId,
              },
            ],
          },
          { projection: { data: true } }
        )
        .map((c) => c.data)
        .toArray();

      const result = z.array(z.object({ id: z.string() })).safeParse(data);

      if (!result.success) {
        throw genericInternalError(
          `Unable to parse clients item: result ${JSON.stringify(
            result
          )} - data ${JSON.stringify(data)} `
        );
      }

      return result.data.map((c) => unsafeBrandId<ClientId>(c.id));
    },

    async getPurposeById(id: PurposeId): Promise<Purpose | undefined> {
      const data = await purposes.findOne(
        { "data.id": id },
        { projection: { data: true } }
      );

      if (data) {
        const result = Purpose.safeParse(data.data);

        if (!result.success) {
          throw genericInternalError(
            `Unable to parse purpose item: result ${JSON.stringify(
              result
            )} - data ${JSON.stringify(data)} `
          );
        }

        return result.data;
      }

      return undefined;
    },

    async getLatestAgreement(
      eserviceId: EServiceId,
      consumerId: TenantId
    ): Promise<Agreement | undefined> {
      const data = await agreements
        .find(
          {
            "data.eserviceId": eserviceId,
            "data.consumerId": consumerId,
            "data.state": {
              $in: [
                agreementState.active,
                agreementState.archived,
                agreementState.suspended,
              ],
            },
          },
          { projection: { data: true } }
        )
        .sort({ "data.createdAt": -1 })
        .limit(1)
        .toArray();

      if (data) {
        if (data.length > 1) {
          throw genericInternalError(
            `Too many agreements returned: data ${JSON.stringify(data)} `
          );
        }

        const result = Agreement.safeParse(data[0].data);

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
