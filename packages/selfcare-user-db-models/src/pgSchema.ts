import { pgSchema } from "drizzle-orm/pg-core";
import { UserSQLDbConfig } from "pagopa-interop-commons";

const config = UserSQLDbConfig.parse(process.env);

export const userSchema = pgSchema(config.userSQLDbSchema);
