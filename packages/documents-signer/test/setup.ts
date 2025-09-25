/* eslint-disable functional/immutable-data */
process.env.LOG_LEVEL = "info";
process.env.DB_TABLE_NAME = "interop-test-table";
process.env.AWS_REGION = "eu-west-1";
process.env.KAFKAJS_LOG_LEVEL = "debug";

process.env.TOKEN_GENERATION_READ_MODEL_DB_NAME = "interop-test";
process.env.TOKEN_GENERATION_READ_MODEL_DB_USER = "user";
process.env.TOKEN_GENERATION_READ_MODEL_DB_PASSWORD = "password";
process.env.TOKEN_GENERATION_READ_MODEL_TABLE_NAME = "interop-test-table";

export const readModelSQLConfig = {
  readModelSQLDbPort: 5432,
  readModelSQLDbName: "test_db",
  readModelSQLDbUser: "user",
  readModelSQLDbPassword: "password",
};

export const fileManagerConfig = {
  s3ServerPort: 4569,
  s3Bucket: "test-bucket",
};
