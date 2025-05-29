import {
  Client,
  UserId,
  TenantId,
  clientKind,
  SelfcareId,
  unsafeBrandId,
} from "pagopa-interop-models";
import { ClientReadModelService } from "pagopa-interop-readmodel";
import { and, eq } from "drizzle-orm";
import {
  clientInReadmodelClient,
  DrizzleReturnType,
  tenantInReadmodelTenant,
} from "pagopa-interop-readmodel-models";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelServiceBuilderSQL({
  readModelDB,
  clientReadModelService,
}: {
  readModelDB: DrizzleReturnType;
  clientReadModelService: ClientReadModelService;
}) {
  return {
    getClients: async ({
      consumerId,
      adminId,
    }: {
      consumerId: TenantId;
      adminId: UserId;
    }): Promise<Client[]> =>
      (
        await clientReadModelService.getClients(
          and(
            eq(clientInReadmodelClient.kind, clientKind.api),
            eq(clientInReadmodelClient.consumerId, consumerId),
            eq(clientInReadmodelClient.adminId, adminId)
          )
        )
      ).map((client) => client.data),
    getTenantIdBySelfcareId: async (
      selfcareId: SelfcareId
    ): Promise<TenantId | undefined> => {
      const tenantSQL = await readModelDB
        .select()
        .from(tenantInReadmodelTenant)
        .where(eq(tenantInReadmodelTenant.selfcareId, selfcareId));

      return tenantSQL.length === 0
        ? undefined
        : unsafeBrandId<TenantId>(tenantSQL[0].id);
    },
  };
}

export type ReadModelServiceSQL = ReturnType<typeof readModelServiceBuilderSQL>;
