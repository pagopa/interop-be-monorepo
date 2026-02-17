import { genericLogger } from "pagopa-interop-commons";

/**
 * Configures response logging interceptors on a hey-api client instance.
 * Logs at info/warn/error level based on HTTP status code, including
 * the correlation ID when present.
 */
export function configureHeyApiLogInterceptors(
  client: {
    interceptors: {
      response: {
        use: (fn: (response: Response, request: Request) => Response) => void;
      };
    };
  },
  clientName: string
): void {
  client.interceptors.response.use((response, request) => {
    const method = request.method;
    const url = request.url;
    const correlationId = request.headers?.get("X-Correlation-Id");
    const prefix = correlationId ? `[CID=${correlationId}]` : "";

    if (response.ok) {
      genericLogger.info(
        `${prefix}[${clientName}] ${method.toUpperCase()} ${url} - ${
          response.status
        }`
      );
    } else if (response.status >= 400 && response.status < 500) {
      genericLogger.warn(
        `${prefix}[${clientName}] ${method.toUpperCase()} ${url} - ${
          response.status
        }`
      );
    } else {
      genericLogger.error(
        `${prefix}[${clientName}] ${method.toUpperCase()} ${url} - ${
          response.status
        }`
      );
    }
    return response;
  });
}
