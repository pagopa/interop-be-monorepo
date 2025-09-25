import { inArray } from "drizzle-orm";
import { user } from "pagopa-interop-selfcare-user-db-models";
import { drizzle } from "drizzle-orm/node-postgres";
import { unsafeBrandId, UserId } from "pagopa-interop-models";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function userServiceBuilderSQL(userDB: ReturnType<typeof drizzle>) {
  return {
    readUsers: async (
      userIds: UserId[]
    ): Promise<Array<{ userId: UserId; email: string }>> => {
      const result = await userDB
        .select()
        .from(user)
        .where(inArray(user.userId, userIds));
      return result.map(({ userId, email }) => ({
        userId: unsafeBrandId(userId),
        email,
      }));
    },
  };
}
export type UserServiceSQL = ReturnType<typeof userServiceBuilderSQL>;
