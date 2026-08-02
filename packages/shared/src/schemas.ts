import { z } from "zod";
import { ALLOWED_DOMAINS, SUBDOMAIN_PATTERN } from "./constants.js";

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(255)
  .email()
  .refine((v) => v.length <= 255, "Email too long");

export const passwordSchema = z.string().min(8).max(200);

export const loginSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});
export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  inviteCode: z
    .string()
    .trim()
    .toUpperCase()
    .min(4)
    .max(64)
    .regex(/^[A-Z0-9-]+$/, "Invalid invite code format"),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const domainSelectionSchema = z.object({
  domain: z.enum(ALLOWED_DOMAINS),
  subdomain: z
    .string()
    .trim()
    .toLowerCase()
    .min(1)
    .max(63)
    .regex(SUBDOMAIN_PATTERN, "Invalid subdomain"),
});
export type DomainSelection = z.infer<typeof domainSelectionSchema>;

export function baseUrlFor(selection: DomainSelection): string {
  return `https://${selection.subdomain}.${selection.domain}`;
}

export const createApiKeySchema = z.object({
  name: z.string().trim().min(1).max(100),
});
export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>;

export const createInviteSchema = z.object({
  expiresAt: z.string().datetime().nullish(),
});
export type CreateInviteInput = z.infer<typeof createInviteSchema>;
