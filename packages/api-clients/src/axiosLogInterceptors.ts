import { AxiosError, AxiosHeaders, AxiosInstance, AxiosResponse } from "axios";
import { genericLogger } from "pagopa-interop-commons";

function getPrefix(headers?: AxiosHeaders, clientName: string = ""): string {
  const correlationId = headers?.["X-Correlation-Id"];
  return correlationId
    ? `[CID=${correlationId}][${clientName}]`
    : `[${clientName}]`;
}

function formatLogMessage(opts: {
  type: "Response" | "Error";
  method: string | undefined;
  baseURL: string | undefined;
  url: string | undefined;
  status: number | undefined;
  statusText: string | undefined;
}): string {
  const upperMethod = opts.method ? opts.method.toUpperCase() : "";
  const fullUrl = `${opts.baseURL ?? ""}${opts.url ?? ""}`;
  const statusPart =
    opts.status !== undefined ? `${opts.status}:${opts.statusText ?? ""}` : "";

  return `[${opts.type}] ${upperMethod} ${fullUrl} ${statusPart}`;
}

export function configureAxiosLogInterceptors(
  axiosInstance: AxiosInstance,
  clientName: string
): void {
  axiosInstance.interceptors.response.use(
    (response: AxiosResponse): AxiosResponse => {
      const prefix = getPrefix(response.config.headers, clientName);
      const message = formatLogMessage({
        type: "Response",
        method: response.config.method,
        baseURL: response.config.baseURL,
        url: response.config.url,
        status: response.status,
        statusText: response.statusText,
      });
      genericLogger.info(`${prefix}${message}`);
      return response;
    },
    (error: AxiosError): Promise<AxiosError> => {
      const prefix = getPrefix(error.config?.headers, clientName);
      const status = error.response?.status;
      const is4xxError = status && status >= 400 && status < 500;

      const loggerMethod = is4xxError
        ? genericLogger.warn
        : genericLogger.error;

      if ("errors" in error && Array.isArray(error.errors)) {
        error.errors.forEach((err) => loggerMethod(`${prefix} ${err}`));
      }

      const message = formatLogMessage({
        type: "Error",
        method: error.config?.method,
        baseURL: error.config?.baseURL,
        url: error.config?.url,
        status,
        statusText: error.response?.statusText,
      });
      loggerMethod(`${prefix}${message}`);

      return Promise.reject(error);
    }
  );
}
