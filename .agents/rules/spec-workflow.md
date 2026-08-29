---
trigger: always_on
description: Standard Spec-Driven Development (SDD) and engineering quality rules for the project.
---

# Spec-Driven Development & Quality Guidelines

This project follows **Spec-Driven Development (SDD)** and modular clean architecture.

## 1. Spec-First Principle
Before implementing any non-trivial feature or module:
1. **Define Data Contracts First**: Explicitly define TypeScript interfaces for inputs, outputs, messages, and state.
2. **Handle Edge Cases Early**: Specify fallback states (e.g. video has no subtitles, network offline, API token expired, DOM changes on Bilibili).
3. **Chunk Work into Verifiable Milestones**: Break features into small, atomic tasks that can be tested independently.

## 2. Code Quality & Modularity
* **Single Responsibility**: Keep UI components pure and presentational. Move business logic (APIs, parsers, LLM streaming) into dedicated service/utils files.
* **Defensive Programming**: Always validate external API responses and DOM queries with null checks and try-catch blocks.
* **Test Critical Utilities**: Pure functions (timestamp parsers, subtitle chunkers, time overlap detectors) must have unit tests.
