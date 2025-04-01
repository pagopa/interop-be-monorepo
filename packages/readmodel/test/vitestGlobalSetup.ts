import { setupTestContainersVitestGlobal } from "pagopa-interop-commons-test";

console.log(
  "executing setupTestContainersVitestGlobal from vitestGlobalSetup",
  process.pid
);
export default setupTestContainersVitestGlobal();
