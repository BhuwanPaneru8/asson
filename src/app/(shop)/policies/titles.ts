import type { MessageKey } from "@/lib/i18n";

/** Policy titles in the shopper's language (the policy text itself is English: see lib/policies.ts). */
export const policyTitles = (t: (k: MessageKey) => string): Record<string, string> => ({
  terms: t("policies.terms"), privacy: t("policies.privacy"), shipping: t("policies.shipping"), returns: t("policies.returns"),
  payments: t("policies.payments"), rewards: t("policies.rewards"), cookies: t("policies.cookies"),
});
