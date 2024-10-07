import { z } from "zod";

export const SftpConfig = z
  .object({
    SFTP_HOST: z.string(),
    SFTP_PORT: z.coerce.number().min(1001),
    SFTP_USERNAME: z.string(),
    SFTP_PASSWORD: z.string(),
    SFTP_FILENAME_PREFIX: z.string(),
    SFTP_PATH: z.string(),
    FORCE_REMOTE_FILE_NAME: z.string().optional(),
  })
  .transform((c) => ({
    host: c.SFTP_HOST,
    port: c.SFTP_PORT,
    username: c.SFTP_USERNAME,
    password: c.SFTP_PASSWORD,
    fileNamePrefix: c.SFTP_FILENAME_PREFIX,
    folderPath: c.SFTP_PATH,
    forceFileName: c.FORCE_REMOTE_FILE_NAME,
  }));

export type SftpConfig = z.infer<typeof SftpConfig>;
