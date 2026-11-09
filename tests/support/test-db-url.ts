import os from "node:os";

/** The isolated integration-test database. Override with TEST_DATABASE_URL (CI sets it). */
export const testDatabaseUrl = () =>
  process.env.TEST_DATABASE_URL ?? `postgresql://${os.userInfo().username}@localhost:5432/asson_test?schema=public`;
