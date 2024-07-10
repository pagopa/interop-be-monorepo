import {
  initFileManager,
  logger,
  streamToString,
} from "pagopa-interop-commons";
import { config } from "../config/config.js";

export default async function getAllowList(
  serviceName: string
): Promise<string[]> {
  const fileManager = initFileManager(config);

  const loggerInstance = logger({ serviceName });

  const stream = await fileManager.get(
    config.allowListContainer,
    `${config.allowListPath}/${config.allowListFileName}`,
    loggerInstance
  );
  const content = await streamToString(stream);

  return content.split("\n").flatMap((line) => line.split(","));
}
