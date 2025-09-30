import * as path from 'path';
import * as vscode from 'vscode';
import {
  FileContextResolver,
  LineProcessorRegistry,
  createDefaultLineProcessorRegistry,
  parseFileLineReference,
  FILE_LINE_PATTERN
} from './prompts';
import {
  ProviderConfig,
  ProviderSelection,
  PROVIDER_LABELS,
  getProviderConfig
} from './ai/types';
import {
  buildCustomAIAuthorizationUrl,
  getCustomAIEnvironmentConfig,
  getCustomAIMissingParts,
} from './ai/customEnv';
import { logCustomAIDebug } from './ai/customAiDebug';
import {
  ProviderExplanationResult,
  resolveGeminiExplanation,
  resolveOpenAIStyleExplanation
} from './ai/explanations';
import { getLastPromptSession } from './promptSessions';

function shouldWarnForProvider(config: ProviderConfig): boolean {
  if (config.provider === 'gemini') {
    return !config.geminiApiKey;
  }

  if (config.provider === 'openai') {
    return !config.openAiApiKey;
  }

  if (config.provider === 'custom') {
    return !config.customApiKey;
  }

  if (config.provider === 'customAI') {
    const envConfig = getCustomAIEnvironmentConfig();
    return getCustomAIMissingParts(envConfig).length > 0;
  }

  return false;
}

async function promptForConfiguration(provider?: ProviderSelection): Promise<void> {
  if (provider === 'customAI') {
    await promptForCustomAIConfiguration();
    return;
  }

  const selection = await vscode.window.showInformationMessage(
    'My Hover Extension requires an API key for the selected provider.',
    'Open Settings'
  );

  if (selection === 'Open Settings') {
    await vscode.commands.executeCommand('workbench.action.openSettings', 'myHoverExtension');
  }
}

async function openCustomAIAuthorizationInBrowser(showSuccessMessage = true): Promise<boolean> {
  const details = buildCustomAIAuthorizationUrl();

  if (!details.url) {
    const missingText =
      details.missing.length > 0
        ? `Missing values: ${details.missing.join(', ')}.`
        : 'The authorization URL could not be constructed.';
    logCustomAIDebug('Unable to open CustomAI authorization URL from VS Code', {
      missing: details.missing,
    });
    await vscode.window.showErrorMessage(
      `CustomAI authentication could not be started. ${missingText}`
    );
    return false;
  }

  try {
    const uri = vscode.Uri.parse(details.url);
    await vscode.env.openExternal(uri);
    logCustomAIDebug('Opened system browser for CustomAI authentication', {
      scheme: uri.scheme,
      authority: uri.authority,
      path: uri.path,
    });
    if (showSuccessMessage) {
      void vscode.window.showInformationMessage(
        'A browser window was opened for CustomAI authentication. Complete the sign-in flow and return to VS Code.'
      );
    }
    return true;
  } catch (error) {
    logCustomAIDebug('Failed to open CustomAI authorization URL', {
      error: error instanceof Error ? error.message : String(error),
    });
    await vscode.window.showErrorMessage(
      'CustomAI authentication could not be opened in your browser. See logs for details.'
    );
    return false;
  }
}

async function promptForCustomAIConfiguration(): Promise<void> {
  const details = buildCustomAIAuthorizationUrl();
  const missingText =
    details.missing.length > 0
      ? `Missing values: ${details.missing.join(', ')}.`
      : undefined;
  const actions: string[] = [];

  if (details.url) {
    actions.push('Open Browser');
  }
  actions.push('Open Settings');

  const messageParts = [
    'My Hover Extension requires environment variables for the CustomAI provider. Update your .env file and reload VS Code.',
  ];

  if (details.url) {
    messageParts.push('If authentication is required, open the browser to sign in.');
  }

  if (missingText) {
    messageParts.push(missingText);
  }

  logCustomAIDebug('Prompting user to configure CustomAI provider', {
    hasAuthorizationUrl: !!details.url,
    missing: details.missing,
  });

  const selection = await vscode.window.showInformationMessage(
    messageParts.join(' '),
    ...actions
  );

  if (selection === 'Open Browser') {
    await openCustomAIAuthorizationInBrowser(false);
  } else if (selection === 'Open Settings') {
    await vscode.commands.executeCommand('workbench.action.openSettings', 'myHoverExtension');
  }
}

