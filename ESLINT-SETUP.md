# ESLint Setup for Holokai Desktop

This directory now contains a complete ESLint configuration that enforces the coding standards from `coding-instructions.md`.

## ✅ Files Created

The following configuration files have been set up:

1. **`.eslintrc.json`** - Main ESLint configuration with TypeScript and Svelte support
2. **`.prettierrc.json`** - Prettier configuration for consistent formatting  
3. **`.eslintignore`** - Files and directories to exclude from linting
4. **`.eslintrc.extended.js`** - Extended configuration with custom Holokai rules
5. **`eslint-plugin-holokai/`** - Custom ESLint plugin for project-specific rules
   - `index.js` - Plugin implementation
   - `package.json` - Plugin package configuration

## 🚀 Quick Start

### 1. Install Missing Dependencies

Most dependencies are already in your package.json, but you may need to add:

```bash
npm install --save-dev eslint-plugin-no-secrets
```

### 2. Run ESLint

Your package.json already has the lint scripts configured:

```bash
# Check for linting issues
npm run lint

# Auto-fix issues
npm run lint:fix

# Format code with Prettier
npm run format

# Type check
npm run type-check
```

### 3. VS Code Integration

For the best development experience, install these VS Code extensions:
- ESLint (`dbaeumer.vscode-eslint`)
- Prettier (`esbenp.prettier-vscode`)
- Svelte for VS Code (`svelte.svelte-vscode`)

## 📋 What's Being Enforced

### Naming Conventions ✅
- `camelCase` for variables and functions
- `PascalCase` for classes and types
- `SCREAMING_SNAKE_CASE` for constants
- Boolean prefixes: `is`, `has`, `should`

### IPC Patterns ✅
- Colon notation for channels: `auth:login`
- Event handlers: `[Group]EventHandler`
- Try-catch blocks for all IPC calls

### Security ✅
- No sensitive data in logs or errors
- No direct API calls from UI components
- Secure token storage enforcement

### Code Quality ✅
- No `any` types in TypeScript
- Mandatory `electron-log` instead of `console`
- Proper async/await handling
- Service classes in correct directories

## 🔧 Using Custom Rules

To enable the custom Holokai rules, you can either:

### Option 1: Use Extended Configuration (Recommended)
Edit your package.json to use the extended configuration:

```json
{
  "eslintConfig": {
    "extends": "./.eslintrc.extended.js"
  }
}
```

### Option 2: Add Custom Rules to Base Config
Add the plugin to your `.eslintrc.json`:

```json
{
  "plugins": [
    "@typescript-eslint",
    "security",
    "no-secrets",
    "./eslint-plugin-holokai"
  ],
  "rules": {
    // ... existing rules ...
    "holokai/ipc-channel-naming": "error",
    "holokai/use-electron-log": "error",
    // ... other custom rules
  }
}
```

## 🐛 Troubleshooting

### ESLint not finding the local plugin
Make sure the plugin path is correct:
```json
"plugins": ["./eslint-plugin-holokai"]
```

### Svelte files not being linted
Ensure your VS Code settings include Svelte validation:
```json
{
  "eslint.validate": ["javascript", "typescript", "svelte"]
}
```

### Too many errors initially
Start with warnings and gradually increase severity:
```bash
# Run with max warnings to see all issues
npm run lint -- --max-warnings 1000
```

## 📚 Next Steps

1. Run `npm run lint` to see current issues
2. Fix auto-fixable issues with `npm run lint:fix`
3. Address remaining issues manually
4. Consider adding pre-commit hooks with husky
5. Add ESLint checks to your CI/CD pipeline

## 🤝 Contributing

When adding new patterns to `coding-instructions.md`, remember to:
1. Update the ESLint rules accordingly
2. Add corresponding custom rules if needed
3. Document the changes in this README
