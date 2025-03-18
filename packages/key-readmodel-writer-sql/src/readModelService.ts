import {
  clientJwkKeyInReadmodelClientJwkKey,
  DrizzleReturnType,
} from "pagopa-interop-readmodel-models";
import { and, eq, lte } from "drizzle-orm";
import { ClientId, ClientJWKKey } from "pagopa-interop-models";
import { ClientJWKKeyReadModelService } from "pagopa-interop-readmodel";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function customReadModelServiceBuilder(
  db: DrizzleReturnType,
  clientJWKKeyReadModelService: ClientJWKKeyReadModelService
) {
  return {
    async upsertClientJWKKey(
      jwkKey: ClientJWKKey,
      metadataVersion: number
    ): Promise<void> {
      await clientJWKKeyReadModelService.upsertClientJWKKey(
        jwkKey,
        metadataVersion
      );
    },

    async deleteClientJWKKeyByKid(
      clientId: ClientId,
      kid: string,
      metadataVersion: number
    ): Promise<void> {
      await clientJWKKeyReadModelService.deleteClientJWKKeyByKid(
        clientId,
        kid,
        metadataVersion
      );
    },

    async deleteClientJWKKeysByClientId(
      clientId: ClientId,
      metadataVersion: number
    ): Promise<void> {
      await db
        .delete(clientJwkKeyInReadmodelClientJwkKey)
        .where(
          and(
            eq(clientJwkKeyInReadmodelClientJwkKey.clientId, clientId),
            lte(
              clientJwkKeyInReadmodelClientJwkKey.metadataVersion,
              metadataVersion
            )
          )
        );
    },
  };
}
export type CustomReadModelService = ReturnType<
  typeof customReadModelServiceBuilder
>;
