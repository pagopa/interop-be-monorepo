import { z } from "zod";

export const OneTrustNoticeVersion = z.object({
  id: z.string().uuid(),
  createdDate: z.string(),
  lastPublishedDate: z.string(),
  organizationId: z.string().uuid(),
  version: z.object({
    id: z.string().uuid(),
    name: z.string(),
    publishedDate: z.string(),
    status: z.string(),
    version: z.number(),
  }),
});

export type OneTrustNoticeVersion = z.infer<typeof OneTrustNoticeVersion>;

export const OneTrustPublicNotice = z.object({
  content: z.string(),
  timestamp: z.string(),
  contentCss: z.array(z.string()),
  id: z.string(),
  versionId: z.string(),
  tenantId: z.string(),
  targetElementValue: z.string(),
  targetElementAttribute: z.string(),
});

export type OneTrustPublicNotice = z.infer<typeof OneTrustPublicNotice>;

export const GetNoticeContentResponseData = z.object({
  schemaType: z.string(),
  schemaVersion: z.number(),
  notices: z.record(z.string(), OneTrustPublicNotice),
});

export type GetNoticeContentResponseData = z.infer<
  typeof GetNoticeContentResponseData
>;
