import js from '@eslint/js';
import typescript from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import security from 'eslint-plugin-security';
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
      'build/**',
      '.svelte-kit/**',
      'coverage/**',
      '.nyc_output/**',
      '*.config.js',
      '*.config.ts',
      'vite.config.ts.timestamp-*',
      '.cache/**',
      'logs/**',
      '.eslintrc.*.js',
      'eslint-plugin-holokai/**',
      'scripts/**',
      'analyze-eslint.cjs',
      'playwright-report/**',
      'test-results/**',
    ],
  },

  // Base ESLint recommended rules
  js.configs.recommended,

  // TypeScript files (renderer process)
  {
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2022,
      },
    },
    plugins: {
      '@typescript-eslint': typescript,
      security,
    },
    rules: {
      ...typescript.configs['recommended'].rules,
      ...typescript.configs['recommended-requiring-type-checking'].rules,
      ...typescript.configs['strict'].rules,
      ...security.configs.recommended.rules,

      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/explicit-function-return-type': [
        'error',
        {
          allowExpressions: true,
          allowTypedFunctionExpressions: true,
          allowHigherOrderFunctions: true,
        },
      ],
      '@typescript-eslint/strict-boolean-expressions': [
        'error',
        {
          allowString: false,
          allowNumber: false,
          allowNullableObject: false,
        },
      ],
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/naming-convention': [
        'error',
        {
          selector: 'variable',
          format: ['camelCase'],
          leadingUnderscore: 'allow',
        },
        {
          selector: 'variable',
          modifiers: ['const'],
          format: ['camelCase', 'UPPER_CASE'],
          leadingUnderscore: 'allow',
        },
        {
          selector: 'variable',
          types: ['boolean'],
          format: ['camelCase'],
          prefix: ['is', 'has', 'should', 'can', 'did', 'will', 'was', 'were'],
        },
        {
          selector: 'class',
          format: ['PascalCase'],
        },
        {
          selector: 'interface',
          format: ['PascalCase'],
        },
        {
          selector: 'typeAlias',
          format: ['PascalCase'],
        },
        {
          selector: 'enum',
          format: ['PascalCase'],
        },
        {
          selector: 'typeParameter',
          format: ['PascalCase'],
        },
        {
          selector: 'function',
          format: ['camelCase'],
        },
        {
          selector: 'method',
          format: ['camelCase'],
        },
        {
          selector: 'parameter',
          format: ['camelCase'],
          leadingUnderscore: 'allow',
        },
        {
          selector: 'property',
          format: ['camelCase', 'UPPER_CASE', 'PascalCase'],
          leadingUnderscore: 'allow',
        },
      ],
      '@typescript-eslint/only-throw-error': 'error',
      'security/detect-non-literal-fs-filename': 'warn',
      'security/detect-object-injection': 'warn',
      'security/detect-possible-timing-attacks': 'error',
      'security/detect-unsafe-regex': 'error',
      'no-console': [
        'error',
        {
          allow: ['warn', 'error'],
        },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-empty-function': [
        'error',
        {
          allow: ['arrowFunctions', 'constructors'],
        },
      ],
      '@typescript-eslint/prefer-nullish-coalescing': 'error',
      '@typescript-eslint/prefer-optional-chain': 'error',
      '@typescript-eslint/prefer-as-const': 'error',
      eqeqeq: ['error', 'always'],
      'no-var': 'error',
      'prefer-const': 'error',
      'prefer-template': 'error',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      'require-await': 'off',
      '@typescript-eslint/require-await': 'error',
      'no-return-await': 'off',
      '@typescript-eslint/return-await': ['error', 'in-try-catch'],
      'spaced-comment': [
        'error',
        'always',
        {
          line: {
            markers: ['/'],
            exceptions: ['-', '+'],
          },
          block: {
            markers: ['!'],
            exceptions: ['*'],
            balanced: true,
          },
        },
      ],
      'no-alert': 'error',
      'no-debugger': 'error',
      'no-duplicate-imports': 'error',
      'no-nested-ternary': 'warn',
      'prefer-arrow-callback': 'error',
      'arrow-body-style': ['error', 'as-needed'],
      curly: ['error', 'all'],
      'dot-notation': 'error',
      'no-lonely-if': 'error',
      'no-unneeded-ternary': 'error',
      'operator-assignment': ['error', 'always'],
      'prefer-destructuring': [
        'error',
        {
          array: true,
          object: true,
        },
      ],
      '@typescript-eslint/unified-signatures': 'off',
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
      globals: {
        ...globals.browser,
        // Add Svelte 5 runes as globals
        $props: 'readonly',
        $state: 'readonly',
        $derived: 'readonly',
        $effect: 'readonly',
        $bindable: 'readonly',
        $inspect: 'readonly',
      },
    },
    plugins: {
      svelte,
      '@typescript-eslint': typescript,
    },
    rules: {
      ...svelte.configs.recommended.rules,
      'no-unused-vars': 'off',
      // Allow {@html} when content is sanitized with DOMPurify (e.g., MarkdownRenderer)
      'svelte/no-at-html-tags': 'warn',
      'svelte/valid-compile': 'error',
      'svelte/no-dom-manipulating': 'warn',
      'svelte/no-unused-props': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },

  // MarkdownRenderer - {@html} is safe here due to DOMPurify sanitization
  {
    files: ['**/MarkdownRenderer.svelte'],
    rules: {
      'svelte/no-at-html-tags': 'off',
    },
  },

  // Test files - relaxed rules
  {
    files: ['**/*.spec.ts', '**/*.test.ts', '**/tests/**/*.ts'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      '@typescript-eslint': typescript,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'no-console': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
    },
  },

  // Electron main process
  {
    files: ['src-electron/**/*.ts'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: './tsconfig.electron.json',
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        ...globals.node,
        ...globals.es2022,
      },
    },
    plugins: {
      '@typescript-eslint': typescript,
      security,
    },
    rules: {
      ...typescript.configs['recommended'].rules,
      ...typescript.configs['recommended-requiring-type-checking'].rules,
      ...typescript.configs['strict'].rules,
      ...security.configs.recommended.rules,
      'security/detect-non-literal-fs-filename': 'warn',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/explicit-function-return-type': [
        'error',
        {
          allowExpressions: true,
          allowTypedFunctionExpressions: true,
          allowHigherOrderFunctions: true,
        },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/unified-signatures': 'off',
    },
  },

  // Shared code (used by both main and renderer)
  {
    files: ['src-shared/**/*.ts'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        ...globals.es2022,
      },
    },
    plugins: {
      '@typescript-eslint': typescript,
    },
    rules: {
      ...typescript.configs['recommended'].rules,
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },

  // Renderer process
  {
    files: ['src/**/*.ts', 'src/**/*.svelte'],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
    plugins: {
      security,
    },
    rules: {
      'security/detect-non-literal-fs-filename': 'error',
    },
  },
];
