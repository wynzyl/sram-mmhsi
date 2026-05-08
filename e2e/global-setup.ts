import { ensureE2eTestUsers } from "./ensure-test-users";

export default async function globalSetup(): Promise<void> {
  await ensureE2eTestUsers();
}
