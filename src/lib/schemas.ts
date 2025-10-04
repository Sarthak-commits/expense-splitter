import { z } from "zod";

// Currency: restrict to USD for now. Later, expand to ISO 4217 list.
export const currencySchema = z
  .string()
  .transform((s) => s.trim().toUpperCase())
  .refine((s) => s === "USD", { message: "Only USD is supported currently" });

// Basic positive decimal as string/number with up to 2 dp
// Accept number or string, normalize to string for server-side Decimal parsing
export const amountInputSchema = z
  .union([z.string(), z.number()])
  .transform((v) => (typeof v === "number" ? v.toString() : v))
  .refine((s) => /^(?:\d+)(?:\.\d{1,2})?$/.test(s), {
    message: "Amount must be a positive number with up to 2 decimals",
  })
  .refine((s) => {
    try {
      const n = Number(s);
      return n > 0;
    } catch {
      return false;
    }
  }, { message: "Amount must be greater than 0" });

export const registerSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
  password: z.string().min(6).max(100),
});

export const addMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(["OWNER", "ADMIN", "MEMBER"]).optional(),
});

export const removeMemberSchema = z.object({
  userId: z.string().min(1),
});

export const expenseCreateSchema = z.object({
  description: z.string().min(1).max(200),
  amount: amountInputSchema,
  currency: currencySchema.default("USD"),
});

export const settlementCreateSchema = z.object({
  fromUserId: z.string().min(1),
  toUserId: z.string().min(1),
  amount: amountInputSchema,
});