import type { Domain } from '@prisma/client';
import type { AllowedDomain } from '@albbas/shared';
import { baseUrlFor } from '@albbas/shared';

const DOMAIN_TO_SHARED: Record<Domain, AllowedDomain> = {
  MATEAKOS_COM: 'mateakos.com',
  BUFET_LOL: 'bufet.lol',
};

const SHARED_TO_DOMAIN: Record<AllowedDomain, Domain> = {
  'mateakos.com': 'MATEAKOS_COM',
  'bufet.lol': 'BUFET_LOL',
};

export function toAllowedDomain(domain: Domain | null): AllowedDomain | null {
  return domain ? DOMAIN_TO_SHARED[domain] : null;
}

export function toDbDomain(domain: AllowedDomain): Domain {
  return SHARED_TO_DOMAIN[domain];
}

export function baseUrlForUser(user: {
  domain: Domain | null;
  subdomain: string | null;
}): string | null {
  const domain = toAllowedDomain(user.domain);
  if (!domain) return null;
  return baseUrlFor({ domain, subdomain: user.subdomain ?? undefined });
}
