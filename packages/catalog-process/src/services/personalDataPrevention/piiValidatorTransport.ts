import { Zodios } from "@zodios/core";
import { piiValidatorApi } from "pagopa-interop-api-clients";

import {
  DetectionTransport,
  PersonalDataPreventionUnavailableError,
} from "./types.js";

export function createPiiValidatorTransport({
  baseUrl,
  tokenProvider,
  timeoutMs = 2000,
}: {
  baseUrl: string;
  tokenProvider: () => Promise<string>;
  timeoutMs?: number;
}): DetectionTransport {
  if (
    !Number.isInteger(timeoutMs) ||
    timeoutMs <= 0 ||
    timeoutMs > 2147483647
  ) {
    throw new PersonalDataPreventionUnavailableError();
  }
  // Reuse generated endpoints, not the generated factory's logging interceptors.
  const client = new Zodios(baseUrl, piiValidatorApi.detectionEndpoints, {
    validate: false,
    axiosConfig: {
      maxRedirects: 0,
      validateStatus: (status) => status === 200,
      responseType: "json",
      transitional: { silentJSONParsing: false },
    },
  });
  return async (request, context): Promise<unknown> => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new PersonalDataPreventionUnavailableError());
      }, timeoutMs);
    });
    try {
      // Race acquisition separately: a late token must never start HTTP work.
      const token = await Promise.race([
        Promise.resolve().then(tokenProvider),
        deadline,
      ]);
      controller.signal.throwIfAborted();
      return await Promise.race([
        client.detectPii(request, {
          signal: controller.signal,
          headers: {
            Authorization: `Bearer ${token}`,
            "X-Correlation-Id": context.correlationId,
          },
        }),
        deadline,
      ]);
    } catch {
      throw new PersonalDataPreventionUnavailableError();
    } finally {
      clearTimeout(timer);
    }
  };
}
