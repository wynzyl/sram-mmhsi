import { z } from "zod";
import type { BaseFormState } from "@/lib/validators/common-schemas";

export const LoginSchema = z.object({
  username: z
    .string({ error: "Username or email is required." })
    .min(1, { error: "Username or email is required." })
    .trim()
    // Must match createUser / DB: usernames and emails are stored lowercased
    .toLowerCase(),
  password: z
    .string({ error: "Password is required." })
    .min(1, { error: "Password is required." }),
});

export type LoginInput = z.infer<typeof LoginSchema>;

export type LoginFormState = BaseFormState<LoginInput> | undefined;
