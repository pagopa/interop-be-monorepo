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

function getPrefix(headers?: AxiosHeaders, clientName: string = ""): string {
  const correlationId = headers?.["X-Correlation-Id"];
  return correlationId ? `CID=${correlationId}][${clientName}` : clientName;
  // AxiosLogger already logs the prefix inside square brackets,
  // adding ][ after the CID to log [CID=...][Client Name]
}

export function configureAxiosLogInterceptors(
  axiosInstance: AxiosInstance,
  clientName: string
): void {
  axiosInstance.interceptors.response.use(
    (response: AxiosResponse): AxiosResponse =>
      AxiosLogger.responseLogger(
        response as Parameters<typeof AxiosLogger.responseLogger>[0],
        {
          logger: genericLogger.info,
          prefixText: getPrefix(response.config.headers, clientName),
        }
      ) as AxiosResponse,
    (error: AxiosError): Promise<AxiosError> =>
      AxiosLogger.errorLogger(
        error as Parameters<typeof AxiosLogger.errorLogger>[0],
        {
          logger: genericLogger.error,
          prefixText: getPrefix(error.config?.headers, clientName),
        }
      ) as Promise<AxiosError>
  );
}