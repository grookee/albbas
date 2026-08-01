import type { User } from "@prisma/client";
import type { PublicUser } from "@albbas/shared";
import { toAllowedDomain } from "./domain.js";

type UserFields = Pick<
  User,
  "id" | "email" | "role" | "domain" | "subdomain" | "createdAt"
>;

export function toPublicUser(user: UserFields): PublicUser {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    domain: toAllowedDomain(user.domain),
    subdomain: user.subdomain,
    createdAt: user.createdAt.toISOString(),
  };
}
