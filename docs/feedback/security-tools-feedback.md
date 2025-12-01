1. NPM Audit Report - npm-audit.json

| Metric                   | Count |
| ------------------------ | ----- |
| Total Dependencies       | 887   |
| Production               | 87    |
| Development              | 751   |
| Optional                 | 84    |
| Critical Vulnerabilities | 0 ✅  |
| High Vulnerabilities     | 0 ✅  |
| Moderate Vulnerabilities | 0 ✅  |
| Low Vulnerabilities      | 0 ✅  |
| Info                     | 0 ✅  |

Status: ✅ CLEAN - No vulnerabilities detected across 887 dependencies

---

2. Snyk Security Test - snyk-report.json

| Severity              | Count |
| --------------------- | ----- |
| Critical              | 0 ✅  |
| High                  | 2 ⚠️  |
| Medium                | 4 ⚠️  |
| Low                   | 3     |
| Total Vulnerabilities | 9     |

Top Issues:

1. inflight (Medium) - Missing Release of Resource after Effective Lifetime (CWE-772)
   - Memory leak vulnerability
   - No fix available - library is unmaintained
   - Dependency path: @doyensec/electronegativity → @electron/asar → glob → inflight

Status: ⚠️ ISSUES FOUND - 2 high + 4 medium severity vulnerabilities

---

3. Retire.js Report - retire-report.json

| Metric                | Value        |
| --------------------- | ------------ |
| Vulnerable Components | 0 ✅         |
| Messages              | 0            |
| Errors                | 0            |
| Scan Duration         | 37.9 seconds |

Status: ✅ CLEAN - No retired/vulnerable JavaScript libraries detected

---

4. Semgrep Static Analysis - semgrep-report.json

| Severity       | Count |
| -------------- | ----- |
| ERROR          | 0 ✅  |
| WARNING        | 20 ⚠️ |
| INFO           | 4     |
| Total Findings | 24    |

Top Issues:

| Issue Type | Count | Severity | Description
|
|--------------------------------------------|-------|----------|-----------------------------------------------------------------------
----|
| path-traversal.path-join-resolve-traversal | 16 | WARNING | Path traversal risks in file-storage.service.ts and
file-tools.service.ts |
| unsafe-formatstring.unsafe-formatstring | 4 | INFO | Format string injection in logging (storage.service.ts,
AuditService.ts) |

Key Files with Issues:

- src-electron/services/file-storage.service.ts - 10 path traversal warnings
- src-electron/services/file-tools.service.ts - 6 path traversal warnings
- src/lib/services/storage.service.ts - 4 format string warnings

Status: ⚠️ FINDINGS - 20 warnings (mostly path traversal, already mitigated with // nosemgrep comments)

---

5. ESLint Security Analysis - eslint-security.json

| Metric              | Count   |
| ------------------- | ------- |
| Total Files Scanned | 111     |
| Files with Issues   | 79      |
| Total Errors        | ~400 ⚠️ |
| Total Warnings      | ~409 ⚠️ |
| Combined Issues     | ~809    |

Top Rule Violations:

| Rule                               | Count (est) | Type  | Description                                                  |
| ---------------------------------- | ----------- | ----- | ------------------------------------------------------------ |
| sonarjs/\* rules                   | ~200        | Error | Code quality issues (duplicates, complexity, commented code) |
| no-restricted-imports              | ~50         | Error | Importing entire 'electron' instead of specific modules      |
| @typescript-eslint/no-explicit-any | ~100        | Error | Usage of any type                                            |
| @typescript-eslint/no-unsafe-\*    | ~150        | Error | Unsafe type operations                                       |

Most Affected Files:

- src-electron/ipc-handlers/\*.ts - Multiple quality violations
- Chat provider files - Type safety issues
- Component files - Duplicate string literals

Status: ⚠️ MANY ISSUES - 809 code quality & type safety violations (not critical security issues)

---

6. Trivy Filesystem Scan - trivy-fs-report.json

| Metric                  | Value             |
| ----------------------- | ----------------- |
| Vulnerabilities Found   | 0 ✅              |
| Target Scanned          | package-lock.json |
| Package Manager         | npm               |
| Total Packages Analyzed | 887               |

Status: ✅ CLEAN - No vulnerabilities detected in dependencies

---

7. Trivy SBOM Scan - trivy-sbom-report.json

| Metric                | Value          |
| --------------------- | -------------- |
| Vulnerabilities Found | 0 ✅           |
| SBOM Format           | CycloneDX JSON |
| Components in SBOM    | ~1000+         |

Status: ✅ CLEAN - No vulnerabilities in SBOM analysis

---

8. Outdated Packages - outdated-packages.json

| Package           | Current  | Wanted   | Latest  | Update Type |
| ----------------- | -------- | -------- | ------- | ----------- |
| @anthropic-ai/sdk | 0.68.0   | 0.68.0   | 0.71.0  | Minor       |
| @types/node       | 22.19.1  | 22.19.1  | 24.10.1 | Major       |
| electron          | 39.2.3   | 39.2.4   | 39.2.4  | Patch ⚠️    |
| esbuild           | 0.25.12  | 0.25.12  | 0.27.0  | Minor       |
| prettier          | 3.6.2    | 3.7.1    | 3.7.1   | Minor ⚠️    |
| primeng           | 17.18.15 | 17.18.15 | 20.3.0  | Major       |
| svelte            | 5.44.0   | 5.45.2   | 5.45.2  | Patch ⚠️    |
| tailwindcss       | 3.4.18   | 3.4.18   | 4.1.17  | Major       |

Total Outdated: 8 packages (3 patch/minor available, 3 major upgrades available)

Status: ℹ️ INFO - Several packages have updates available (3 patch/minor should be updated soon)

---

9. SBOM (Software Bill of Materials) - sbom.json

| Metric              | Value          |
| ------------------- | -------------- |
| Total Components    | ~1,394KB       |
| Format              | CycloneDX JSON |
| Spec Version        | 1.4            |
| Package Manager     | npm            |
| Direct Dependencies | 87             |

Status: ✅ GENERATED - Complete software inventory available for compliance

---

📊 Overall Security Summary

| Category                             | Status               | Critical Issues  |
| ------------------------------------ | -------------------- | ---------------- |
| Dependency Vulnerabilities (NPM)     | ✅ Clean             | 0                |
| Dependency Vulnerabilities (Snyk)    | ⚠️ Issues            | 2 high, 4 medium |
| Retired Libraries                    | ✅ Clean             | 0                |
| Code Quality (ESLint)                | ⚠️ Issues            | ~809 violations  |
| Static Analysis (Semgrep)            | ⚠️ Findings          | 20 warnings      |
| Container/FS Vulnerabilities (Trivy) | ✅ Clean             | 0                |
| Outdated Packages                    | ℹ️ Updates Available | 8 packages       |

🎯 Priority Actions:

1. HIGH: Review Snyk findings - 2 high severity issues (likely in dev dependencies)
2. MEDIUM: Address Semgrep path traversal warnings (add sanitization or suppress with justification)
3. MEDIUM: Fix ESLint code quality issues (~809 violations, mostly type safety & duplicates)
4. LOW: Update 3 packages with available patches (electron, prettier, svelte)
5. INFO: Review outdated major version upgrades (@types/node, primeng, tailwindcss)
