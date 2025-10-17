import { z } from "zod";

export const FileDownloadResponseSchema = z.object({
  key: z.string(),
  versionId: z.string(),
  contentType: z.string(),
  contentLength: z.number(),
  checksum: z.string(),
  documentType: z.string(),
  documentStatus: z.string(),
  retentionUntil: z.string(),
  download: z
    .object({
      url: z.string().optional(),
      retryAfter: z.number().optional(),
    })
    .optional(),
});

export type FileDownloadResponse = z.infer<typeof FileDownloadResponseSchema>;
