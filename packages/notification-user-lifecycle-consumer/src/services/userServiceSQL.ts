import { eq } from "drizzle-orm";
import { user, UserDB } from "pagopa-interop-selfcare-user-db-models";
import { drizzle } from "drizzle-orm/node-postgres";
import { UserId } from "pagopa-interop-models";

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function userServiceBuilderSQL(userDB: ReturnType<typeof drizzle>) {
  return {
    insertUser: async (values: UserDB): Promise<void> => {
      await userDB.insert(user).values(values);
    },
    updateUser: async (values: UserDB): Promise<void> => {
      await userDB.update(user).set(values);
    },
    deleteUser: async (userId: UserId): Promise<void> => {
      await userDB.delete(user).where(eq(user.userId, userId));
    },
  };
}
export type UserServiceSQL = ReturnType<typeof userServiceBuilderSQL>;
