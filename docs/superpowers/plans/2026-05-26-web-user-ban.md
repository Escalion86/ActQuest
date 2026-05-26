# Web User Ban Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Сделать `ban` жёстким в web/cabinet: при бане исключать пользователя из всех команд, показывать preview/confirm в админке и запретить создание и вступление в команды.

**Architecture:** Основная логика выносится в отдельный серверный модуль preview/apply, чтобы UI и route handlers использовали один источник истины. Админский UI переводится на двухшаговый сценарий `ban-preview -> confirm`, а командные route handlers получают жёсткие server-side guards по роли `ban`.

**Tech Stack:** Next.js App Router, NextAuth, Mongoose, React 19, node:test

---
