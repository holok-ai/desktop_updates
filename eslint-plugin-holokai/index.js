/**
 * Custom ESLint Rules for Holokai Desktop
 * These rules enforce project-specific patterns from coding-instructions.md
 */

module.exports = {
  rules: {
    // Rule: IPC channel names must use colon notation (e.g., 'auth:login')
    'ipc-channel-naming': {
      meta: {
        type: 'problem',
        docs: {
          description: 'Enforce colon notation for IPC channel names',
          category: 'Best Practices',
        },
        schema: [],
        messages: {
          invalidChannelName:
            'IPC channel name "{{name}}" must use colon notation (e.g., "auth:login")',
        },
      },
      create(context) {
        return {
          CallExpression(node) {
            if (
              node.callee.type === 'MemberExpression' &&
              node.callee.property.name === 'handle' &&
              node.callee.object.name === 'ipcMain'
            ) {
              const firstArg = node.arguments[0];
              if (firstArg && firstArg.type === 'Literal' && typeof firstArg.value === 'string') {
                const channelName = firstArg.value;
                if (!channelName.includes(':')) {
                  context.report({
                    node: firstArg,
                    messageId: 'invalidChannelName',
                    data: { name: channelName },
                  });
                }
              }
            }
          },
        };
      },
    },

    // Rule: Service classes must be in src-electron/services/
    'service-file-location': {
      meta: {
        type: 'suggestion',
        docs: {
          description: 'Ensure service classes are in the correct directory',
          category: 'Best Practices',
        },
        schema: [],
        messages: {
          wrongLocation: 'Service class "{{name}}" should be in src-electron/services/ directory',
        },
      },
      create(context) {
        return {
          ClassDeclaration(node) {
            if (node.id && node.id.name.endsWith('Service')) {
              const filename = context.getFilename();
              if (
                !filename.includes('src-electron/services/') &&
                !filename.includes('src-electron\\services\\')
              ) {
                context.report({
                  node: node.id,
                  messageId: 'wrongLocation',
                  data: { name: node.id.name },
                });
              }
            }
          },
        };
      },
    },

    // Rule: Event handler classes must follow naming pattern
    'event-handler-naming': {
      meta: {
        type: 'suggestion',
        docs: {
          description: 'Enforce naming pattern for event handler classes',
          category: 'Best Practices',
        },
        schema: [],
        messages: {
          invalidName: 'Event handler class should be named with pattern "[Group]EventHandler"',
        },
      },
      create(context) {
        return {
          ClassDeclaration(node) {
            const filename = context.getFilename();
            if (filename.includes('eventHandlers/') || filename.includes('eventHandlers\\')) {
              if (node.id && !node.id.name.endsWith('EventHandler')) {
                context.report({
                  node: node.id,
                  messageId: 'invalidName',
                });
              }
            }
          },
        };
      },
    },

    // Rule: No sensitive data in error messages
    'no-sensitive-in-errors': {
      meta: {
        type: 'problem',
        docs: {
          description: 'Prevent sensitive data in error messages',
          category: 'Security',
        },
        schema: [],
        messages: {
          sensitiveData: 'Avoid including potentially sensitive data in error messages',
        },
      },
      create(context) {
        const sensitivePatterns = [
          'password',
          'token',
          'secret',
          'key',
          'apiKey',
          'authorization',
          'bearer',
          'credential',
          'auth',
        ];

        return {
          ThrowStatement(node) {
            if (node.argument && node.argument.type === 'NewExpression') {
              const args = node.argument.arguments;
              if (args.length > 0 && args[0].type === 'TemplateLiteral') {
                const expressions = args[0].expressions;
                expressions.forEach((expr) => {
                  if (expr.type === 'Identifier') {
                    const varName = expr.name.toLowerCase();
                    if (sensitivePatterns.some((pattern) => varName.includes(pattern))) {
                      context.report({
                        node: expr,
                        messageId: 'sensitiveData',
                      });
                    }
                  }
                });
              }
            }
          },
        };
      },
    },

    // Rule: Require try-catch for IPC calls
    'ipc-error-handling': {
      meta: {
        type: 'problem',
        docs: {
          description: 'Require try-catch blocks for IPC calls',
          category: 'Error Handling',
        },
        schema: [],
        messages: {
          missingTryCatch: 'IPC call to "{{method}}" must be wrapped in try-catch block',
        },
      },
      create(context) {
        return {
          CallExpression(node) {
            if (
              node.callee.type === 'MemberExpression' &&
              node.callee.object.type === 'MemberExpression' &&
              node.callee.object.object.name === 'window' &&
              node.callee.object.property.name === 'electron'
            ) {
              let parent = node.parent;
              let inTryCatch = false;

              while (parent) {
                if (parent.type === 'TryStatement') {
                  inTryCatch = true;
                  break;
                }
                parent = parent.parent;
              }

              if (!inTryCatch) {
                context.report({
                  node,
                  messageId: 'missingTryCatch',
                  data: { method: node.callee.property.name },
                });
              }
            }
          },
        };
      },
    },

    // Rule: No direct API calls from UI components
    'no-direct-api-calls': {
      meta: {
        type: 'problem',
        docs: {
          description: 'Prevent direct API calls from UI components',
          category: 'Architecture',
        },
        schema: [],
        messages: {
          directApiCall:
            'UI components should not make direct API calls. Use service classes instead.',
        },
      },
      create(context) {
        return {
          CallExpression(node) {
            const filename = context.getFilename();
            const isUIComponent =
              filename.includes('/ui/') ||
              filename.includes('\\ui\\') ||
              filename.endsWith('.svelte');

            if (isUIComponent) {
              // Check for fetch or axios calls
              if (
                node.callee.name === 'fetch' ||
                (node.callee.type === 'MemberExpression' && node.callee.object.name === 'axios')
              ) {
                context.report({
                  node,
                  messageId: 'directApiCall',
                });
              }
            }
          },
        };
      },
    },

    // Rule: Require electron-log for logging
    'use-electron-log': {
      meta: {
        type: 'problem',
        docs: {
          description: 'Use electron-log instead of console for logging',
          category: 'Best Practices',
        },
        fixable: 'code',
        schema: [],
        messages: {
          useElectronLog: 'Use electron-log instead of console.{{method}}',
        },
      },
      create(context) {
        return {
          MemberExpression(node) {
            if (
              node.object.name === 'console' &&
              ['log', 'debug', 'info', 'warn', 'error'].includes(node.property.name)
            ) {
              context.report({
                node,
                messageId: 'useElectronLog',
                data: { method: node.property.name },
                fix(fixer) {
                  const method = node.property.name === 'log' ? 'info' : node.property.name;
                  return fixer.replaceText(node, `log.${method}`);
                },
              });
            }
          },
        };
      },
    },

    // Rule: Require proper store naming
    'store-file-naming': {
      meta: {
        type: 'suggestion',
        docs: {
          description: 'Enforce store file naming convention',
          category: 'Naming',
        },
        schema: [],
        messages: {
          invalidStoreName: 'Store file should be named by domain: {{expected}}',
        },
      },
      create(context) {
        return {
          Program(node) {
            const filename = context.getFilename();
            if (filename.includes('/stores/') || filename.includes('\\stores\\')) {
              const basename = filename.split(/[/\\]/).pop();
              if (!basename.endsWith('.store.ts') && !basename.endsWith('.store.js')) {
                context.report({
                  node,
                  messageId: 'invalidStoreName',
                  data: { expected: 'domain.store.ts (e.g., auth.store.ts)' },
                });
              }
            }
          },
        };
      },
    },
  },
};
