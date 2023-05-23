import * as vscode from 'vscode';
import { DomainSpecificBreakpointsProvider, DomainSpecificBreakpointTypeTreeItem } from './domainSpecificBreakpoints';

/**
 * Activates the debug extension.
 * 
 * @param context
 * @param factory
 */
export function activateDebug(context: vscode.ExtensionContext, factory: vscode.DebugAdapterDescriptorFactory) {

    const domainSpecificBreakpointsProvider: DomainSpecificBreakpointsProvider = new DomainSpecificBreakpointsProvider();
    const dataProviderDescriptions: DataProviderDescription[] = [{
        viewId: 'domainSpecificBreakpoints',
        dataProvider: domainSpecificBreakpointsProvider
    }];

    registerDataProviders(context, dataProviderDescriptions);
    registerCommands(context, domainSpecificBreakpointsProvider);
    registerListeners(context, domainSpecificBreakpointsProvider);

    context.subscriptions.push(vscode.debug.registerDebugAdapterDescriptorFactory('configurable', factory));
}

/**
 * Registers all commands provided by the extension.
 * 
 * @param context
 */
function registerCommands(context: vscode.ExtensionContext, domainSpecificBreakpointsProvider: DomainSpecificBreakpointsProvider) {
    context.subscriptions.push(
        vscode.commands.registerCommand('extension.configurable-debug.enableBreakpointType', async (breakpointType: DomainSpecificBreakpointTypeTreeItem) => {
            const enabledBreakpointTypeIds: Set<string> = new Set(domainSpecificBreakpointsProvider.enabledBreakpointTypeIds).add(breakpointType.typeId);
            await vscode.debug.activeDebugSession?.customRequest('enableBreakpointTypes', { breakpointTypeIds: Array.from(enabledBreakpointTypeIds) });

            breakpointType.refresh();
        }),

        vscode.commands.registerCommand('extension.configurable-debug.disableBreakpointType', async (breakpointType: DomainSpecificBreakpointTypeTreeItem) => {
            const enabledBreakpointTypeIds: Set<string> = new Set(domainSpecificBreakpointsProvider.enabledBreakpointTypeIds);
            enabledBreakpointTypeIds.delete(breakpointType.typeId);

            await vscode.debug.activeDebugSession?.customRequest('enableBreakpointTypes', { breakpointTypeIds: Array.from(enabledBreakpointTypeIds) });

            breakpointType.refresh();
        })
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