import { apiGatewayApi } from "pagopa-interop-api-clients";
import { ReadModelRepository } from "pagopa-interop-commons";
import { genericInternalError, ClientJWKKey } from "pagopa-interop-models";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelServiceBuilder(
  readModelRepository: ReadModelRepository
) {
  const { keys, producerKeys } = readModelRepository;
  return {
    getJWKById: async (
      kId: ClientJWKKey["kid"]
    ): Promise<apiGatewayApi.JWK | undefined> => {
      const data =
        (await keys.findOne(
          { "data.kid": kId },
          { projection: { data: true } }
        )) ??
        (await producerKeys.findOne(
          { "data.kid": kId },
          { projection: { data: true } }
        ));

      if (data) {
        const result = apiGatewayApi.JWK.safeParse(data.data);

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
