import { apiGatewayApi } from "pagopa-interop-api-clients";
import { ReadModelRepository } from "pagopa-interop-commons";
import {
  genericInternalError,
  ClientJWKKey,
  ProducerJWKKey,
} from "pagopa-interop-models";
import { z } from "zod";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelServiceBuilder(
  readModelRepository: ReadModelRepository
) {
  const { keys, producerKeys } = readModelRepository;
  return {
    getJWKById: async (
      kId: ClientJWKKey["kid"] | ProducerJWKKey["kid"]
    ): Promise<apiGatewayApi.JWK | undefined> => {
      const [keyData, producerKeyData] = await Promise.all([
        keys.findOne({ "data.kid": kId }, { projection: { data: true } }),
        producerKeys.findOne(
          { "data.kid": kId },
          { projection: { data: true } }
        ),
      ]);

      const data = keyData?.data ?? producerKeyData?.data;

      if (data) {
        const result = z
          .union([apiGatewayApi.ClientJWK, apiGatewayApi.ProducerKeychainJWK])
          .safeParse(data);

        if (!result.success) {
          throw genericInternalError(
            `Unable to parse JWKKey item: result ${JSON.stringify(
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
