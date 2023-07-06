import { logger } from "./logger.js";

export type FileManager = {
  deleteFile: (path: string) => Promise<void>;
};

function initFileManager(): FileManager {
  return {
    deleteFile: async (path: string): Promise<void> => {
      logger.info(`Deleting file ${path}`);

      return Promise.resolve();
    },
  };
}

export const fileManager = initFileManager();
