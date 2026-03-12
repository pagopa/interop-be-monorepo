import YAML from "yaml";
import { match } from "ts-pattern";
import { z } from "zod";
import {
  eserviceInterfaceAllowedFileType,
  EserviceRestInterfaceType,
} from "./eserviceDocumentUtils.js";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export const parseOpenApi = (
  fileType: EserviceRestInterfaceType,
  file: string
) =>
  match(fileType)
    .with("json", () => JSON.parse(file))
    .with("yaml", () => YAML.parse(file))
    .exhaustive();
export const retrieveServerUrlsOpenApiV2 = (
  openApi: Record<string, unknown>
): string[] => {
  const { data, error } = z
    .object({
      host: z.string(),
      paths: z.array(z.object({})),
    })
    .safeParse(openApi);

  if (error) {
    throw error;
  }

  return [data.host];
};

export const retriesceServerUrlsOpenApiV3 = (
  openApi: Record<string, unknown>
): string[] => {
  const { data: servers, error } = z
    .array(z.object({ url: z.string() }))
    .safeParse(openApi.servers);
  if (error) {
    throw error;
  }

  return servers.flatMap((s) => s.url);
};

export const restApiFileToBuffer: (
  fileType: EserviceRestInterfaceType,
  jsonApi: object
) => Buffer = (fileType, file) =>
  match(fileType)
    .with(eserviceInterfaceAllowedFileType.json, () =>
      Buffer.from(JSON.stringify(file))
    )
    .with(eserviceInterfaceAllowedFileType.yaml, () =>
      Buffer.from(YAML.stringify(file))
    )
    .exhaustive();
