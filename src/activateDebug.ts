import * as vscode from 'vscode';
import { DisposableDebugAdapterDescriptorFactory } from './extension';
import { LanguageSpecificBreakpointsProvider, LanguageSpecificBreakpointTypeTreeItem } from './languageSpecificBreakpoints';
import { GenericDebugAdapterTrackerFactory } from './trackers';

/**
 * Activates the debug extension.
 * 
 * @param context
 * @param factory
 */
export function activateDebug(context: vscode.ExtensionContext, factory: DisposableDebugAdapterDescriptorFactory) {
    registerCommands(context);
    registerTrackers(context);

    const languageSpecificBreakpointsProvider: LanguageSpecificBreakpointsProvider = new LanguageSpecificBreakpointsProvider();
    const dataProviderDescriptions: DataProviderDescription[] = [{
        viewId: 'domainSpecificBreakpoints',
        dataProvider: languageSpecificBreakpointsProvider
    }];
    registerDataProviders(context, dataProviderDescriptions);

    registerListeners(context, languageSpecificBreakpointsProvider);

    context.subscriptions.push(vscode.debug.registerDebugAdapterDescriptorFactory('generic', factory));
    context.subscriptions.push(factory);
}

/**
 * Registers all commands provided by the extension.
 * 
 * @param context
 */
function registerCommands(context: vscode.ExtensionContext) {
    context.subscriptions.push(

        // Asks the user for a program name
        vscode.commands.registerCommand('extension.generic-debug.getProgramName', () => {
            return vscode.window.showInputBox({
                placeHolder: 'Please enter the name of a text file in the workspace folder.'
            });
        }),

        // Asks the user for a port
        vscode.commands.registerCommand('extension.generic-debug.getLanguageServerPort', async () => {
            var languageServerPortString: string | undefined = await vscode.window.showInputBox({
                placeHolder: 'Please enter the port of the language server for the selected file.'
            });

            return languageServerPortString ? languageServerPortString : undefined;
        }),

        // Runs the currently opened file
        vscode.commands.registerCommand('extension.generic-debug.runEditorContents', async (resource: vscode.Uri) => {
            let targetResource = resource;
            if (!targetResource && vscode.window.activeTextEditor) {
                targetResource = vscode.window.activeTextEditor.document.uri;
            }

            if (!targetResource) return;

            var languageServerPort: number | undefined = await vscode.commands.executeCommand('extension.generic-debug.getLanguageServerPort');
            if (!languageServerPort) return;

            vscode.debug.startDebugging(undefined, {
                type: 'generic',
                name: 'Run File',
                request: 'launch',
                sourceFile: targetResource.fsPath,
                languageServerPort: languageServerPort,
                languageId: (await vscode.workspace.openTextDocument(targetResource)).languageId
            },
                { noDebug: true }
            );
        }),

        // Debugs the currently opened file
        vscode.commands.registerCommand('extension.generic-debug.debugEditorContents', async (resource: vscode.Uri) => {
            let targetResource = resource;
            if (!targetResource && vscode.window.activeTextEditor) {
                targetResource = vscode.window.activeTextEditor.document.uri;
            }

            if (!targetResource) return;

            var languageServerPort: number | undefined = await vscode.commands.executeCommand('extension.generic-debug.getLanguageServerPort');
            if (!languageServerPort) return;

            vscode.debug.startDebugging(undefined, {
                type: 'generic',
                name: 'Debug File',
                request: 'launch',
                sourceFile: targetResource.fsPath,
                languageServerPort: languageServerPort,
                languageId: (await vscode.workspace.openTextDocument(targetResource)).languageId,
                pauseOnStart: true
            });
        }),

        vscode.commands.registerCommand('extension.generic-debug.enableBreakpointType', async (breakpointType: LanguageSpecificBreakpointTypeTreeItem) => {
            await vscode.debug.activeDebugSession?.customRequest('enableBreakpointType', { breakpointTypeId: breakpointType.typeId });

            breakpointType.refresh();
        })
    );
}


function registerTrackers(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        // Logging
        vscode.debug.registerDebugAdapterTrackerFactory('generic', new GenericDebugAdapterTrackerFactory())
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

function registerListeners(context: vscode.ExtensionContext, languageSpecificBreakpointsProvider: LanguageSpecificBreakpointsProvider) {
    context.subscriptions.push(
        vscode.debug.onDidStartDebugSession(event => languageSpecificBreakpointsProvider.refresh(undefined))
    );
}

interface DataProviderDescription {
    viewId: string;
    dataProvider: vscode.TreeDataProvider<any>;
}