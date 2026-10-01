# Security Policy

Personal Data OS is an open-source, privacy-first personal telemetry system designed for self-hosted data ownership. We take the security of the application and the privacy of personal metrics seriously.

This document outlines supported versions, private vulnerability reporting procedures, disclosure expectations, self-hosted deployment responsibilities, and data handling standards.

---

## Supported Versions

Personal Data OS is currently in active early development. Security patches and bug fixes are applied directly to the `main` development line.

Older commits, development snapshots, feature branches, and historical release tags do not receive guaranteed backports or maintenance releases. Operators running Personal Data OS are encouraged to keep their instances updated to the latest revision of `main`.

| Version / Line | Supported | Description |
| :--- | :--- | :--- |
| `main` | :white_check_mark: Yes | Active development line; receives security fixes. |
| Older commits / snapshots | :x: No | No guaranteed security backports or maintenance releases. |

The project does not currently maintain a long-term-supported (LTS) release line.

---

## Security Boundaries & Early Development

Because Personal Data OS is in active early development, operators and contributors should understand its current security boundaries:

- **No Built-in Authentication**: The application does not currently provide an application-level user authentication or authorization layer. It is designed to run locally (`localhost`) or within a secure, private network (such as a local LAN or a private VPN like Tailscale or WireGuard).
- **Evolving Architecture**: Internal APIs, database models, and configuration flags may change between development revisions.
- **Untrusted Network Exposure**: Personal Data OS should not be exposed directly to the public internet without operator-managed access controls and network defenses.

---

## Reporting a Vulnerability

If you discover a security vulnerability or suspect a potential security defect in Personal Data OS, **please report it privately**.

### Primary Reporting Path

Please submit vulnerability reports through **GitHub Private Vulnerability Reporting**:

