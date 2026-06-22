# FICA Compliance KYC & KYB AI Agent Onboarding Platform

An enterprise-ready AI Agent prototype designed to automate Know Your Customer (KYC) and Know Your Business (KYB) compliance checks under South Africa's **FICA (Financial Intelligence Centre Act)** regulations. Developed for **Fraudcheck**, this platform demonstrates how autonomous reasoning agents can streamline regulatory workflows while maintaining absolute auditability and strict POPIA compliance.

---

## 🎯 The Business Goal

Manual FICA verification is a major bottleneck in customer onboarding—requiring compliance officers to manually query government databases, cross-reference corporate registries, inspect shareholder lists, screen watchlists, and verify bank details. This process takes hours or days, incurs high operational costs, and leads to customer abandonment.

This platform solves this by deploying a **compliance-focused AI Agent** that programmatically executes, reasons, and signs FICA audits in seconds, turning compliance into a seamless, high-velocity onboarding path.

---

## 💎 Core Value Proposition

*   **Operational Efficiency**: Replaces manual multi-registry searches (DHA, CIPC) with an autonomous ReAct reasoning agent that gathers, audits, and presents decision-ready compliance briefs in real-time.
*   **Tamper-Proof Regulatory Trail**: Every check runs in an isolated sandbox. On completion, a SHA-256 cryptographic signature is generated for the entire execution telemetry, serving as a verifiable ledger to prove zero manual manipulation or data tampering.
*   **Recursive UBO Corporate Auditing (KYB)**: Automatically maps complex corporate structures from CIPC registries, identifies Ultimate Beneficial Owners (UBOs) and directors, and runs recursive KYC validations on all associated individuals in a single workflow.
*   **Resiliency & High Availability**: Built with a fail-safe hybrid engine. If live AI services (Gemini API) experience rate limits (e.g., 429 quota exhaustion) or network outages, the platform gracefully falls back to local compliance sandboxes and flags the telemetry with clear system warnings, ensuring zero onboarding downtime.
*   **POPIA & Data Privacy Compliance**: Restricts data access using ephemeral, isolated directory sandboxes (`CaseIsolationSandbox`). Files and logs are strictly partitioned to ensure compliance with South Africa’s Protection of Personal Information Act (POPIA).

---

## 🛠️ The Architecture & Stack

Designed to be lightweight, secure, and easily integrated into existing enterprise stacks:

*   **AI Engine**: ReAct (Reasoning and Action) loop using Google Gemini models, orchestrating multiple specialized verification tools (DHA registry, CIPC corporate registries, sanctions screening, bank verification).
*   **Backend Services**: High-performance FastAPI backend with automatic Swagger documentation.
*   **Database**: SQLite managed via Peewee ORM for clean, secure, and transactional persistence of audit cases.
*   **Frontend Telemetry Panel**: A responsive dashboard visualizing the live agent reasoning timeline, corporate director trees, and verifiable PDF audit report downloads.
*   **Containerized Deployment**: Built as a standard Docker service and pre-configured for instant deployment on cloud environments (AWS, GCP, Render).
