/**
 * ESLint Security Configuration for Holokai Desktop (Flat Config)
 *
 * This configuration focuses on security vulnerabilities and best practices
 * for Electron applications with Svelte and TypeScript.
 *
 * Configured for ESLint 9+ flat config system
 */

import js from '@eslint/js';
import typescript from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import security from 'eslint-plugin-security';
import noUnsanitized from 'eslint-plugin-no-unsanitized';
import noSecrets from 'eslint-plugin-no-secrets';
import sonarjs from 'eslint-plugin-sonarjs';
import svelte from 'eslint-plugin-svelte';
import svelteParser from 'svelte-eslint-parser';
import globals from 'globals';

export default [
  // Global ignores
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'dist-electron/**',
      'release/**',
      'security-reports/**',
      '*.config.js',
      '*.config.ts',
      'vite.config.ts',
      'scripts/security-scan.js',
      'eslint.*',
      'eslintrc.*',
      '**/*.d.ts',
    ],
  },

  // Base ESLint recommended rules
  js.configs.recommended,

  // Base configuration for all files
  {
    files: ['**/*.js', '**/*.ts', '**/*.svelte'],
    plugins: {
      security,
      'no-unsanitized': noUnsanitized,
      'no-secrets': noSecrets,
      sonarjs,
    },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2022,
        electronAPI: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
      },
    },
    rules: {
      // Security Plugin Rules
      ...security.configs.recommended.rules,
      'security/detect-unsafe-regex': 'error',
      'security/detect-buffer-noassert': 'error',
      'security/detect-child-process': 'error',
      'security/detect-disable-mustache-escape': 'error',
      'security/detect-eval-with-expression': 'error',
      'security/detect-no-csrf-before-method-override': 'error',
      'security/detect-non-literal-fs-filename': 'warn',
      'security/detect-non-literal-regexp': 'warn',
      'security/detect-non-literal-require': 'warn',
      'security/detect-object-injection': 'warn',
      'security/detect-possible-timing-attacks': 'error',
      'security/detect-pseudoRandomBytes': 'error',
      'security/detect-new-buffer': 'error',

      // No-Secrets Plugin Rules
      'no-secrets/no-secrets': [
        'error',
        {
          ignoreContent: ['^holokai://', '^https?://', 'sha256-', 'sha384-', 'sha512-'],
        },
      ],

      // SonarJS Plugin Rules (Code Quality & Security)
      ...sonarjs.configs.recommended.rules,
      'sonarjs/cognitive-complexity': ['error', 15],
      'sonarjs/max-switch-cases': ['error', 10],
      'sonarjs/no-duplicate-string': ['error', { threshold: 3 }],

      // DOM Security - No-Unsanitized Plugin
      'no-unsanitized/method': [
        'error',
        {
          escape: {
            methods: ['escapeHTML'],
          },
        },
      ],
      'no-unsanitized/property': [
        'error',
        {
          escape: {
            methods: ['escapeHTML'],
          },
        },
      ],

      // Electron-Specific Security Rules
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-script-url': 'error',
      'no-global-assign': 'error',
      'no-shadow-restricted-names': 'error',
      strict: ['error', 'global'],

      // Prevent prototype pollution
      'no-proto': 'error',
      'no-extend-native': 'error',

      // Require secure random number generation
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message: 'Use crypto.randomBytes() or crypto.randomInt() for secure random numbers',
        },
        {
          object: 'crypto',
          property: 'pseudoRandomBytes',
          message: 'Use crypto.randomBytes() instead',
        },
        {
          object: 'document',
          property: 'write',
          message: 'Avoid document.write for security reasons',
        },
        {
          property: 'innerHTML',
          message: 'Use textContent or safe DOM manipulation methods instead of innerHTML',
        },
        {
          property: 'outerHTML',
          message: 'Use safe DOM manipulation methods instead of outerHTML',
        },
      ],

      // Restrict dangerous modules
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['child_process'],
              message: 'Avoid using child_process in renderer process',
            },
            {
              group: ['electron'],
              message: 'Import specific modules from electron, not the entire package',
            },
          ],
        },
      ],

      // Require proper error handling
      'handle-callback-err': 'error',
      'no-throw-literal': 'error',

      // Prevent information leakage
      'no-console': [
        'warn',
        {
          allow: ['warn', 'error'],
        },
      ],
      'no-debugger': 'error',

      // Ensure proper async/await usage
      'require-await': 'error',
      'no-async-promise-executor': 'error',
      'no-await-in-loop': 'warn',
      'no-promise-executor-return': 'error',

      // Prevent resource leaks
      'no-unreachable': 'error',
      'no-unreachable-loop': 'error',
      'no-unused-expressions': 'error',

      // Enforce secure coding patterns
      'no-labels': 'error',
      'no-lone-blocks': 'error',
      'no-return-await': 'error',
      'no-sequences': 'error',
      'no-unused-private-class-members': 'error',
      'no-useless-call': 'error',
      'no-useless-concat': 'error',
      'no-void': 'error',
      'no-with': 'error',
      'prefer-promise-reject-errors': 'error',
      radix: 'error',
      'require-atomic-updates': 'error',

      // Additional XSS Prevention
      'no-restricted-syntax': [
        'error',
        {
          selector: 'CallExpression[callee.property.name="insertAdjacentHTML"]',
          message: 'insertAdjacentHTML can lead to XSS vulnerabilities',
        },
        {
          selector: 'MemberExpression[property.name="cookie"]',
          message: 'Direct cookie access can be insecure, use a secure cookie library',
        },
      ],
    },
  },

  // TypeScript files configuration
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: ['./tsconfig.json', './tsconfig.electron.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      '@typescript-eslint': typescript,
    },
    rules: {
      // TypeScript-Specific Security Rules
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'warn',
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-call': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unsafe-return': 'warn',
    },
  },

  // Electron main process specific overrides
  {
    files: ['src-electron/**/*.ts', 'src-electron/**/*.js'],
    rules: {
      'security/detect-child-process': 'warn', // May be needed in main process
      'security/detect-non-literal-fs-filename': 'warn', // Common in main process
      'no-console': 'off', // Logging is important in main process
    },
  },

  // Svelte files
  {
    files: ['**/*.svelte'],
    languageOptions: {
      parser: svelteParser,
      parserOptions: {
        parser: typescriptParser,
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    plugins: {
      svelte,
    },
    rules: {
      ...svelte.configs.recommended.rules,
      // Svelte-specific security considerations
      'no-restricted-properties': 'off', // Svelte handles innerHTML safely with {@html}
    },
  },
];
