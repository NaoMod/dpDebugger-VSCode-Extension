import * as vscode from 'vscode';
import { DomainSpecificBreakpointsProvider, DomainSpecificBreakpointTypeTreeItem } from './domainSpecificBreakpoints';
import { SteppingModesProvider, SteppingModeTreeItem } from './stepppingModes';
import { TreeDataProvider } from './treeItem';

/**
 * Activates the debug extension.
 * 
 * @param context Context of the extension.
 * @param factory Factory of the debug adapter descriptor.
 */
export function activateDebug(context: vscode.ExtensionContext, factory: vscode.DebugAdapterDescriptorFactory) {
    const dataProviderDescriptions: DataProviderDescription[] = [
        {
            viewId: 'domainSpecificBreakpoints',
            dataProvider: new DomainSpecificBreakpointsProvider()
        },
        {
            viewId: 'steppingModes',
            dataProvider: new SteppingModesProvider()
        },
    ];
    
    registerDataProviders(context, dataProviderDescriptions);
    registerCommands(context);
    registerListeners(context, dataProviderDescriptions.map(description => description.dataProvider));

    context.subscriptions.push(vscode.debug.registerDebugAdapterDescriptorFactory('configurable', factory));
}

/**
 * Registers all commands provided by the extension.
 * 
 * @param context Context of the extension.
 */
function registerCommands(context: vscode.ExtensionContext) {
    context.subscriptions.push(
        // Command to enable a domain-specific breakpoint type in the associated tab
        vscode.commands.registerCommand('extension.configurable-debug.enableBreakpointType', async (breakpointType: DomainSpecificBreakpointTypeTreeItem) => {
            const enabledBreakpointTypeIds: Set<string> = new Set(breakpointType.provider.enabledBreakpointTypesIds).add(breakpointType.typeId);
            await vscode.debug.activeDebugSession?.customRequest('enableBreakpointTypes', { breakpointTypeIds: Array.from(enabledBreakpointTypeIds) });

            breakpointType.refresh();
        }),

        vscode.commands.registerCommand('extension.configurable-debug.disableBreakpointType', async (breakpointType: DomainSpecificBreakpointTypeTreeItem) => {
            const enabledBreakpointTypeIds: Set<string> = new Set(breakpointType.provider.enabledBreakpointTypesIds);
            enabledBreakpointTypeIds.delete(breakpointType.typeId);

            await vscode.debug.activeDebugSession?.customRequest('enableBreakpointTypes', { breakpointTypeIds: Array.from(enabledBreakpointTypeIds) });

            breakpointType.refresh();
        }),

        // Command to enable a stepping mode in the associated tab
        vscode.commands.registerCommand('extension.configurable-debug.enableSteppingMode', async (steppingMode: SteppingModeTreeItem) => {
            await vscode.debug.activeDebugSession?.customRequest('enableSteppingMode', { steppingModeId: steppingMode.modeId });

            steppingMode.refresh();
        })
    );
}

/**
 * Registers data providers for all views provided by the extension.
 * 
 * @param context Context of the extension.
 * @param dataProviderDescriptions Descriptions of the data providers to register.
 */
function registerDataProviders(context: vscode.ExtensionContext, dataProviderDescriptions: DataProviderDescription[]) {
    for (const dataProviderDescription of dataProviderDescriptions) {
        context.subscriptions.push(
            vscode.window.registerTreeDataProvider(dataProviderDescription.viewId, dataProviderDescription.dataProvider)
        );
    }
}

/**
 * Registeners listeners for all views provided by the extension.
 * 
 * @param context Context of the extension.
 * @param dataProviders Data providers for which to register listeners.
 */
function registerListeners(context: vscode.ExtensionContext, dataProviders: TreeDataProvider[]) {
    for (const dataProvider of dataProviders) {
        context.subscriptions.push(
            vscode.debug.onDidStartDebugSession(event => dataProvider.refresh(undefined))
        );
    }
}

interface DataProviderDescription {
    viewId: string;
    dataProvider: TreeDataProvider;
}