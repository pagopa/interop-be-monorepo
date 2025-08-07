import { eq } from "drizzle-orm";
import { user, UserDB } from "pagopa-interop-selfcare-user-db-models";
import { drizzle } from "drizzle-orm/node-postgres";
import { UserId } from "pagopa-interop-models";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function userServiceBuilderSQL(userDB: ReturnType<typeof drizzle>) {
  return {
    readUser: async (userId: UserId): Promise<UserDB | undefined> => {
      const result = await userDB
        .select()
        .from(user)
        .where(eq(user.userId, userId));
      return result.length === 0 ? undefined : result[0];
    },
  };
}
export type UserServiceSQL = ReturnType<typeof userServiceBuilderSQL>;
