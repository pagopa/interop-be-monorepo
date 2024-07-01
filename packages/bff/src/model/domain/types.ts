export type PrivacyNotice = {
  privacyNoticeId: string;
  createdDate: string;
  lastPublishedDate: string;
  organizationId: string;
  responsibleUserId?: string;
  privacyNoticeVersion: PrivacyNoticeVersion;
  persistedAt: string;
};

export type PrivacyNoticeVersion = {
  versionId: string;
  name: string;
  publishedDate: string;
  status: string;
  version: number;
};

export type UserPrivacyNotice = {
  pnIdWithUserId: string;
  versionNumber: number;
  privacyNoticeId: string;
  userId: string;
  acceptedAt: string;
  version: UserPrivacyNoticeVersion;
};

export type UserPrivacyNoticeVersion = {
  versionId: string;
  kind: PrivacyNoticeKind;
  version: number;
};

export enum PrivacyNoticeKind {
  TOS = "TOS",
  PP = "PP",
}
