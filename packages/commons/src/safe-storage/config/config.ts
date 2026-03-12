import { z } from "zod";

export const SafeStorageApiConfig = z
  .object({
    SAFE_STORAGE_BASE_URL: z.string(),
    SAFE_STORAGE_API_KEY: z.string(),
    SAFE_STORAGE_CLIENT_ID: z.string(),
    SAFE_STORAGE_DOC_TYPE: z.string(),
    SAFE_STORAGE_DOC_STATUS: z.string(),
  })
  .transform((c) => ({
    safeStorageBaseUrl: c.SAFE_STORAGE_BASE_URL,
    safeStorageApiKey: c.SAFE_STORAGE_API_KEY,
    safeStorageClientId: c.SAFE_STORAGE_CLIENT_ID,
    safeStorageDocType: c.SAFE_STORAGE_DOC_TYPE,
    safeStorageDocStatus: c.SAFE_STORAGE_DOC_STATUS,
  }));

export type SafeStorageApiConfig = z.infer<typeof SafeStorageApiConfig>;
