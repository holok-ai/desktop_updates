Separate the security scanning from the build pipeline entirely. Security tools should run in CI/CD, not be included in the local development dependencies.

Path Forward: Security Scanning Architecture
Current Problem
Six dev dependencies introduce js-yaml, but three are security scanners that shouldn't be in package.json:

@doyensec/electronegativity (Electron security scanner)
lockfile-lint (lockfile validator)
@cyclonedx/cyclonedx-npm (SBOM generator)
Root Issue: Security scanning tools are treated as dev dependencies when they should be CI/CD tools.

Recommended Architecture: Separate Security Project
Create tools/security/ as an isolated scanning environment:

desktop/
├── package.json # Clean: build + essential dev tools only
├── .github/workflows/
│ └── security-scan.yml # Automated security checks
└── tools/
└── security/
├── package.json # All security scanners isolated here
├── scan.sh # Orchestrates all security checks
└── README.md # Security scanning documentation
Benefits:

Zero dependency pollution in main project
Security tools versioned independently
Can be updated without affecting build
Run on-demand or in CI only

Additions To Security Pipeline

Add semgrep code scanning
Add npm audit
Add trivy for file scanning and SBOM review (e.g. trivy sbom /path/to/sbom_file) from cyclonedx
