import {
  ZodiosPlugin,
  ZodiosEndpointDefinitions,
  AnyZodiosRequestOptions,
} from "@zodios/core";
import { ReadonlyDeep } from "@zodios/core/lib/utils.types";
import { AxiosResponse } from "axios";

// TODO improve and add some docs to this file

export function zodiosMetadataPlugin(): ZodiosPlugin {
  return {
    name: "metadataHeaderPlugin",
    response: ((
      _api: ZodiosEndpointDefinitions,
      _config: ReadonlyDeep<AnyZodiosRequestOptions>,
      response: AxiosResponse
    ): Promise<AxiosResponse> => {
      // 1) Read the custom response header (usually lowercased by Axios)
      const raw = response.headers["x-metadata-version"];
      // eslint-disable-next-line functional/no-let
      let metadataVersion = null;
      if (raw) {
        const parsed = parseInt(raw, 10);
        if (!isNaN(parsed)) {
          // 2) Attach it to the response object
          metadataVersion = parsed;
        }
      }
      // 3) Return the full AxiosResponse (not just `.data`)
      return Promise.resolve({
        ...response,
        data: {
          data: response.data,
          metadata: {
            version: metadataVersion,
          },
        },
      });
    }) as ZodiosPlugin["response"],
  };
}

/**
 * The shape we actually get from each api-client thanks to the zodiosMetadataPlugin.
 */
export type WithMaybeMetadata<T> = {
  data: T;
  metadata:
    | {
        version: number | undefined;
      }
    | undefined;
  // TODO IMPROVE - Maybe derive from the already existing type WithMetadata?
};

/**
 * If a function returns Promise<T>,
 * replace that with Promise<WithMaybeMetadata<T>>.
 */
type PatchMethod<TMethod> = TMethod extends (
  ...args: infer A
) => Promise<infer TOriginal>
  ? (...args: A) => Promise<WithMaybeMetadata<TOriginal>>
  : TMethod;

/**
 * Takes an entire client (object)
 * and re-types each function using PatchMethod.
 */
export type PatchZodiosClient<TClient> = {
  [K in keyof TClient]: PatchMethod<TClient[K]>;
};

/**
 * This function does no runtime magic:
 * it's purely a TS type assertion telling the compiler that
 * "all your client methods are patched."
 */
export function patchZodiosClient<TClient>(
  client: TClient
): PatchZodiosClient<TClient> {
  return client as unknown as PatchZodiosClient<TClient>;
}
