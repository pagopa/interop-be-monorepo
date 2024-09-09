import { ReadModelRepository } from "pagopa-interop-commons";
import { genericInternalError, ClientJWKKey } from "pagopa-interop-models";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function readModelServiceBuilder(
  readModelRepository: ReadModelRepository
) {
  const { keys } = readModelRepository;
  return {
    getJWKById: async (
      kId: ClientJWKKey["kid"]
    ): Promise<ClientJWKKey | undefined> => {
      const data = await keys.findOne(
        { "data.kid": kId },
        { projection: { data: true } }
      );

      if (data) {
        const result = ClientJWKKey.safeParse(data.data);

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
