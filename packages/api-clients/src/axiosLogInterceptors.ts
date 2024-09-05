import { AxiosError, AxiosInstance, AxiosResponse } from "axios";
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

export function configureAxiosLogInterceptors(
  axiosInstance: AxiosInstance,
  prefixText: string
): void {
  axiosInstance.interceptors.response.use(
    (response: AxiosResponse): AxiosResponse =>
      AxiosLogger.responseLogger(
        response as Parameters<typeof AxiosLogger.responseLogger>[0],
        {
          logger: genericLogger.info,
          prefixText,
        }
      ) as AxiosResponse,
    (error: AxiosError): Promise<AxiosError> =>
      AxiosLogger.errorLogger(
        error as Parameters<typeof AxiosLogger.errorLogger>[0],
        {
          logger: genericLogger.error,
          prefixText,
        }
      ) as Promise<AxiosError>
  );
}
