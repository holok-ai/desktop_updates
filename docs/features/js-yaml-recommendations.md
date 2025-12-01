# js-yaml Security Issue: Strategic Recommendations

## Summary Recommendation

**Immediate Action:** Use npm overrides to force js-yaml@^4.1.1 across all dependencies. This patches the vulnerability today with zero risk.

**Strategic Direction:** Separate security scanning from the build pipeline entirely. Security tools should run in CI/CD, not pollute local development dependencies.

---

## Path Forward: Security Scanning Architecture

### Current Problem

Six dev dependencies introduce js-yaml, but three are security scanners that shouldn't be in package.json:

- `@doyensec/electronegativity` (Electron security scanner)
- `lockfile-lint` (lockfile validator)
- `@cyclonedx/cyclonedx-npm` (SBOM generator)

**Root Issue:** Security scanning tools are treated as dev dependencies when they should be CI/CD tools.

---

### Recommended Architecture: Separate Security Project

Create `tools/security/` as an isolated scanning environment:

```
desktop/
├── package.json                    # Clean: build + essential dev tools only
├── .github/workflows/
│   └── security-scan.yml          # Automated security checks
└── tools/
    └── security/
        ├── package.json            # All security scanners isolated here
        ├── scan.sh                 # Orchestrates all security checks
        └── README.md               # Security scanning documentation
```

**Benefits:**

- Zero dependency pollution in main project
- Security tools versioned independently
- Can be updated without affecting build
- Run on-demand or in CI only

---

## Better Security Tools Recommendation

### Replace Current Tools

**Remove from package.json:**

1. `@doyensec/electronegativity` → Use **Snyk Code** or **Semgrep** (better Electron rules)
2. `lockfile-lint` → Use **npm audit** (built-in) + **Dependabot**
3. `@cyclonedx/cyclonedx-npm` → Use **Trivy** or **Syft** (faster, no Node deps)

**Keep (essential for dev):**

- `electron-builder` (with npm override for js-yaml)
- `eslint` (with npm override for js-yaml)
- `secretlint` (lightweight, valuable pre-commit hook)

### Add Modern Security Tools (CI/CD Only)

**Recommended Stack:**

1. **Snyk CLI** (Primary)
   - Excellent Electron/npm support
   - Automatic fix PRs
   - Free for open source
   - Run: `npx snyk test` in GitHub Actions

2. **Trivy** (Scanning)
   - Fast dependency scanning
   - SBOM generation
   - No Node dependencies
   - Run: Docker container in CI

3. **GitHub Dependabot** (Automation)
   - Native GitHub integration
   - Automatic security updates
   - Zero configuration needed
   - Enable in repository settings

4. **Semgrep** (SAST)
   - Modern alternative to electronegativity
   - Better rule coverage
   - Free tier available
   - Run: `semgrep scan` in CI

5. **npm audit** (Built-in)
   - No installation required
   - Pre-commit hook via husky
   - Fast feedback loop

---

## Implementation: Two Approaches

### Approach A: Full CI/CD Migration (Recommended)

1. Enable GitHub Dependabot
2. Add `.github/workflows/security-scan.yml` with Snyk + Trivy
3. Remove electronegativity, lockfile-lint, cyclonedx from package.json
4. Add npm override for js-yaml
5. Document security process in CONTRIBUTING.md

**Result:** Clean local environment, automated security scanning.

---

### Approach B: Isolated Security Project (If Local Scanning Required)

1. Create `tools/security/package.json` with all security tools
2. Add `npm run security:scan` script that runs tools/security checks
3. Remove security tools from main package.json
4. Add npm override for js-yaml in main package.json
5. Optionally run `tools/security` in CI as well

**Result:** Security tools available locally but isolated from build.

---

## Bottom Line

**The Real Issue:** Security scanning tools introducing vulnerable dependencies is a design smell. Security tools should be isolated from the build process.

**Best Practice:** Use modern SaaS/native tools (Snyk, Dependabot, Trivy) in CI/CD rather than npm packages with heavy dependency trees.

**Immediate Fix:** npm overrides for js-yaml@^4.1.1

**Long-term Solution:** Separate security scanning project or full CI/CD migration
