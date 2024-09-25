import { z } from "zod";

const OneTrustNoticeDBSchema = z.object({
  persistedAt: z.string(),
  lastPublishedDate: z.string(),
  privacyNoticeVersion: z.object({
    name: z.string(),
    versionId: z.string(),
    publishedDate: z.string(),
    version: z.number(),
    status: z.string(),
  }),
  createdDate: z.string(),
  organizationId: z.string(),
  privacyNoticeId: z.string(),
});

export type OneTrustNoticeDBSchema = z.infer<typeof OneTrustNoticeDBSchema>;
