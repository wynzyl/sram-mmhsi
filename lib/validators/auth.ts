import { z } from "zod";

export const LoginSchema = z.object({
  username: z
    .string({ error: "Username or email is required." })
    .min(1, { error: "Username or email is required." })
    .trim(),
  password: z
    .string({ error: "Password is required." })
    .min(1, { error: "Password is required." }),
});

export type LoginInput = z.infer<typeof LoginSchema>;

export type LoginFormState =
  | {
      errors?: {
        username?: string[];
        password?: string[];
      };
      message?: string;
    }
  | undefined;
