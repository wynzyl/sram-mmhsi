import { z } from "zod";

/** Safe parsing for UUID query params (school year, etc.) */
export function parseUuidSearchParam(value: string | undefined): string | undefined {
  if (value == null || value === "") return undefined;
  const parsed = z.string().uuid().safeParse(value.trim());
  return parsed.success ? parsed.data : undefined;
}
