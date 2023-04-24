import * as vscode from 'vscode';
import { DomainSpecificBreakpointsProvider, DomainSpecificBreakpointTypeTreeItem } from './domainSpecificBreakpoints';
import { ConfigurableDebugAdapterTrackerFactory } from './trackers';

// Stores the ids of the currently enabled breakpoint types
const enabledBreakpointTypeIds: Set<string> = new Set();

/**
 * Activates the debug extension.
 * 
 * @param context
 * @param factory
 */
export function activateDebug(context: vscode.ExtensionContext, factory: vscode.DebugAdapterDescriptorFactory) {
    registerCommands(context);
    registerTrackers(context);

    const domainSpecificBreakpointsProvider: DomainSpecificBreakpointsProvider = new DomainSpecificBreakpointsProvider();
    const dataProviderDescriptions: DataProviderDescription[] = [{
        viewId: 'domainSpecificBreakpoints',
        dataProvider: domainSpecificBreakpointsProvider
    }];
    registerDataProviders(context, dataProviderDescriptions);

    registerListeners(context, domainSpecificBreakpointsProvider);

    context.subscriptions.push(vscode.debug.registerDebugAdapterDescriptorFactory('configurable', factory));
}

/**
 * Registers all commands provided by the extension.
 * 
 * @param context
 */
function registerCommands(context: vscode.ExtensionContext) {
    context.subscriptions.push(

        // Asks the user for a program name
        vscode.commands.registerCommand('extension.configurable-debug.getProgramName', () => {
            return vscode.window.showInputBox({
                placeHolder: 'Please enter the name of a text file in the workspace folder.'
            });
        }),

        // Asks the user for a port
        vscode.commands.registerCommand('extension.configurable-debug.getLanguageRuntimePort', async () => {
            var languageRuntimePortString: string | undefined = await vscode.window.showInputBox({
                placeHolder: 'Please enter the port of the language runtime for the selected file.'
            });

            return languageRuntimePortString ? languageRuntimePortString : undefined;
        }),

        // Runs the currently opened file
        vscode.commands.registerCommand('extension.configurable-debug.runEditorContents', async (resource: vscode.Uri) => {
            let targetResource = resource;
            if (!targetResource && vscode.window.activeTextEditor) {
                targetResource = vscode.window.activeTextEditor.document.uri;
            }

            if (!targetResource) return;

            var languageRuntimePort: number | undefined = await vscode.commands.executeCommand('extension.configurable-debug.getLanguageRuntimePort');
            if (!languageRuntimePort) return;

            vscode.debug.startDebugging(undefined, {
                type: 'configurable',
                name: 'Run File',
                request: 'launch',
                sourceFile: targetResource.fsPath,
                languageServerPort: languageRuntimePort,
                languageId: (await vscode.workspace.openTextDocument(targetResource)).languageId
            },
                { noDebug: true }
            );
        }),

        // Debugs the currently opened file
        vscode.commands.registerCommand('extension.configurable-debug.debugEditorContents', async (resource: vscode.Uri) => {
            let targetResource = resource;
            if (!targetResource && vscode.window.activeTextEditor) {
                targetResource = vscode.window.activeTextEditor.document.uri;
            }

            if (!targetResource) return;

            var languageRuntimePort: number | undefined = await vscode.commands.executeCommand('extension.configurable-debug.getLanguageRuntimePort');
            if (!languageRuntimePort) return;

            vscode.debug.startDebugging(undefined, {
                type: 'configurable',
                name: 'Debug File',
                request: 'launch',
                sourceFile: targetResource.fsPath,
                languageServerPort: languageRuntimePort,
                languageId: (await vscode.workspace.openTextDocument(targetResource)).languageId,
                pauseOnStart: true
            });
        }),

        vscode.commands.registerCommand('extension.configurable-debug.enableBreakpointType', async (breakpointType: DomainSpecificBreakpointTypeTreeItem) => {
            enabledBreakpointTypeIds.add(breakpointType.typeId);
            await vscode.debug.activeDebugSession?.customRequest('enableBreakpointTypes', { breakpointTypeIds: Array.from(enabledBreakpointTypeIds) });

            breakpointType.refresh();
        }),

        vscode.commands.registerCommand('extension.configurable-debug.disableBreakpointType', async (breakpointType: DomainSpecificBreakpointTypeTreeItem) => {
            enabledBreakpointTypeIds.delete(breakpointType.typeId);
            await vscode.debug.activeDebugSession?.customRequest('enableBreakpointTypes', { breakpointTypeIds: Array.from(enabledBreakpointTypeIds) });

            breakpointType.refresh();
        })
    );
}


function registerTrackers(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        // Logging
        vscode.debug.registerDebugAdapterTrackerFactory('configurable', new ConfigurableDebugAdapterTrackerFactory())
    );
}


/**
 * Registers data providers for all views provided by the extension.
 * 
 * @param context 
 * @param dataProviderDescriptions
 */
function registerDataProviders(context: vscode.ExtensionContext, dataProviderDescriptions: DataProviderDescription[]) {
    for (const dataProviderDescription of dataProviderDescriptions) {
        context.subscriptions.push(
            vscode.window.registerTreeDataProvider(dataProviderDescription.viewId, dataProviderDescription.dataProvider)
        );
    }
}

function registerListeners(context: vscode.ExtensionContext, languageSpecificBreakpointsProvider: DomainSpecificBreakpointsProvider) {
    context.subscriptions.push(
        vscode.debug.onDidStartDebugSession(event => languageSpecificBreakpointsProvider.refresh(undefined))
    );
}

interface DataProviderDescription {
    viewId: string;
    dataProvider: vscode.TreeDataProvider<any>;
}