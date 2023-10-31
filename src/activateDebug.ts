import * as vscode from 'vscode';
import { AvailableStepsDataProvider, AvailableStepTreeItem } from './availableSteps';
import { DomainSpecificBreakpointsProvider, DomainSpecificBreakpointTypeTreeItem } from './domainSpecificBreakpoints';
import { SteppingModesProvider, SteppingModeTreeItem } from './stepppingModes';
import { StoppedDebugAdapterTrackerFactory } from './trackers';
import { TreeDataProvider } from './treeItem';

export class DebugSetup {
    private staticDataProviderDescriptions: DataProviderDescription[];
    private dynamicDataProviderDescriptions: DataProviderDescription[];

    constructor() {
        this.staticDataProviderDescriptions = [
            {
                viewId: 'domainSpecificBreakpoints',
                dataProvider: new DomainSpecificBreakpointsProvider()
            },
            {
                viewId: 'steppingModes',
                dataProvider: new SteppingModesProvider()
            }
        ];

        this.dynamicDataProviderDescriptions = [
            {
                viewId: 'availableSteps',
                dataProvider: new AvailableStepsDataProvider()
            }
        ];
    }

    /**
     * Activates the debug extension.
     * 
     * @param context Context of the extension.
     * @param factory Factory of the debug adapter descriptor.
     */
    public activateDebug(context: vscode.ExtensionContext, factory: vscode.DebugAdapterDescriptorFactory) {
        this.registerDataProviders(context, this.staticDataProviderDescriptions);
        this.registerDataProviders(context, this.dynamicDataProviderDescriptions);
        this.registerCommands(context);
        this.registerListenersForStaticDataProviders(context, this.staticDataProviderDescriptions.map(description => description.dataProvider));
        this.registerListenersForDynamicDataProviders(context, this.dynamicDataProviderDescriptions.map(description => description.dataProvider));

        context.subscriptions.push(vscode.debug.registerDebugAdapterDescriptorFactory('configurable', factory));
    }

    /**
    * Registers all commands provided by the extension.
    * 
    * @param context Context of the extension.
    */
    private registerCommands(context: vscode.ExtensionContext) {
        context.subscriptions.push(
            // Command to enable a domain-specific breakpoint type in the associated tab
            vscode.commands.registerCommand('extension.configurable-debug.enableBreakpointType', async (breakpointType: DomainSpecificBreakpointTypeTreeItem) => {
                const enabledBreakpointTypeIds: Set<string> = new Set(breakpointType.provider.enabledBreakpointTypesIds).add(breakpointType.typeId);
                await vscode.debug.activeDebugSession?.customRequest('enableBreakpointTypes', { breakpointTypeIds: Array.from(enabledBreakpointTypeIds) });

                breakpointType.refresh();
            }),

            // Command to disable a domain-specific breakpoint type in the associated tab
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

                //Also need to refresh the Available Steps tab
                this.dynamicDataProviderDescriptions.find(providerDescription => providerDescription.viewId === 'availableSteps')?.dataProvider.refresh(undefined);
            }),

            // Command to enable a step in the Available Steps tab
            vscode.commands.registerCommand('extension.configurable-debug.enableStep', async (step: AvailableStepTreeItem) => {
                await vscode.debug.activeDebugSession?.customRequest('enableStep', { stepId: step.stepId });

                step.refresh();
            }),

            // Command to disable a step in the Available Steps tab
            vscode.commands.registerCommand('extension.configurable-debug.disableStep', async (step: AvailableStepTreeItem) => {
                await vscode.debug.activeDebugSession?.customRequest('enableStep', {});

                step.refresh();
            })
        );
    }

    /**
     * Registers data providers for all views provided by the extension.
     * 
     * @param context Context of the extension.
     * @param dataProviderDescriptions Descriptions of the data providers to register.
     */
    private registerDataProviders(context: vscode.ExtensionContext, dataProviderDescriptions: DataProviderDescription[]) {
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
    private registerListenersForStaticDataProviders(context: vscode.ExtensionContext, dataProviders: TreeDataProvider[]) {
        for (const dataProvider of dataProviders) {
            context.subscriptions.push(
                vscode.debug.onDidStartDebugSession(event => dataProvider.refresh(undefined))
            );
        }
    }

    /**
     * Registeners listeners for all views provided by the extension.
     * 
     * @param context Context of the extension.
     * @param dataProviders Data providers for which to register listeners.
     */
    private registerListenersForDynamicDataProviders(context: vscode.ExtensionContext, dataProviders: TreeDataProvider[]) {
        const stoppedTrackerFactory: StoppedDebugAdapterTrackerFactory = new StoppedDebugAdapterTrackerFactory();

        for (const dataProvider of dataProviders) {
            stoppedTrackerFactory.providers.push(dataProvider);
        }

        context.subscriptions.push(
            vscode.debug.registerDebugAdapterTrackerFactory('configurable', stoppedTrackerFactory)
        );
    }
}

interface DataProviderDescription {
    viewId: string;
    dataProvider: TreeDataProvider;
}