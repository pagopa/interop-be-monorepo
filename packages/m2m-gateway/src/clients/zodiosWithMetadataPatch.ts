import {
  ZodiosPlugin,
  ZodiosEndpointDefinitions,
  AnyZodiosRequestOptions,
  ZodiosInstance,
  ZodiosOptions,
} from "@zodios/core";
import { ReadonlyDeep } from "@zodios/core/lib/utils.types";
import { AxiosResponse } from "axios";
import { METADATA_VERSION_HEADER } from "pagopa-interop-commons";

export function zodiosMetadataPlugin(): ZodiosPlugin {
  return {
    name: "metadataHeaderPlugin",
    response: ((
      _api: ZodiosEndpointDefinitions,
      _config: ReadonlyDeep<AnyZodiosRequestOptions>,
      response: AxiosResponse
    ): Promise<AxiosResponse> => {
      const metadataVersionRaw = response.headers[METADATA_VERSION_HEADER];
      const metadataVersion = parseInt(metadataVersionRaw, 10);

      const data: WithMaybeMetadata<unknown> = {
        data: response.data,
        metadata: !isNaN(metadataVersion)
          ? {
              version: metadataVersion,
            }
          : undefined,
      };

      return Promise.resolve({
        ...response,
        data,
      });
    }) as ZodiosPlugin["response"],
  };
}

/**
 * The shape we actually get from each api-client thanks to the zodiosMetadataPlugin.
 * Same as WithMetadata<T> but with the metadata field optional.
 * This is because the plugin will only add the metadata field if the header is present.
 */
export type WithMaybeMetadata<T> = {
  data: T;
  metadata:
    | {
        version: number;
      }
    | undefined;
};

/**
 * If a function returns Promise<T>,
 * replace that with Promise<WithMaybeMetadata<T>>.
 */
type MethodWithOptionalMetadata<TMethod> = TMethod extends (
  ...args: infer A
) => Promise<infer TOriginal>
  ? (...args: A) => Promise<WithMaybeMetadata<TOriginal>>
  : TMethod;

/**
 * Takes an entire Zodios client (an object)
 * and re-types each function using MethodWithOptionalMetadata.
 */
export type ZodiosClientWithMetadata<TClient> = {
  [K in keyof TClient]: MethodWithOptionalMetadata<TClient[K]>;
};

/**
 * A function that just casts the client to the patched,
 * to convince TypeScript that the client actually returns data with metadata.
 */
function enhanceZodiosClientWithMetadata<TClient>(
  client: TClient
): ZodiosClientWithMetadata<TClient> {
  return client as unknown as ZodiosClientWithMetadata<TClient>;
}

export function createZodiosClientEnhancedWithMetadata<
  Api extends ZodiosEndpointDefinitions
>(
  createClientFunction: (
    baseUrl: string,
    options?: ZodiosOptions
  ) => ZodiosInstance<Api>,
  baseUrl: string,
  options?: ZodiosOptions
): ZodiosClientWithMetadata<ZodiosInstance<Api>> {
  const rawClient = createClientFunction(baseUrl, options);
  rawClient.use(zodiosMetadataPlugin());
  return enhanceZodiosClientWithMetadata(rawClient);
}