1. Open the repository's [Security Advisories](https://github.com/rodrigolinhas/personal-data-os/security/advisories) page.
2. Select **Report a vulnerability** (or navigate directly to the [New Advisory](https://github.com/rodrigolinhas/personal-data-os/security/advisories/new) form).
3. Provide details describing the issue and submit the private advisory.

Private reporting allows maintainers to evaluate and remediate vulnerabilities before details become public.

### Reporting Rules

To protect users and their personal information:

- **Do NOT** open a public GitHub Issue for an undisclosed security vulnerability.
- **Do NOT** open a public Pull Request that includes exploit code or demonstrates an unpatched flaw.
- **Do NOT** post credentials, tokens, personal data, database dumps, or sensitive logs in public forums, issues, or pull requests.
- **Do NOT** publicly disclose an uncoordinated vulnerability before the maintainer has had a reasonable opportunity to investigate and respond.

*Note: The repository does not publish a dedicated security email address. Please use GitHub Private Vulnerability Reporting for all vulnerability disclosures.*

---

## What to Include in a Report

To help us investigate, reproduce, and remediate the issue effectively, please include as much relevant context as possible:

- **Summary**: A concise description of the vulnerability and its potential security impact.
- **Affected Component**: The affected subsystem (e.g. Go backend API, React frontend, PostgreSQL persistence, configuration loader, CI/CD workflows, or dependencies).
- **Affected Commit or Version**: The Git commit SHA or branch where the issue was identified.
- **Environment & Assumptions**: Operating system, Go/Node versions, Docker configuration, browser (if frontend), or network topology assumptions.
- **Reproduction Steps**: Clear, step-by-step instructions to reproduce the issue.
- **Proof of Concept (PoC)**: A safe demonstration or minimal reproduction scenario, where appropriate.
- **Expected vs. Actual Impact**: What should happen versus the observed security failure (e.g. unauthorized data read, privilege escalation).
- **Prerequisites**: Any required privileges, non-default configuration settings, or specific deployment configurations necessary to exploit the issue.
- **Remediation Ideas**: Suggested patches or mitigation strategies, if known.

Reporters are not required to provide every item above; partial reports that clearly identify an issue are still valued.

---

## Privacy and Sensitive Data in Reports

Personal Data OS is built to track personal telemetry (e.g. sleep duration, reading activity, workouts, habits). Vulnerability reports **must never contain real personal data or production secrets**.

Please observe the following data safety rules:

- **No Real Personal Datasets**: Do not include real sleep logs, health information, reading histories, habits, workout metrics, or future personal domain data.
- **No Real Secrets**: Do not paste real API tokens, GitHub Personal Access Tokens, database passwords, session secrets, or actual `.env` file contents.
- **No Production Database Dumps**: Do not attach production database exports or raw database files.
- **Use Synthetic Fixtures**: Use mocked, synthetic datasets (e.g. placeholder timestamps, fictional metrics, dummy tokens like `mock-token-xyz`).
- **Redact Logs**: Sanitize and redact environment variables, hostnames, and credentials from error traces before sharing.

---

## Coordinated Disclosure

We follow coordinated vulnerability disclosure:

1. **Intake & Acknowledgement**: When a private advisory is submitted, we make a reasonable effort to acknowledge and review valid reports.
2. **Investigation**: The maintainer investigates the report to verify reproducibility, severity, and potential impact. Clarifications may be requested directly within the private advisory discussion.
3. **Remediation**: A fix is developed and verified in a private branch or advisory fork.
4. **Advisory & Release**: The fix is merged into `main`, and an advisory or release note is drafted summarizing the impact and fix.
5. **Public Disclosure**: Coordinated public disclosure occurs once the remediation is available.

*Notice*: Personal Data OS is an open-source project maintained on a best-effort basis. The project does not offer a bug bounty program, does not provide monetary rewards, does not guarantee specific response or resolution timeframes (SLAs), and does not guarantee CVE assignment.

---

## Security Scope

### What to Report

We welcome reports concerning security vulnerabilities that materially impact Personal Data OS, including:

- Remote code execution (RCE)
- SQL injection or unauthorized database query manipulation
- Path traversal and arbitrary file access
- Authentication or authorization bypasses (as access controls are introduced)
- Unintended exposure or leakage of stored personal telemetry
- Exposure of application secrets, database credentials, or integration tokens
- Insecure handling or transmission of tokens and credentials
- Cross-site scripting (XSS) with demonstrable security impact
- Cross-site request forgery (CSRF) where state-changing actions are vulnerable
- Unsafe configuration defaults that compromise deployment security
- Dependency vulnerabilities with realistic and demonstrable impact on the application
- Supply-chain or build tampering risks
- Accidental logging or leaking of secrets or personal datasets in application logs
- Flaws in GitHub Actions workflows or repository CI pipelines that compromise repository security

### Non-Security Issues

Ordinary bugs, feature requests, and operational questions should be submitted through [public GitHub Issues](https://github.com/rodrigolinhas/personal-data-os/issues). Examples include:

- User interface styling, alignment, or layout bugs
- General functional bugs without security impact
- Feature requests and domain tracker proposals
- Non-exploitable performance bottlenecks
- Documentation updates and typo fixes
- Routine local development environment failures

**Rule of thumb**: If publishing reproduction steps or exploit details could compromise user data, credentials, or running instances, use **GitHub Private Vulnerability Reporting**. Otherwise, open a public GitHub Issue.

---

## Self-Hosted Deployment & Operator Responsibilities

Personal Data OS is designed for self-hosting. Security in a self-hosted architecture is a shared responsibility between the software and the instance operator.

### Application Responsibilities
- Provide secure default configurations where implemented.
- Use explicit, parameterized SQL queries via `sqlc` to prevent SQL injection.
- Validate and sanitize HTTP request inputs on backend endpoints.
- Prevent secrets and credentials from being committed to source control or logged in runtime traces.

### Operator Responsibilities
- **Database Isolation**: Do not expose the PostgreSQL database port (`5432`) directly to the public internet. Restrict database access to `localhost` (`127.0.0.1`) or an isolated internal Docker container network.
- **Network Protection & Access Control**: Because Personal Data OS does not currently include built-in user authentication, do not expose the web interface or API directly to untrusted networks. Access the instance locally, across a trusted private LAN, or through an encrypted VPN (such as WireGuard or Tailscale).
- **TLS and Reverse Proxies**: When accessing the service over a network, route traffic through a reverse proxy (e.g. Caddy, Nginx, or Traefik) configured with modern TLS. Note that a reverse proxy does not provide authentication on its own unless an external authentication mechanism (e.g. Authelia, Cloudflare Access, or HTTP authentication) is configured.
- **Credential Security**: Set strong, unique passwords for `POSTGRES_PASSWORD` and integration tokens. Never use default or easily guessed passwords.
- **Environment & File Permissions**: Secure your `.env` file and configuration files. Restrict file read permissions (e.g. `chmod 600 .env`) so unauthorized users on the host system cannot access secrets.
- **Host & Dependency Updates**: Keep the host operating system, Docker engine, container images, and application updated with security patches.
- **Backups & Disaster Recovery**: Maintain encrypted, off-site or isolated backups of your PostgreSQL data volume (`postgres_data`) aligned with your personal threat model.

---

## Repository Security Controls

The repository maintains automated defense-in-depth controls to assist code quality and vulnerability detection:

- **Continuous Integration (CI)**: GitHub Actions automatically runs formatting checks (`gofmt`, Prettier), static analysis (`go vet`, ESLint), unit and integration tests with Go's race detector (`go test -race`), and production builds on pull requests.
- **Go Vulnerability Auditing**: Automated [`govulncheck`](https://pkg.go.dev/golang.org/x/vuln/cmd/govulncheck) scans analyze Go dependencies and code in CI for known public vulnerabilities.
- **CodeQL Code Scanning**: GitHub CodeQL scans Go, JavaScript/TypeScript, and GitHub Actions workflows to identify potential security weaknesses and anti-patterns.
- **Secret Scanning & Dependabot**: Automated GitHub security features alert on potential leaked credentials and outdated or vulnerable package dependencies.
- **Protected Branch Workflows**: Changes to `main` require review and passing CI verification status checks.

These automated controls are defense-in-depth mechanisms and do not guarantee the absence of all vulnerabilities.

---

## Accidental Secret Exposure

If a secret, API token, database password, or private credential is accidentally committed to Git, posted in an issue, or otherwise exposed:

1. **Assume Immediate Compromise**: Treat the secret as compromised from the moment of exposure. Automated bots continuously scan public Git repositories and feeds.
2. **Revoke and Rotate Immediately**: Revoke the credential at its issuing service (e.g. GitHub token settings, PostgreSQL user password) and generate a new one.
3. **Do Not Rely on New Commits**: Simply removing the secret in a later commit leaves the credential accessible in Git history.
4. **Remediate Repository History**: If a secret was committed, purge the commit history using tools like `git-filter-repo` or BFG Repo-Cleaner in coordination with repository maintainers.
5. **Do Not Re-post the Secret**: When reporting the exposure, never paste the secret value itself. Reference only the credential type, rotation status, and affected commit SHA.
