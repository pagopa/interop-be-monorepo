import { TenantId } from "pagopa-interop-models";
import { UserDB } from "pagopa-interop-selfcare-user-db-models";
import { ReadModelServiceSQL } from "../services/readModelServiceSQL.js";
import { UserServiceSQL } from "../services/userServiceSQL.js";

export async function getUserEmailsToNotify(
  tenantId: TenantId,
  readModelService: ReadModelServiceSQL,
  userService: UserServiceSQL
): Promise<string[]> {
  const tenantUsers =
    await readModelService.getTenantUsersWithNotificationEnabled(
      [tenantId],
      "agreementActivatedRejectedToConsumer"
    );

  const userResults = await Promise.all(
    tenantUsers
      .map((config) => config.userId)
      .map((userId) => userService.readUser(userId))
  );
  const usersToNotify = userResults.filter(
    (userResult): userResult is UserDB => userResult !== undefined
  );
  return usersToNotify.map((user) => user.email);
}
