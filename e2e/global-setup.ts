import { ensureE2eTestUsers } from "./ensure-test-users";
import { ensureE2eTestData } from "./ensure-test-data";

export default async function globalSetup(): Promise<void> {
  await ensureE2eTestUsers();
  await ensureE2eTestData();
}
