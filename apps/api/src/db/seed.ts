import { prisma } from "../db/prisma.js";
import { env } from "../env.js";
import { hashPassword } from "../auth.js";

export async function ensureAdmin(): Promise<void> {
  if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD) return;

  const userCount = await prisma.user.count();
  if (userCount > 0) return;

  await prisma.user.create({
    data: {
      email: env.ADMIN_EMAIL,
      passwordHash: await hashPassword(env.ADMIN_PASSWORD),
      role: "ADMIN",
    },
  });
  console.log(`Seeded initial admin account: ${env.ADMIN_EMAIL}`);
}