function createCommandLinksMarkdown(): string {
  const links = [
    '[⚙️ Configure extension](command:myHoverExtension.openSettings)',
    '[📝 View last prompt](command:myHoverExtension.showLastPromptDetails)'
  ];

  return links.join(' • ');
}

function formatMissingConfigurationMessage(
  providerLabel: string,
  missingParts: string[]
): string {
  if (missingParts.length === 0) {
    return `${providerLabel} configuration is incomplete. Use the settings button below to update the extension.`;
  }

  const formattedParts =
    missingParts.length === 1
      ? missingParts[0]
      : `${missingParts.slice(0, -1).join(', ')} and ${missingParts[missingParts.length - 1]}`;

  return `${providerLabel} configuration is missing the ${formattedParts}. Use the settings button below to update the extension.`;
}

interface PromptDependencies {
  resolver: FileContextResolver;
  registry: LineProcessorRegistry;
}

function resolveReferenceRoots(config: ProviderConfig): string[] {
  const workspaceFolders = vscode.workspace.workspaceFolders ?? [];
  const roots = new Set<string>();

  const addRoot = (candidate: string) => {
    if (!candidate) {
      return;
    }

    const normalized = path.resolve(candidate);
    if (!roots.has(normalized)) {
      roots.add(normalized);
    }
  };

  for (const folder of workspaceFolders) {
    addRoot(folder.uri.fsPath);
  }

  for (const root of config.referenceSearchRoots) {
    if (path.isAbsolute(root)) {
      addRoot(root);
    } else {
      for (const folder of workspaceFolders) {
        addRoot(path.join(folder.uri.fsPath, root));
      }
    }
  }

  return Array.from(roots);
}

function createPromptDependencies(config: ProviderConfig): PromptDependencies {
  const roots = resolveReferenceRoots(config);

  console.log(
    `[MyHoverExtension] Using reference search roots: ${
      roots.length > 0 ? roots.join(', ') : '<none>'
    }`
  );

  const resolver = new FileContextResolver({ roots });
  const registry = createDefaultLineProcessorRegistry(resolver);

  return { resolver, registry };
}

async function resolveDefinitionReference(
  lineText: string,
  resolver: FileContextResolver
): Promise<vscode.Location | undefined> {
  const match = FILE_LINE_PATTERN.exec(lineText);

  if (!match) {
    console.log('[MyHoverExtension] No file_line reference detected on the current line.');
    return undefined;
  }

  const parsed = parseFileLineReference(match[1]);

  if (!parsed) {
    console.log('[MyHoverExtension] file_line reference found but could not be parsed.');
    return undefined;
  }

  console.log(
    `[MyHoverExtension] Resolving definition reference ${parsed.filePath}:${parsed.line}.`
  );

  const context = await resolver.resolve(parsed.filePath, parsed.line);

  if (!context) {
    console.log('[MyHoverExtension] Definition reference could not be resolved to a file.');
    return undefined;
  }

  const uri = vscode.Uri.file(context.absolutePath);
  const position = new vscode.Position(Math.max(0, parsed.line - 1), 0);

  return new vscode.Location(uri, position);
}

