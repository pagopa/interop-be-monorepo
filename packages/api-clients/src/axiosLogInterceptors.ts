import { AxiosError, AxiosHeaders, AxiosInstance, AxiosResponse } from "axios";
import { genericLogger } from "pagopa-interop-commons";
import AxiosLogger, { setGlobalConfig } from "axios-logger";

setGlobalConfig({
  method: true,
  url: true,
  params: true,
  status: true,
  statusText: true,
  data: false,
  headers: false,
});

function getCorrelationIdLogString(headers?: AxiosHeaders): string {
  const correlationId = headers?.["X-Correlation-Id"];
  return correlationId ? `CID=${correlationId}][` : "";
}

export function configureAxiosLogInterceptors(
  axiosInstance: AxiosInstance,
  prefix: string
): void {
  axiosInstance.interceptors.response.use(
    (response: AxiosResponse): AxiosResponse =>
      AxiosLogger.responseLogger(
        response as Parameters<typeof AxiosLogger.responseLogger>[0],
        {
          logger: genericLogger.info,
          prefixText:
            getCorrelationIdLogString(response.config.headers) + prefix,
        }
      ) as AxiosResponse,
    (error: AxiosError): Promise<AxiosError> =>
      AxiosLogger.errorLogger(
        error as Parameters<typeof AxiosLogger.errorLogger>[0],
        {
          logger: genericLogger.error,
          prefixText: getCorrelationIdLogString(error.config?.headers) + prefix,
        }
      ) as Promise<AxiosError>
  );
}
