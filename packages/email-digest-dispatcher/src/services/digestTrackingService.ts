import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { and, eq, gte } from "drizzle-orm";
import { TenantId, UserId } from "pagopa-interop-models";
import { digestEmailSent, DigestEmailSentInsert } from "../model/schema.js";

export type DigestTrackingDb = NodePgDatabase<
  Record<string, typeof digestEmailSent>
>;

export type DigestTrackingService = {
  /**
   * Records that a digest email was sent to a user.
   * Uses upsert to handle both insert and update cases.
   */
  recordDigestSent: (userId: UserId, tenantId: TenantId) => Promise<void>;

  /**
   * Checks if a user has received a digest email within the specified number of hours.
   */
  hasReceivedDigestRecently: (
    userId: UserId,
    tenantId: TenantId,
    hours: number
  ) => Promise<boolean>;
};

export function digestTrackingServiceBuilder(
  db: DigestTrackingDb
): DigestTrackingService {
  return {
    async recordDigestSent(userId: UserId, tenantId: TenantId): Promise<void> {
      const record: DigestEmailSentInsert = {
        userId,
        tenantId,
        latestSentAt: new Date(),
      };

      await db
        .insert(digestEmailSent)
        .values(record)
        .onConflictDoUpdate({
          target: [digestEmailSent.userId, digestEmailSent.tenantId],
          set: { latestSentAt: new Date() },
        });
    },

    async hasReceivedDigestRecently(
      userId: UserId,
      tenantId: TenantId,
      hours: number
    ): Promise<boolean> {
      const cutoffDate = new Date();
      cutoffDate.setHours(cutoffDate.getHours() - hours);

      const result = await db
        .select({ latestSentAt: digestEmailSent.latestSentAt })
        .from(digestEmailSent)
        .where(
          and(
            eq(digestEmailSent.userId, userId),
            eq(digestEmailSent.tenantId, tenantId),
            gte(digestEmailSent.latestSentAt, cutoffDate)
          )
        )
        .limit(1);

      return result.length > 0;
    },
  };
}
