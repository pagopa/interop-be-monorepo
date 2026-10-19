import {
  AnyZodiosRequestOptions,
  ZodiosEndpointDefinitions,
  ZodiosInstance,
  ZodiosOptions,
  ZodiosPlugin,
} from "@zodios/core";
import { ReadonlyDeep } from "@zodios/core/lib/utils.types";
import { AxiosResponse } from "axios";
import { METADATA_VERSION_HEADER } from "pagopa-interop-commons";

function zodiosMetadataPlugin(): ZodiosPlugin {
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
        metadata: !Number.isNaN(metadataVersion)
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

export type WithMaybeMetadata<T> = {
  data: T;
  metadata:
    | {
        version: number;
      }
    | undefined;
};

type MethodWithOptionalMetadata<TMethod> = TMethod extends (
  ...args: infer A
) => Promise<infer TOriginal>
  ? (...args: A) => Promise<WithMaybeMetadata<TOriginal>>
  : TMethod;

export type ZodiosClientWithMetadata<TClient> = {
  [K in keyof TClient]: MethodWithOptionalMetadata<TClient[K]>;
};

function enhanceZodiosClientWithMetadata<TClient>(
  client: TClient
): ZodiosClientWithMetadata<TClient> {
  return client as unknown as ZodiosClientWithMetadata<TClient>;
}

export function createZodiosClientEnhancedWithMetadata<
  Api extends ZodiosEndpointDefinitions,
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