export function activate(context: vscode.ExtensionContext) {
  const configuration = vscode.workspace.getConfiguration('myHoverExtension');
  const providerConfig = getProviderConfig(configuration);

  if (shouldWarnForProvider(providerConfig)) {
    void promptForConfiguration(providerConfig.provider);
  }

  if (!configuration.get<boolean>('enable')) {
    return;
  }

  const openSettingsCommand = vscode.commands.registerCommand(
    'myHoverExtension.openSettings',
    async () => {
      await vscode.commands.executeCommand('workbench.action.openSettings', 'myHoverExtension');
    }
  );

  const showLastPromptCommand = vscode.commands.registerCommand(
    'myHoverExtension.showLastPromptDetails',
    async () => {
      const session = getLastPromptSession();

      if (!session) {
        void vscode.window.showInformationMessage(
          'No prompt history available yet. Hover over code to generate an explanation first.'
        );
        return;
      }

      const providerLabel = PROVIDER_LABELS[session.provider];
      const timestamp = new Date(session.timestamp).toLocaleString();
      const lines: string[] = [
        '# My Hover Extension prompt details',
        '',
        `- **Provider:** ${providerLabel}`,
        `- **Endpoint:** ${session.endpoint || 'Not configured'}`,
        `- **Model:** ${session.model || 'Not configured'}`,
        `- **Hovered word:** ${session.hoveredWord}`,
        `- **Timestamp:** ${timestamp}`,
        ''
      ];

      if (session.lineText) {
        lines.push('## Source line', '```', session.lineText, '```', '');
      }

      lines.push('## System prompt');

      if (session.systemPrompt) {
        lines.push('```', session.systemPrompt, '```');
      } else {
        lines.push('_Not sent_');
      }

      lines.push('', '## User prompt', '```', session.userPrompt, '```', '');

      lines.push('## Rendered request payload', '```json', session.requestPayload, '```', '');

      lines.push('## Provider response');

      if (session.responseText) {
        lines.push('```', session.responseText, '```');
      }

      if (session.responseError) {
        if (session.responseText) {
          lines.push('');
        }
        lines.push('### Error details', '```', session.responseError, '```');
      }

      if (!session.responseText && !session.responseError) {
        lines.push('_No response received._');
      }

      const document = await vscode.workspace.openTextDocument({
        content: lines.join('\n'),
        language: 'markdown'
      });

      await vscode.window.showTextDocument(document, { preview: true });
    }
  );

  const openCustomAiAuthCommand = vscode.commands.registerCommand(
    'myHoverExtension.customAI.openAuthentication',
    async () => {
      await openCustomAIAuthorizationInBrowser();
    }
  );

  let resolvingBuiltInHover = false;
  let resolvingBuiltInDefinition = false;

  const hoverProvider = vscode.languages.registerHoverProvider(
    { scheme: 'file', language: '*' },
    {
      async provideHover(document, position, token) {
        console.log(
          `[MyHoverExtension] Hover requested for ${document.uri.toString()} at ${position.line + 1}:${position.character + 1}`
        );

        if (resolvingBuiltInHover) {
          console.log('[MyHoverExtension] Skipping hover to avoid re-entrancy.');
          return undefined;
        }

        resolvingBuiltInHover = true;

        let builtInHovers: vscode.Hover[] | undefined;

        try {
          console.log('[MyHoverExtension] Resolving built-in hover results...');
          builtInHovers = await vscode.commands.executeCommand<vscode.Hover[]>(
            'vscode.executeHoverProvider',
            document.uri,
            position
          );
          console.log(
            `[MyHoverExtension] Built-in hover count: ${builtInHovers?.length ?? 0}`
          );
        } finally {
          resolvingBuiltInHover = false;
        }

        const wordRange = document.getWordRangeAtPosition(position);
        const hoveredWord = wordRange ? document.getText(wordRange) : undefined;
        const lineText = document.lineAt(position.line).text;
        let providerExplanation: ProviderExplanationResult | undefined;

        const refreshedConfig = getProviderConfig(
          vscode.workspace.getConfiguration('myHoverExtension')
        );
        const providerLabel = PROVIDER_LABELS[refreshedConfig.provider];
        const { registry } = createPromptDependencies(refreshedConfig);

        if (hoveredWord && !token.isCancellationRequested) {
          try {
            if (refreshedConfig.provider === 'gemini') {
              const missing: string[] = [];

              if (!refreshedConfig.geminiEndpoint) {
                missing.push('endpoint');
              }

              if (!refreshedConfig.geminiApiKey) {
                missing.push('API key');
              }

              if (!refreshedConfig.geminiModel) {
                missing.push('model');
              }

              if (missing.length === 0) {
                console.log('[MyHoverExtension] Requesting Gemini explanation...');
                const statusDisposable = vscode.window.setStatusBarMessage(
                  'My Hover Extension: Loading explanation…'
                );
                try {
                  providerExplanation = await resolveGeminiExplanation(
                    hoveredWord,
                    lineText,
                    refreshedConfig,
                    registry,
                    token
                  );
                } finally {
                  statusDisposable.dispose();
                }

                const logStatus = providerExplanation?.text ? 'received' : 'not available';
                console.log(`[MyHoverExtension] Gemini explanation ${logStatus}.`);

                if (providerExplanation?.error) {
                  console.log(
                    `[MyHoverExtension] Gemini explanation error: ${providerExplanation.error}`
                  );
                }
              } else {
                console.log(
                  '[MyHoverExtension] Gemini configuration incomplete, skipping request.'
                );
                providerExplanation = {
                  error: formatMissingConfigurationMessage(providerLabel, missing)
                };
              }
            } else if (refreshedConfig.provider === 'openai') {
              const missing: string[] = [];

              if (!refreshedConfig.openAiEndpoint) {
                missing.push('endpoint');
              }

              if (!refreshedConfig.openAiApiKey) {
                missing.push('API key');
              }

              if (!refreshedConfig.openAiModel) {
                missing.push('model');
              }

              if (missing.length === 0) {
                console.log('[MyHoverExtension] Requesting OpenAI explanation...');
                const statusDisposable = vscode.window.setStatusBarMessage(
                  'My Hover Extension: Loading explanation…'
                );
                try {
                  providerExplanation = await resolveOpenAIStyleExplanation(
                    hoveredWord,
                    lineText,
                    refreshedConfig,
                    registry,
                    refreshedConfig.openAiEndpoint,
                    refreshedConfig.openAiApiKey,
                    refreshedConfig.openAiModel,
                    'openai',
                    token
                  );
                } finally {
                  statusDisposable.dispose();
                }

                const logStatus = providerExplanation?.text ? 'received' : 'not available';
                console.log(`[MyHoverExtension] OpenAI explanation ${logStatus}.`);

                if (providerExplanation?.error) {
                  console.log(
                    `[MyHoverExtension] OpenAI explanation error: ${providerExplanation.error}`
                  );
                }
              } else {
                console.log(
                  '[MyHoverExtension] OpenAI configuration incomplete, skipping request.'
                );
                providerExplanation = {
                  error: formatMissingConfigurationMessage(providerLabel, missing)
                };
              }
            } else if (refreshedConfig.provider === 'custom') {
              const missing: string[] = [];
              const chosenModel = refreshedConfig.customModel || refreshedConfig.openAiModel;

              if (!refreshedConfig.customEndpoint) {
                missing.push('endpoint');
              }

              if (!refreshedConfig.customApiKey) {
                missing.push('API key');
              }

              if (!chosenModel) {
                missing.push('model');
              }

              if (missing.length === 0) {
                console.log('[MyHoverExtension] Requesting custom explanation...');
                const statusDisposable = vscode.window.setStatusBarMessage(
                  'My Hover Extension: Loading explanation…'
                );
                try {
                  providerExplanation = await resolveOpenAIStyleExplanation(
                    hoveredWord,
                    lineText,
                    refreshedConfig,
                    registry,
                    refreshedConfig.customEndpoint,
                    refreshedConfig.customApiKey,
                    chosenModel,
                    'custom',
                    token
                  );
                } finally {
                  statusDisposable.dispose();
                }

                const logStatus = providerExplanation?.text ? 'received' : 'not available';
                console.log(`[MyHoverExtension] Custom explanation ${logStatus}.`);

                if (providerExplanation?.error) {
                  console.log(
                    `[MyHoverExtension] Custom explanation error: ${providerExplanation.error}`
                  );
                }
              } else {
                console.log(
                  '[MyHoverExtension] Custom provider configuration incomplete, skipping request.'
                );
                providerExplanation = {
                  error: formatMissingConfigurationMessage(providerLabel, missing)
                };
              }
            } else if (refreshedConfig.provider === 'customAI') {
              const envConfig = getCustomAIEnvironmentConfig();
              const missing = getCustomAIMissingParts(envConfig);

              if (missing.length === 0) {
                console.log('[MyHoverExtension] Requesting CustomAI explanation...');
                const statusDisposable = vscode.window.setStatusBarMessage(
                  'My Hover Extension: Loading explanation…'
                );
                try {
                  providerExplanation = await resolveOpenAIStyleExplanation(
                    hoveredWord,
                    lineText,
                    refreshedConfig,
                    registry,
                    envConfig.endpoint,
                    envConfig.apiKey,
                    envConfig.model,
                    'customAI',
                    token
                  );
                } finally {
                  statusDisposable.dispose();
                }

                const logStatus = providerExplanation?.text ? 'received' : 'not available';
                console.log(`[MyHoverExtension] CustomAI explanation ${logStatus}.`);

                if (providerExplanation?.error) {
                  console.log(
                    `[MyHoverExtension] CustomAI explanation error: ${providerExplanation.error}`
                  );
                }
              } else {
                console.log(
                  '[MyHoverExtension] CustomAI environment configuration incomplete, skipping request.'
                );
                const envMessage = (() => {
                  if (missing.length === 0) {
                    return `${providerLabel} configuration is incomplete. Update the required environment variables.`;
                  }

                  const formattedParts =
                    missing.length === 1
                      ? missing[0]
                      : `${missing.slice(0, -1).join(', ')} and ${missing[missing.length - 1]}`;

                  return `${providerLabel} configuration is missing the ${formattedParts}. Update the corresponding environment variables (see .env).`;
                })();
                providerExplanation = {
                  error: envMessage
                };
              }
            }
          } catch (error) {
            console.error('[MyHoverExtension] Provider request failed:', error);
            const message = error instanceof Error ? error.message : String(error);
            providerExplanation = {
              error: `Unexpected error while requesting ${providerLabel} explanation: ${message}`
            };
          }
        }

        const commandLinks = createCommandLinksMarkdown();
        const extensionContents: vscode.MarkdownString[] = [];

        if (providerExplanation?.text) {
          extensionContents.push(new vscode.MarkdownString(providerExplanation.text));
        } else if (providerExplanation?.error) {
          extensionContents.push(
            new vscode.MarkdownString(`_${providerExplanation.error}_`)
          );
        }

        const actionsMarkdown = new vscode.MarkdownString(commandLinks);
        actionsMarkdown.isTrusted = true;

        const noBuiltInHover = !builtInHovers || builtInHovers.length === 0;
        const shouldShowActions =
          Boolean(providerExplanation) || noBuiltInHover || Boolean(hoveredWord);

        if (shouldShowActions) {
          extensionContents.push(actionsMarkdown);
        }

        if (!noBuiltInHover && builtInHovers) {
          const hover = new vscode.Hover([...builtInHovers[0].contents]);

          for (const content of extensionContents) {
            hover.contents.push(content);
          }

          return hover;
        }

        console.log('[MyHoverExtension] No built-in hover found, using extension response.');

        if (!providerExplanation?.text && !providerExplanation?.error) {
          extensionContents.unshift(
            new vscode.MarkdownString('_My Hover Extension did not return a response._')
          );
        }

        return new vscode.Hover(extensionContents);
      }
    }
  );

  const defProvider = vscode.languages.registerDefinitionProvider(
    { scheme: 'file', language: '*' },
    {
      async provideDefinition(document, position) {
        if (resolvingBuiltInDefinition) {
          return undefined;
        }

        resolvingBuiltInDefinition = true;

        let builtInDefs: vscode.Location[] | undefined;

        try {
          console.log('[MyHoverExtension] Resolving built-in definitions...');
          builtInDefs = await vscode.commands.executeCommand<vscode.Location[]>(
            'vscode.executeDefinitionProvider',
            document.uri,
            position
          );
          console.log(
            `[MyHoverExtension] Built-in definition count: ${builtInDefs?.length ?? 0}`
          );
        } finally {
          resolvingBuiltInDefinition = false;
        }

        const results: vscode.Location[] = [];

        if (builtInDefs && builtInDefs.length > 0) {
          results.push(...builtInDefs);
        }

        const refreshedConfig = getProviderConfig(
          vscode.workspace.getConfiguration('myHoverExtension')
        );
        const { resolver } = createPromptDependencies(refreshedConfig);
        const lineText = document.lineAt(position.line).text;
        const referenceLocation = await resolveDefinitionReference(lineText, resolver);

        if (referenceLocation) {
          console.log('[MyHoverExtension] Adding reference-based definition result.');
          results.push(referenceLocation);
        } else {
          console.log('[MyHoverExtension] No reference-based definition result available.');
        }

        return results;
      }
    }
  );

  context.subscriptions.push(
    hoverProvider,
    defProvider,
    openSettingsCommand,
    showLastPromptCommand,
    openCustomAiAuthCommand
  );
}

export function deactivate() {}
