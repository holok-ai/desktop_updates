/**
 * Extended ESLint Configuration with Custom Holokai Rules
 * Use this configuration to include project-specific rules
 */

const baseConfig = require('./.eslintrc.json');

module.exports = {
  ...baseConfig,
  plugins: [
    ...baseConfig.plugins,
    './eslint-plugin-holokai'  // Local plugin
  ],
  rules: {
    ...baseConfig.rules,
    
    // Holokai Custom Rules
    'holokai/ipc-channel-naming': 'error',
    'holokai/service-file-location': 'warn',
    'holokai/event-handler-naming': 'error',
    'holokai/no-sensitive-in-errors': 'error',
    'holokai/ipc-error-handling': 'error',
    'holokai/no-direct-api-calls': 'error',
    'holokai/use-electron-log': 'error',
    'holokai/store-file-naming': 'warn',
    
    // Additional Project-Specific Overrides
    // Adjust severity of certain rules based on project phase
    '@typescript-eslint/no-unused-vars': process.env.NODE_ENV === 'production' ? 'error' : 'warn',
    'no-console': process.env.NODE_ENV === 'production' ? 'error' : 'warn',
    
    // Svelte-specific adjustments for Holokai
    'svelte/no-at-html-tags': 'error',
    'svelte/valid-compile': 'error',
    'svelte/no-dom-manipulating': 'warn',
    
    // Electron-specific security rules
    'security/detect-non-literal-fs-filename': 'error',
    'security/detect-non-literal-require': 'error',
    'security/detect-eval-with-expression': 'error',
    
    // Enforce async/await over raw promises in IPC handlers
    '@typescript-eslint/no-floating-promises': ['error', {
      ignoreVoid: false,
      ignoreIIFE: false
    }],
  },
  overrides: [
    {
      // Relax rules for test files
      files: ['**/*.spec.ts', '**/*.test.ts', '**/tests/**/*.ts'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        'holokai/no-sensitive-in-errors': 'off',
        'no-console': 'off'
      }
    },
    {
      // Electron main process specific rules
      files: ['src-electron/**/*.ts'],
      env: {
        node: true,
        browser: false
      },
      rules: {
        'no-process-env': 'off',
        'security/detect-non-literal-fs-filename': 'warn'
      }
    },
    {
      // Renderer process specific rules
      files: ['src/**/*.ts', 'src/**/*.svelte'],
      env: {
        node: false,
        browser: true
      },
      rules: {
        'no-process-env': 'error',
        'security/detect-non-literal-fs-filename': 'error'
      }
    },
    {
      // Configuration files
      files: ['*.config.ts', '*.config.js'],
      rules: {
        '@typescript-eslint/no-var-requires': 'off',
        '@typescript-eslint/no-require-imports': 'off'
      }
    }
  ]
};
