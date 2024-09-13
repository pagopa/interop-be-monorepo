import { bffApi } from "pagopa-interop-api-clients";
import { z } from "zod";

export const PrivacyNoticeVersion = z.object({
  versionId: z.string(),
  name: z.string(),
  publishedDate: z.string(),
  status: z.string(),
  version: z.number(),
});
export type PrivacyNoticeVersion = z.infer<typeof PrivacyNoticeVersion>;

export const PrivacyNotice = z.object({
  privacyNoticeId: z.string(),
  createdDate: z.string(),
  lastPublishedDate: z.string(),
  organizationId: z.string(),
  responsibleUserId: z.string().optional(),
  privacyNoticeVersion: PrivacyNoticeVersion,
  persistedAt: z.string(),
});
export type PrivacyNotice = z.infer<typeof PrivacyNotice>;

export const UserPrivacyNoticeVersion = z.object({
  versionId: z.string(),
  kind: bffApi.ConsentType,
  version: z.number(),
});
export type UserPrivacyNoticeVersion = z.infer<typeof UserPrivacyNoticeVersion>;

export const UserPrivacyNotice = z.object({
  pnIdWithUserId: z.string(),
  versionNumber: z.number(),
  privacyNoticeId: z.string(),
  userId: z.string(),
  acceptedAt: z.string(),
  version: UserPrivacyNoticeVersion,
});
export type UserPrivacyNotice = z.infer<typeof UserPrivacyNotice>;
