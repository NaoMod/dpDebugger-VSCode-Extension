import * as vscode from 'vscode';
import { AvailableStepsDataProvider, AvailableStepTreeItem } from './availableSteps';
import { addBreakpoint, changeArrayEntry, changeSingleParameterValue, removeBreakpoint } from './commands';
import { EnableStepArguments, GetBreakpointTypesArguments, GetBreakpointTypesResponse } from './DAPExtension';
import { DomainSpecificBreakpointsProvider, DomainSpecificBreakpointTreeItem } from './domainSpecificBreakpoints';
import { InvalidatedStacksDebugAdapterTrackerFactory } from './trackers/invalidatedTracker';
import { SetBreakpointsDebugAdapterTrackerFactory } from './trackers/setBreakpointsTracker';
import { StoppedDebugAdapterTrackerFactory } from './trackers/stoppedTracker';
import path = require('path');

export class DebugSetup {
    /**
     * Activates the debug extension.
     * 
     * @param context Context of the extension.
     * @param factory Factory of the debug adapter descriptor.
     */
    public async activateDebug(context: vscode.ExtensionContext, factory: vscode.DebugAdapterDescriptorFactory) {
        const stoppedTrackerFactory: StoppedDebugAdapterTrackerFactory = new StoppedDebugAdapterTrackerFactory();
        const invalidatedStacksTrackerFactory: InvalidatedStacksDebugAdapterTrackerFactory = new InvalidatedStacksDebugAdapterTrackerFactory();

        const availableStepsProvider: AvailableStepsDataProvider = this.createAvailableStepsTreeView(context);
        stoppedTrackerFactory.providers.push(availableStepsProvider);

        const domainSpecificBreakpointProvider: DomainSpecificBreakpointsProvider = await this.createDomainSpecificBreakpointsTreeView(context);
        const setBreakpointsTrackerfactory: SetBreakpointsDebugAdapterTrackerFactory = new SetBreakpointsDebugAdapterTrackerFactory(domainSpecificBreakpointProvider);

        this.registerTrackers(context, stoppedTrackerFactory, invalidatedStacksTrackerFactory, setBreakpointsTrackerfactory);

        this.registerCommands(context);

        context.subscriptions.push(vscode.debug.registerDebugAdapterDescriptorFactory('configurable', factory));
    }

    private registerTrackers(context: vscode.ExtensionContext, ...trackers: vscode.DebugAdapterTrackerFactory[]) {
        for (const tracker of trackers) {
            context.subscriptions.push(vscode.debug.registerDebugAdapterTrackerFactory('configurable', tracker));
        }
    }

    private async createDomainSpecificBreakpointsTreeView(context: vscode.ExtensionContext): Promise<DomainSpecificBreakpointsProvider> {
        const provider: DomainSpecificBreakpointsProvider = new DomainSpecificBreakpointsProvider();
        const treeView: vscode.TreeView<vscode.TreeItem> = vscode.window.createTreeView('domainSpecificBreakpoints', {
            treeDataProvider: provider
        });

        treeView.onDidChangeCheckboxState(async event => {
            for (const item of event.items) {
                const breakpointItem: DomainSpecificBreakpointTreeItem = item[0] as DomainSpecificBreakpointTreeItem;
                if (item[1] === vscode.TreeItemCheckboxState.Checked) {
                    await provider.enableBreakpoint(breakpointItem.breakpoint);
                } else {
                    await provider.disableBreakpoint(breakpointItem.breakpoint);
                }
            }
        });


        context.subscriptions.push(
            vscode.debug.onDidTerminateDebugSession(() => {
                provider.terminate();
            }),

            // Retrieval of breakpoint types
            vscode.debug.onDidStartDebugSession(async () => {
                if (vscode.debug.activeDebugSession === undefined) throw new Error('Undefined debug session.');

                const args: GetBreakpointTypesArguments = { sourceFile: vscode.debug.activeDebugSession.configuration.sourceFile };
                const getBreakpointTypesResponse: GetBreakpointTypesResponse = await vscode.debug.activeDebugSession.customRequest('getBreakpointTypes', args);
                provider.initialize(vscode.debug.activeDebugSession.configuration.sourceFile, getBreakpointTypesResponse.breakpointTypes);

                provider.refresh(undefined);
            }),

            vscode.debug.onDidChangeBreakpoints(event => {
                for (const breakpoint of event.added) {
                    if (!(breakpoint instanceof vscode.SourceBreakpoint)) continue;

                }

                for (const breakpoint of event.added) {
                    
                }
            }),

            vscode.commands.registerCommand('domainSpecificBreakpoints.addBreakpoint', addBreakpoint(provider)),
            vscode.commands.registerCommand('domainSpecificBreakpoints.removeBreakpoint', removeBreakpoint(provider)),
            vscode.commands.registerCommand('domainSpecificBreakpoints.changeSingleParameterValue', changeSingleParameterValue),
            vscode.commands.registerCommand('domainSpecificBreakpoints.changeArrayEntry', changeArrayEntry),
            treeView
        );

        return provider;
    }

    private createAvailableStepsTreeView(context: vscode.ExtensionContext): AvailableStepsDataProvider {
        const provider: AvailableStepsDataProvider = new AvailableStepsDataProvider();
        const treeView: vscode.TreeView<vscode.TreeItem> = vscode.window.createTreeView('availableSteps', {
            treeDataProvider: provider
        });

        treeView.onDidChangeCheckboxState(async event => {
            if (vscode.debug.activeDebugSession === undefined) throw new Error('Undefined debug session.');
            const sourceFile: string = vscode.debug.activeDebugSession.configuration.sourceFile;

            for (const item of event.items) {
                const step: AvailableStepTreeItem = item[0] as AvailableStepTreeItem;
                if (item[1] === vscode.TreeItemCheckboxState.Checked) {
                    const args: EnableStepArguments = { sourceFile: sourceFile, stepId: step.stepId };
                    await vscode.debug.activeDebugSession.customRequest('enableStep', args);
                }
            }

            provider.refresh(undefined);
        });

        context.subscriptions.push(treeView);

        return provider;
    }

    private registerCommands(context: vscode.ExtensionContext): void {
        context.subscriptions.push(
            vscode.commands.registerCommand('focusLine', (filePath: string, line: number) => {
                const fileUri: vscode.Uri = vscode.Uri.file(filePath);
                const position: vscode.Position = new vscode.Position(line - 1, 0);
                vscode.window.showTextDocument(fileUri, { selection: new vscode.Selection(position, position) });
            })
        );
    }
}