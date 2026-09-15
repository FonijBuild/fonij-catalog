<div align="center">

# Fonij Catalog

**The catalog tells Fonij what can be built, how pieces can be composed, and how an existing project can evolve safely.**

[![License: MIT](https://img.shields.io/badge/license-MIT-yellow.svg)](LICENSE)
![Status: Active](https://img.shields.io/badge/status-active-2EA44F)
![Contract: Versioned](https://img.shields.io/badge/contract-versioned-0EA5E9)

[Documentation](https://github.com/FonijBuild/fonij-docs) · [Discussions](https://github.com/orgs/FonijBuild/discussions) · [Issues](https://github.com/FonijBuild/fonij-catalog/issues)

</div>

> “What do we build for, if not to lessen each other’s hardship?”

## Structure

```text
foundations/   Runtime foundations
blueprints/    Supported project compositions
capabilities/  Addable product and technical capabilities
recipes/       Opinionated product patterns
evolutions/    Safe architecture migrations
schemas/       Versioned contracts
```

## Rules

- Add a foundation only when the runtime or deployment model is meaningfully different.
- Product types such as commerce, SaaS, or messaging are recipes—not new foundations.
- Capabilities describe intent; implementations may differ by stack.
- Catalog entries must be versioned, validated, and reproducible.
- Published foundations must reference immutable release tags.

## Relationship to the CLI

[`fonij-cli`](https://github.com/FonijBuild/fonij-cli) consumes this catalog to plan, generate, and evolve projects. Product-specific architecture decisions should not be hard-coded in the CLI.

## Contributing

New entries should solve a reusable product-building problem. Start with a Discussion before introducing a new foundation.
