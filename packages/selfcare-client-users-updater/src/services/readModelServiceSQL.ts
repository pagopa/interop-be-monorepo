import { Client, UserId, TenantId, clientKind } from "pagopa-interop-models";
import { ClientReadModelService } from "pagopa-interop-readmodel";
import { and, eq } from "drizzle-orm";
import { clientInReadmodelClient } from "pagopa-interop-readmodel-models";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelServiceBuilderSQL({
  clientReadModelServiceSQL,
}: {
  clientReadModelServiceSQL: ClientReadModelService;
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
        await clientReadModelServiceSQL.getClientsByFilter(
          and(
            eq(clientInReadmodelClient.kind, clientKind.api),
            eq(clientInReadmodelClient.consumerId, consumerId),
            eq(clientInReadmodelClient.adminId, adminId)
          )
        )
      ).map((client) => client.data),
  };
}

export type ReadModelServiceSQL = ReturnType<typeof readModelServiceBuilderSQL>;
