# Capabilities

Capabilities are reusable product or infrastructure concerns that can be added to supported foundations without creating a new foundation.

Examples include authentication, PostgreSQL, Redis, storage, payments, background jobs, realtime, notifications, search, AI, and analytics.

## v1 policy

The v1 catalog intentionally ships without standalone capability definitions. Add a capability only when:

- it has a stable contract;
- at least one foundation has a tested implementation;
- installation/evolution can be expressed declaratively;
- the integration is covered by an end-to-end test.

A capability is not a product type. Commerce, SaaS, messaging, and automation belong in recipes.
