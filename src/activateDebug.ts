import * as vscode from 'vscode';
import { AvailableStepsDataProvider, AvailableStepTreeItem } from './availableSteps';
import { DomainSpecificBreakpointsProvider, DomainSpecificBreakpointTypeTreeItem } from './domainSpecificBreakpoints';
import { SteppingModesProvider, SteppingModeTreeItem } from './stepppingModes';
import { InvalidatedStacksDebugAdapterTrackerFactory, StoppedDebugAdapterTrackerFactory } from './trackers';

export class DebugSetup {
    /**
     * Activates the debug extension.
     * 
     * @param context Context of the extension.
     * @param factory Factory of the debug adapter descriptor.
     */
    public activateDebug(context: vscode.ExtensionContext, factory: vscode.DebugAdapterDescriptorFactory) {
        const stoppedTrackerFactory: StoppedDebugAdapterTrackerFactory = new StoppedDebugAdapterTrackerFactory();
        const invalidatedStacksTrackerFactory: InvalidatedStacksDebugAdapterTrackerFactory = new InvalidatedStacksDebugAdapterTrackerFactory();

        const availableStepsProvider: AvailableStepsDataProvider = this.createAvailableStepsTreeView(context);
        stoppedTrackerFactory.providers.push(availableStepsProvider);

        this.createSteppingModesTreeView(context, availableStepsProvider);
        this.createDomainSpecificBreakpointsTreeView(context);

        this.registerTrackers(context, stoppedTrackerFactory, invalidatedStacksTrackerFactory);
        this.registerAdditionnalCommands(context);

        context.subscriptions.push(vscode.debug.registerDebugAdapterDescriptorFactory('configurable', factory));
    }

    private registerTrackers(context: vscode.ExtensionContext, ...trackers: vscode.DebugAdapterTrackerFactory[]) {
        for (const tracker of trackers) {
            context.subscriptions.push(vscode.debug.registerDebugAdapterTrackerFactory('configurable', tracker));
        }
    }

    private createDomainSpecificBreakpointsTreeView(context: vscode.ExtensionContext) {
        const provider: DomainSpecificBreakpointsProvider = new DomainSpecificBreakpointsProvider();
        const treeView: vscode.TreeView<vscode.TreeItem> = vscode.window.createTreeView('domainSpecificBreakpoints', {
            treeDataProvider: provider
        });

        treeView.onDidChangeCheckboxState(async event => {
            const enabledBreakpointTypeIds: Set<string> = new Set(provider.enabledBreakpointTypesIds);

            for (const item of event.items) {
                const breakpointType: DomainSpecificBreakpointTypeTreeItem = item[0] as DomainSpecificBreakpointTypeTreeItem;
                if (item[1] === vscode.TreeItemCheckboxState.Checked) {
                    enabledBreakpointTypeIds.add(breakpointType.typeId);
                } else {
                    enabledBreakpointTypeIds.delete(breakpointType.typeId);
                }
            }

            await vscode.debug.activeDebugSession?.customRequest('enableBreakpointTypes', { breakpointTypeIds: Array.from(enabledBreakpointTypeIds) });
            provider.refresh(undefined);
        });

        context.subscriptions.push(
            vscode.debug.onDidStartDebugSession(() => provider.refresh(undefined)),
            treeView
        );
    }

    private createSteppingModesTreeView(context: vscode.ExtensionContext, availableStepsProvider: AvailableStepsDataProvider) {
        const provider: SteppingModesProvider = new SteppingModesProvider();
        const treeView: vscode.TreeView<vscode.TreeItem> = vscode.window.createTreeView('steppingModes', {
            treeDataProvider: provider
        });

        treeView.onDidChangeCheckboxState(async event => {
            for (const item of event.items) {
                const steppingMode: SteppingModeTreeItem = item[0] as SteppingModeTreeItem;
                if (item[1] === vscode.TreeItemCheckboxState.Checked) {
                    await vscode.debug.activeDebugSession?.customRequest('enableSteppingMode', { steppingModeId: steppingMode.modeId });
                }
            }

            provider.refresh(undefined);
            availableStepsProvider.refresh(undefined);
        });

        context.subscriptions.push(
            treeView,
            vscode.debug.onDidStartDebugSession(() => provider.refresh(undefined))
        );
    }

    private createAvailableStepsTreeView(context: vscode.ExtensionContext): AvailableStepsDataProvider {
        const provider: AvailableStepsDataProvider = new AvailableStepsDataProvider();
        const treeView: vscode.TreeView<vscode.TreeItem> = vscode.window.createTreeView('availableSteps', {
            treeDataProvider: provider
        });

        treeView.onDidChangeCheckboxState(async event => {
            for (const item of event.items) {
                const step: AvailableStepTreeItem = item[0] as AvailableStepTreeItem;
                if (item[1] === vscode.TreeItemCheckboxState.Checked) {
                    await vscode.debug.activeDebugSession?.customRequest('enableStep', { stepId: step.stepId });
                } else {
                    await vscode.debug.activeDebugSession?.customRequest('enableStep', {});
                }
            }

            provider.refresh(undefined);
        });

        context.subscriptions.push(treeView);

        return provider;
    }

    private registerAdditionnalCommands(context: vscode.ExtensionContext) {
        context.subscriptions.push(
            vscode.commands.registerCommand('extension.configurable-debug.continueUntilChoice', () => {
                vscode.debug.activeDebugSession?.customRequest('willContinueUntilChoice', {});
                vscode.commands.executeCommand('workbench.action.debug.continue');
            })
        );
    }
}