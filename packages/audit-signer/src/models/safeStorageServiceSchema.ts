import { z } from "zod";

export const FileCreationRequestSchema = z.object({
  contentType: z.string(),
  documentType: z.string(),
  status: z.string(),
  checksumValue: z.string(),
});

export type FileCreationRequest = z.infer<typeof FileCreationRequestSchema>;

export const FileCreationResponseSchema = z.object({
  uploadMethod: z.union([z.literal("PUT"), z.literal("POST")]),
  uploadUrl: z.string(),
  secret: z.string(),
  key: z.string(),
});

export type FileCreationResponse = z.infer<typeof FileCreationResponseSchema>;
