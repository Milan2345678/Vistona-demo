import { hashSync } from "bcryptjs";

export const DUMMY_PASSWORD_HASH = hashSync(
  "vistona-dummy-password-never-valid",
  12,
);
