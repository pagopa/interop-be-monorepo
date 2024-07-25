import { FileManager, logger, streamToString } from "pagopa-interop-commons";
import { BffProcessConfig } from "../config/config.js";

export default async function getAllowList(
  serviceName: string,
  fileManager: FileManager,
  config: BffProcessConfig
): Promise<string[]> {
  const loggerInstance = logger({ serviceName });

  const stream = await fileManager.get(
    config.allowListContainer,
    `${config.allowListPath}/${config.allowListFileName}`,
    loggerInstance
  );
  const content = await streamToString(stream);

  return content.split("\n").flatMap((line) => line.split(","));
}
