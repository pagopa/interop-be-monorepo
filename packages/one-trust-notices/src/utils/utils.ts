/* eslint-disable no-console */
import {
  GetNoticeContentResponseData,
  OneTrustNoticeVersion,
  OneTrustPublicNotice,
  OneTrustNoticeDBSchema,
} from "../models/index.js";

/**
 * Get the notice html content from the OneTrust notice data.
 *
 * @param oneTrustResponseBody The OneTrust notice data.
 * @returns The notice content.
 * */
export function getNoticeContent(
  oneTrustResponseBody: GetNoticeContentResponseData
): OneTrustPublicNotice {
  return Object.values(oneTrustResponseBody.notices)[0];
}

/**
 * Generates the bucket path in which the notice data will be stored privately.
 * The private bucket path is generated using the notice id and version id.
 * This way the BFF can access a specific version of the notice.
 *
 * @param lang The language of the notice.
 * @param oneTrustResponseBody The OneTrust notice data.
 */
export function getVersionedNoticeBucketPath(
  lang: string,
  oneTrustPublicNotice: OneTrustPublicNotice
): string {
  return `consent/${oneTrustPublicNotice.id}/${oneTrustPublicNotice.versionId}/${lang}/notice.json`;
}

/**
 * Get the path in which the notice data will be stored in the buckets.
 * The public bucket path is generated using a fixed path and will always point to the latest version of the notice.
 * This is used by the FE to access to the latest version of the notice without having to know the ids.
 *
 * @param lang The language of the notice.
 * @param type The type of the notice, tos or pp.
 */
export function getLatestNoticeBucketPath(
  lang: string,
  type: "tos" | "pp"
): string {
  return `consent/latest/${lang}/${type}.json`;
}

/**
 * Remaps the OneTrust notice version retrived from the OneTrust API to the DynamoDB schema object used
 * to update the notice in the database.
 *
 * @param oneTrustNoticeVersion The OneTrust notice version.
 * @returns The DynamoDB schema update object.
 * */
export function remapOneTrustNoticeVersionToDynamoDBSchemaUpdateObject(
  oneTrustNoticeVersion: OneTrustNoticeVersion
): Omit<OneTrustNoticeDBSchema, "privacyNoticeId"> {
  const {
    createdDate,
    lastPublishedDate,
    version: { id: versionId, publishedDate, ...versionRest },
    organizationId,
  } = oneTrustNoticeVersion;

  return {
    persistedAt: new Date().toISOString(),
    createdDate: new Date(createdDate).toISOString(),
    lastPublishedDate: new Date(lastPublishedDate).toISOString(),
    privacyNoticeVersion: {
      versionId,
      publishedDate: new Date(publishedDate).toISOString(),
      ...versionRest,
    },
    organizationId,
  };
}

/**
 * Calls a function and logs the execution time.
 *
 * @param fn The function to call
 * @returns The result of the function
 */
export async function withExecutionTime(
  fn: () => void | Promise<void>
): Promise<void> {
  const t0 = performance.now();
  await fn();
  const t1 = performance.now();
  const executionTimeMs = t1 - t0;
  const executionTimeSeconds = Math.round((executionTimeMs / 1000) * 10) / 10;
  console.log(`Execution time: ${executionTimeSeconds}s`);
}

/**
 * DynamoDB does not support nested object keys, this type removes all keys that contain objects.
 */
export type DynamoDBKeyOf<T> = Partial<{
  [K in keyof T as T[K] extends object ? never : K]: T[K] extends object
    ? never
    : T[K];
}>;

export type DeepPartial<T> = T extends object
  ? {
      [P in keyof T]?: DeepPartial<T[P]>;
    }
  : T;
