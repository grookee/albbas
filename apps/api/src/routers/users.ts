import { domainSelectionSchema } from "@albbas/shared";
import { prisma } from "../db/prisma.js";
import { toDbDomain } from "../lib/domain.js";
import { toPublicUser } from "../lib/publicUser.js";
import { router, protectedProcedure } from "../trpc.js";

export const usersRouter = router({
  updateSettings: protectedProcedure
    .input(domainSelectionSchema)
    .mutation(async ({ input, ctx }) => {
      const user = await prisma.user.update({
        where: { id: ctx.user.id },
        data: {
          domain: toDbDomain(input.domain),
          subdomain: input.subdomain,
        },
      });
      return toPublicUser(user);
    }),
});
