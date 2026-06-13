# Security Policy

We take the security of Vet seriously. If you believe you have found a security vulnerability, please report it to us responsibly using the process outlined below.

---

## Supported Versions

Only the latest release version of Vet is actively supported with security updates and patches. 

| Version | Supported          |
| ------- | ------------------ |
| 1.x     | :white_check_mark: |
| < 1.0   | :x:                |

---

## Reporting a Vulnerability

**Please do not report security vulnerabilities via public GitHub issues.**

Instead, please report security vulnerabilities directly to the maintainer via email at [vet@route2place.com](mailto:vet@route2place.com).

When submitting a report, please include:
* A detailed description of the vulnerability and its potential impact.
* Step-by-step instructions (or a proof-of-concept script) to reproduce the vulnerability.
* Any potential mitigation steps or patch suggestions you might have.

We will acknowledge receipt of your report within 48 hours and work with you to analyze and resolve the issue.

---

## Security Best Practices for Users

Since Vet is a terminal emulator that handles sensitive user data (such as environment variables, shell transcripts, and SSH/SFTP credentials), we recommend the following precautions:
1. **Access Permissions**: Secure the local config file at `~/.config/vet/config.json5` and the local SQLite database to prevent unauthorized access.
2. **Untrusted Sites**: Exercise caution when using the built-in browser to visit untrusted sites. Although sandboxed, webviews can expose client surfaces.
3. **Scripts**: Be careful when running third-party scripts via the script runner panel. Always inspect the content of the script before executing it.
