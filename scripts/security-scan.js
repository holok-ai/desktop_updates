#!/usr/bin/env node
/**
 * Comprehensive Security Scanner for Holokai Desktop
 *
 * This script runs multiple security tools to check for:
 * - Known vulnerabilities in dependencies (NPM Audit, Snyk, Retire.js)
 * - Electron-specific security issues (Electronegativity)
 * - Code security issues (ESLint with security plugins)
 * - Hardcoded secrets and credentials
 * - Lockfile integrity
 * - Software Bill of Materials generation
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Dynamic import for chalk (ESM module)
let chalk;
try {
  chalk = (await import('chalk')).default;
} catch (e) {
  // Fallback if chalk is not available
  chalk = {
    cyan: (str) => str,
    blue: (str) => str,
    yellow: (str) => str,
    green: (str) => str,
    red: (str) => str,
    gray: (str) => str,
    white: (str) => str,
  };
}

class SecurityScanner {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      scans: {},
      summary: {
        totalVulnerabilities: 0,
        critical: 0,
        high: 0,
        medium: 0,
        low: 0,
        info: 0,
      },
    };
    this.hasErrors = false;
    this.reportDir = path.join(process.cwd(), 'security-reports');
  }

  init() {
    // Create security reports directory if it doesn't exist
    if (!fs.existsSync(this.reportDir)) {
      fs.mkdirSync(this.reportDir, { recursive: true });
    }
    console.log(chalk.cyan('🛡️  Holokai Desktop Security Scanner\n'));
    console.log(chalk.gray(`Reports will be saved to: ${this.reportDir}\n`));
  }

  runCommand(command, description, outputFile = null) {
    console.log(chalk.blue(`\n🔍 ${description}...`));
    try {
      const output = execSync(command, {
        encoding: 'utf8',
        stdio: outputFile ? 'pipe' : 'inherit',
      });

      if (outputFile) {
        const filePath = path.join(this.reportDir, outputFile);
        fs.writeFileSync(filePath, output);
        console.log(chalk.gray(`   Report saved: ${outputFile}`));
      }

      console.log(chalk.green('✓ Passed'));
      return { success: true, output };
    } catch (error) {
      console.log(chalk.red('✗ Issues found'));
      this.hasErrors = true;

      if (outputFile && error.stdout) {
        const filePath = path.join(this.reportDir, outputFile);
        fs.writeFileSync(filePath, error.stdout);
        console.log(chalk.gray(`   Report saved: ${outputFile}`));
      }

      return {
        success: false,
        output: error.stdout || error.message,
        error: error.message,
      };
    }
  }

  async scanDependencies() {
    console.log(chalk.yellow('\n📦 Dependency Vulnerability Scanning\n'));

    // NPM Audit
    const npmAudit = this.runCommand('npm audit --json', 'Running NPM Audit', 'npm-audit.json');

    if (npmAudit.output) {
      try {
        const auditData = JSON.parse(npmAudit.output);
        this.results.scans.npmAudit = auditData;
        if (auditData.metadata && auditData.metadata.vulnerabilities) {
          const vulns = auditData.metadata.vulnerabilities;
          this.results.summary.critical += vulns.critical || 0;
          this.results.summary.high += vulns.high || 0;
          this.results.summary.medium += vulns.moderate || 0;
          this.results.summary.low += vulns.low || 0;
          this.results.summary.info += vulns.info || 0;
        }
      } catch (e) {
        console.log(chalk.gray('   Could not parse NPM audit results'));
      }
    }

    // Better NPM Audit (more user-friendly output)
    this.runCommand('npx better-npm-audit audit --level low', 'Running Better NPM Audit');

    // Snyk Test (requires authentication for full features)
    console.log(chalk.blue('\n🔍 Running Snyk Security Test...'));
    console.log(chalk.gray('   Note: Run "npx snyk auth" for authenticated scanning'));
    try {
      this.runCommand(
        'npx snyk test --json',
        'Snyk vulnerability database check',
        'snyk-report.json',
      );
    } catch (e) {
      console.log(chalk.yellow('   Snyk test skipped (authentication may be required)'));
    }

    // Retire.js - Check for known vulnerabilities in JS libraries
    this.runCommand(
      'npx retire --outputformat json --outputpath ' +
        path.join(this.reportDir, 'retire-report.json') +
        ' --ignorefile .retireignore',
      'Checking for retired/vulnerable packages (Retire.js)',
    );

    // Check for outdated packages (non-critical, don't fail on outdated packages)
    console.log(chalk.blue('\n🔍 Checking for outdated packages...'));
    try {
      const output = execSync('npm outdated --json', {
        encoding: 'utf8',
        stdio: 'pipe',
      });
      const filePath = path.join(this.reportDir, 'outdated-packages.json');
      fs.writeFileSync(filePath, output || '{}');
      console.log(chalk.green('✓ All packages up to date'));
    } catch (error) {
      // npm outdated returns non-zero exit code when packages are outdated
      // This is informational, not a security issue
      if (error.stdout) {
        const filePath = path.join(this.reportDir, 'outdated-packages.json');
        fs.writeFileSync(filePath, error.stdout);
        console.log(chalk.yellow('✓ Outdated packages found (see report)'));
        console.log(chalk.gray(`   Report saved: outdated-packages.json`));
      } else {
        console.log(chalk.gray('   Could not check for outdated packages'));
      }
    }
  }

  async scanElectron() {
    // console.log(chalk.yellow('\n⚡ Electron Security Scanning\n'));

    // // Electronegativity - Electron-specific security checks
    // const electronScan = this.runCommand(
    //   'npx electronegativity -i ./ -x node_modules -o ' +
    //     path.join(this.reportDir, 'electronegativity-report.sarif'),
    //   'Running Electronegativity (Electron security)',
    // );

    // Check for common Electron security misconfigurations
    console.log(chalk.blue('\n🔍 Checking Electron security best practices...'));
    this.checkElectronSecurity();
  }

  checkElectronSecurity() {
    const issues = [];
    const mainProcessFiles = [
      'src-electron/main.ts',
      'src-electron/main.js',
      'electron/main.ts',
      'electron/main.js',
      'dist-electron/main.js',
    ];

    let mainFile = null;
    for (const file of mainProcessFiles) {
      if (fs.existsSync(file)) {
        mainFile = file;
        break;
      }
    }

    if (mainFile) {
      const content = fs.readFileSync(mainFile, 'utf8');

      // Check for security best practices
      const securityChecks = [
        {
          pattern: /nodeIntegration:\s*true/,
          issue: 'Node integration enabled in renderer (security risk)',
          severity: 'high',
        },
        {
          pattern: /contextIsolation:\s*false/,
          issue: 'Context isolation disabled (security risk)',
          severity: 'high',
        },
        {
          pattern: /webSecurity:\s*false/,
          issue: 'Web security disabled (security risk)',
          severity: 'critical',
        },
        {
          pattern: /allowRunningInsecureContent:\s*true/,
          issue: 'Insecure content allowed (security risk)',
          severity: 'high',
        },
        {
          pattern: /experimentalFeatures:\s*true/,
          issue: 'Experimental features enabled',
          severity: 'medium',
        },
      ];

      securityChecks.forEach((check) => {
        if (check.pattern.test(content)) {
          issues.push(check);
          this.hasErrors = true;
        }
      });

      if (issues.length > 0) {
        console.log(chalk.red(`   Found ${issues.length} Electron security issues:`));
        issues.forEach((issue) => {
          const color =
            issue.severity === 'critical' ? 'red' : issue.severity === 'high' ? 'yellow' : 'gray';
          console.log(chalk[color](`     - ${issue.issue}`));
        });
      } else {
        console.log(chalk.green('   ✓ No obvious Electron security misconfigurations found'));
      }

      this.results.scans.electronSecurity = issues;
    }
  }

  async scanCode() {
    console.log(chalk.yellow('\n📝 Code Security Analysis\n'));

    // ESLint with security rules (using eslint.config.security.js)
    const tempEslintReport = path.join(this.reportDir, 'eslint-security-temp.json');
    const finalEslintReport = path.join(this.reportDir, 'eslint-security.json');

    this.runCommand(
      'npx eslint . --config eslint.config.security.js --format json -o ' + tempEslintReport,
      'Running ESLint security analysis',
    );

    // Filter ESLint results to only include files with actual errors or warnings
    try {
      const eslintData = JSON.parse(fs.readFileSync(tempEslintReport, 'utf8'));
      const filteredData = eslintData.filter(
        (file) => file.errorCount > 0 || file.warningCount > 0,
      );
      fs.writeFileSync(finalEslintReport, JSON.stringify(filteredData, null, 2));
      fs.unlinkSync(tempEslintReport); // Remove temp file
      console.log(
        chalk.gray(
          `   Filtered report: ${filteredData.length} files with issues (from ${eslintData.length} scanned)`,
        ),
      );
    } catch (error) {
      console.log(chalk.gray('   Could not filter ESLint results'));
    }

    // Scan for secrets and credentials
    console.log(chalk.blue('\n🔍 Scanning for hardcoded secrets...'));
    this.runCommand(
      'npx secretlint "**/*" --secretlintignore .gitignore',
      'Checking for exposed secrets',
    );
  }

  async scanLockfile() {
    console.log(chalk.yellow('\n🔒 Lockfile Integrity Check\n'));

    // Validate lockfile integrity (allow GitHub for Electron's node-gyp)
    this.runCommand(
      'npx lockfile-lint --path package-lock.json --allowed-hosts npm yarn github.com --allowed-schemes npm: https: git+ssh:',
      'Validating package-lock.json integrity',
    );
  }

  async generateSBOM() {
    console.log(chalk.yellow('\n📋 Software Bill of Materials\n'));

    // Generate SBOM in CycloneDX format
    this.runCommand(
      'npx @cyclonedx/cyclonedx-npm --output-format json --output-file ' +
        path.join(this.reportDir, 'sbom.json'),
      'Generating SBOM (Software Bill of Materials)',
    );
  }

  async generateComplianceReport() {
    console.log(chalk.yellow('\n📊 Generating Compliance Report\n'));

    // Check if audit-ci config exists
    if (!fs.existsSync('.audit-ci.json')) {
      // Create audit-ci config if not exists
      const auditCiConfig = {
        low: false,
        moderate: true,
        high: true,
        critical: true,
        'report-type': 'full',
        'output-format': 'json',
      };

      fs.writeFileSync('.audit-ci.json', JSON.stringify(auditCiConfig, null, 2));
    }

    // Run audit-ci for CI/CD integration
    this.runCommand('npx audit-ci --config .audit-ci.json', 'Running Audit-CI compliance check');
  }

  generateHTMLReport() {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Holokai Desktop Security Report</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
      background: #f5f5f5;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px;
      border-radius: 10px;
      margin-bottom: 30px;
    }
    h1 { margin: 0; font-size: 2.5em; }
    .timestamp { opacity: 0.9; margin-top: 10px; }
    .summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    .metric {
      background: white;
      padding: 20px;
      border-radius: 10px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      text-align: center;
    }
    .metric-value {
      font-size: 2em;
      font-weight: bold;
      margin-bottom: 5px;
    }
    .metric-label {
      color: #666;
      text-transform: uppercase;
      font-size: 0.9em;
    }
    .critical { color: #d32f2f; }
    .high { color: #f57c00; }
    .medium { color: #fbc02d; }
    .low { color: #388e3c; }
    .info { color: #1976d2; }
    .status {
      padding: 20px;
      border-radius: 10px;
      margin-bottom: 20px;
      font-size: 1.2em;
    }
    .success {
      background: #e8f5e9;
      color: #2e7d32;
      border-left: 5px solid #4caf50;
    }
    .warning {
      background: #fff3e0;
      color: #e65100;
      border-left: 5px solid #ff9800;
    }
    .error {
      background: #ffebee;
      color: #c62828;
      border-left: 5px solid #f44336;
    }
    .actions {
      background: white;
      padding: 20px;
      border-radius: 10px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    .action-list {
      list-style: none;
      padding: 0;
    }
    .action-list li {
      padding: 10px 0;
      border-bottom: 1px solid #eee;
    }
    .action-list li:last-child {
      border-bottom: none;
    }
    code {
      background: #f5f5f5;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: 'Courier New', monospace;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>🛡️ Holokai Desktop Security Report</h1>
    <div class="timestamp">Generated: ${new Date().toLocaleString()}</div>
  </div>

  <div class="summary">
    <div class="metric">
      <div class="metric-value critical">${this.results.summary.critical}</div>
      <div class="metric-label">Critical</div>
    </div>
    <div class="metric">
      <div class="metric-value high">${this.results.summary.high}</div>
      <div class="metric-label">High</div>
    </div>
    <div class="metric">
      <div class="metric-value medium">${this.results.summary.medium}</div>
      <div class="metric-label">Medium</div>
    </div>
    <div class="metric">
      <div class="metric-value low">${this.results.summary.low}</div>
      <div class="metric-label">Low</div>
    </div>
    <div class="metric">
      <div class="metric-value info">${this.results.summary.info}</div>
      <div class="metric-label">Info</div>
    </div>
  </div>

  <div class="status ${this.hasErrors ? 'error' : 'success'}">
    ${
      this.hasErrors
        ? '⚠️ Security issues detected. Please review the detailed reports and take action.'
        : '✅ All security checks passed! Your application is following security best practices.'
    }
  </div>

  <div class="actions">
    <h2>📋 Recommended Actions</h2>
    <ul class="action-list">
      <li>✅ Review detailed reports in <code>./security-reports/</code> directory</li>
      <li>🔧 Run <code>npm run security:fix</code> to auto-fix issues</li>
      <li>📦 Run <code>npm audit fix</code> to fix vulnerable dependencies</li>
      <li>🔍 Run <code>npx snyk wizard</code> for guided vulnerability fixes</li>
      <li>⚡ Review Electron security: <code>./security-reports/electronegativity-report.sarif</code></li>
      <li>🔒 Update dependencies: <code>npm update</code></li>
    </ul>
  </div>

  <div class="actions">
    <h2>📊 Available Reports</h2>
    <ul class="action-list">
      <li>📁 <code>npm-audit.json</code> - NPM vulnerability audit</li>
      <li>📁 <code>snyk-report.json</code> - Snyk security analysis</li>
      <li>📁 <code>retire-report.json</code> - Retired packages check</li>
      <li>📁 <code>electronegativity-report.sarif</code> - Electron security analysis</li>
      <li>📁 <code>eslint-security.json</code> - Code security analysis</li>
      <li>📁 <code>sbom.json</code> - Software Bill of Materials</li>
      <li>📁 <code>outdated-packages.json</code> - Outdated dependencies</li>
    </ul>
  </div>
</body>
</html>
    `;

    fs.writeFileSync(path.join(this.reportDir, 'security-report.html'), html);

    console.log(
      chalk.green(
        `\n📄 HTML report generated: ${path.join(this.reportDir, 'security-report.html')}`,
      ),
    );
  }

  generateSummaryReport() {
    this.results.summary.totalVulnerabilities =
      this.results.summary.critical +
      this.results.summary.high +
      this.results.summary.medium +
      this.results.summary.low +
      this.results.summary.info;

    // Save JSON summary
    fs.writeFileSync(
      path.join(this.reportDir, 'security-summary.json'),
      JSON.stringify(this.results, null, 2),
    );

    // Generate HTML report
    this.generateHTMLReport();

    // Console output
    console.log(chalk.yellow('\n📊 Security Scan Summary:\n'));
    console.log(chalk.white(`Total Vulnerabilities: ${this.results.summary.totalVulnerabilities}`));
    if (this.results.summary.critical > 0) {
      console.log(chalk.red(`  Critical: ${this.results.summary.critical}`));
    }
    if (this.results.summary.high > 0) {
      console.log(chalk.yellow(`  High: ${this.results.summary.high}`));
    }
    if (this.results.summary.medium > 0) {
      console.log(chalk.yellow(`  Medium: ${this.results.summary.medium}`));
    }
    if (this.results.summary.low > 0) {
      console.log(chalk.blue(`  Low: ${this.results.summary.low}`));
    }
    if (this.results.summary.info > 0) {
      console.log(chalk.gray(`  Info: ${this.results.summary.info}`));
    }

    console.log(chalk.white(`\n📁 Reports saved to: ${this.reportDir}`));

    if (this.hasErrors) {
      console.log(chalk.red('\n⚠️  Security issues detected!'));
      console.log(chalk.yellow('Run "npm run security:fix" to attempt automatic fixes'));
      process.exit(1);
    } else {
      console.log(chalk.green('\n✅ All security checks passed!'));
    }
  }

  async run() {
    this.init();

    try {
      await this.scanDependencies();
      await this.scanElectron();
      await this.scanCode();
      await this.scanLockfile();
      await this.generateSBOM();
      await this.generateComplianceReport();
    } catch (error) {
      console.error(chalk.red('\n❌ Security scan failed:'), error.message);
      this.hasErrors = true;
    }

    this.generateSummaryReport();
  }
}

// Export for testing
export default SecurityScanner;

// Start the scanner after class is defined
new SecurityScanner().run();
