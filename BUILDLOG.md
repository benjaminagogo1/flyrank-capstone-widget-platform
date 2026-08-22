# Build log

Implemented the initial platform with AI assistance. Reviewed and simplified the generated code into a dependency-free Node.js service. Storage is in-memory for local demonstration; production deployment should replace it with PostgreSQL and durable rate limiting.

Refactor: AI helped identify gaps against the capstone PDF and draft the HTTP/service/store separation. I retained Node rather than switching stacks, replaced volatile storage with a file-backed persistence adapter, added a second tenant, idempotency, asynchronous notification handling, boundary validation, and acceptance tests. The generated first server patch needed manual correction because it did not match the existing one-line file and the sandbox prevented TCP-based tests from binding locally.



---

# 2. `BUILDLOG.md`

```markdown
# BUILDLOG.md

# FlyRank Capstone — AI-Assisted Development Log

This document records the use of AI during development of the FlyRank Backend Capstone.

The purpose is to maintain an honest engineering record.

AI assistance is allowed by the assignment, but the developer remains responsible for understanding, reviewing, testing, and explaining the final implementation.

---

# Project Information

**Project:** FlyRank Capstone — Embeddable Widget & Lead-Capture Platform

**Current Phase:** Phase 1 — Design

**Status:** In Progress

---

# AI Usage Principles

The following rules apply throughout the project:

- AI-generated code must be reviewed.
- AI suggestions must not automatically be treated as correct.
- Important architectural decisions must be understood before implementation.
- Tests must verify behavior.
- Security-related suggestions must be critically reviewed.
- No passwords, API keys, tokens, or other secrets will be supplied to AI.
- No `.env` file will be committed.
- AI mistakes will be recorded honestly.
- The final system must be explainable by the developer.

---

# Entry 001 — Initial Project Design

**Date:** 2026-08-22

**Phase:** Phase 1 — Design

## Objective

Convert the capstone brief into an initial technical design.

## AI Assistance

AI was used to help:

- break the assignment into major components;
- identify the three major request paths;
- identify the main database entities;
- establish the initial layered architecture;
- identify public API security boundaries;
- identify resilience requirements;
- create the initial README;
- create the initial evidence structure;
- create the initial AI usage log.

## Result

The initial architecture was defined as:

```text
HTTP/API Layer
      |
      v
Service Layer
      |
      v
Repository/Data Layer
      |
      v
PostgreSQL