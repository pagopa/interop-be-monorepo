/* eslint-disable functional/immutable-data */
import { FileManager, Logger } from "pagopa-interop-commons";
import { genericInternalError } from "pagopa-interop-models";
import { EventSignerConfig } from "../config/config.js";

type PreparedFileForUpload = {
  fileContentBuffer: Buffer;
  fileName: string;
  filePath: string;
};

export const uploadPreparedFileToS3 = async (
  preparedFile: PreparedFileForUpload,
  fileManager: FileManager,
  logger: Logger,
  config: EventSignerConfig
): Promise<{
  fileContentBuffer: Buffer;
  fileName: string;
}> => {
  try {
    const s3Key = await fileManager.storeBytes(
      {
        bucket: config.s3Bucket,
        path: preparedFile.filePath,
        name: preparedFile.fileName,
        content: preparedFile.fileContentBuffer,
      },
      logger
    );

    logger.info(
      `Successfully stored file ${preparedFile.fileName} at S3 path ${s3Key}`
    );

    const s3KeyParts = s3Key.split("/");
    const extractedFileName = s3KeyParts.pop();
    if (!extractedFileName) {
      throw new Error(`Couldn't extract fileName from S3 path: ${s3Key}`);
    }

    return {
      fileContentBuffer: preparedFile.fileContentBuffer,
      fileName: extractedFileName,
    };
  } catch (error) {
    throw genericInternalError(
      `Failed to store file ${preparedFile.fileName} in S3: ${error}`
    );
  }
};
