import * as vscode from 'vscode';
import { AvailableStepsDataProvider, AvailableStepTreeItem } from './availableSteps';
import { DomainSpecificBreakpoint, GetBreakpointTypesResponse, GetDomainSpecificBreakpointsResponse, GetEnabledStandaloneBreakpointTypesResponse } from './DAPExtension';
import { BreakpointTypeTreeItem, DomainSpecificBreakpointsProvider, ParameterizedBreakpointTypeTreeItem, StandaloneBreakpointTypeTreeItem } from './domainSpecificBreakpoints';
import { InvalidatedStacksDebugAdapterTrackerFactory, SetBreakpointsDebugAdapterTrackerFactory, StoppedDebugAdapterTrackerFactory } from './trackers';
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
            if (vscode.debug.activeDebugSession === undefined) throw new Error('Undefined debug session.');
            const sourceFile: string = vscode.debug.activeDebugSession.configuration.sourceFile;

            const enabledStandaloneBreakpointTypes: Set<string> = new Set(provider.enabledStandaloneBreakpointTypes);
            // TODO: deep clone
            const enabledDomainSpecificBreakpoints: DomainSpecificBreakpoint[] = Array.from(provider.domainSpecificBreakpoints);

            for (const item of event.items) {
                const treeItem: BreakpointTypeTreeItem = item[0] as BreakpointTypeTreeItem;

                if (this.isStandaloneBreakpointTypeTreeItem(treeItem)) {
                    if (item[1] === vscode.TreeItemCheckboxState.Checked) {
                        enabledStandaloneBreakpointTypes.add(treeItem.breakpointTypeId);
                    } else {
                        enabledStandaloneBreakpointTypes.delete(treeItem.breakpointTypeId);
                    }
                }
                // I would put an 'else' here byt the type checker won't let me :(
                if (this.isParameterizedBreakpointTypeTreeItem(treeItem)) {
                    const domainSpecificBreakpoint: DomainSpecificBreakpoint | undefined = enabledDomainSpecificBreakpoints.find(b => b.sourceBreakpointId === treeItem.sourceBreakpointId);
                    if (domainSpecificBreakpoint === undefined) throw new Error(`Undefined domain-specific breakpoint for source breakpoint ${treeItem.sourceBreakpointId}.`);

                    if (item[1] === vscode.TreeItemCheckboxState.Checked) {
                        if (!domainSpecificBreakpoint.enabledBreakpointTypeIds.includes(treeItem.breakpointTypeId)) domainSpecificBreakpoint.enabledBreakpointTypeIds.push(treeItem.breakpointTypeId);
                    } else {
                        const breakpointTypeIndex: number = domainSpecificBreakpoint.enabledBreakpointTypeIds.findIndex(id => id === treeItem.breakpointTypeId);
                        if (breakpointTypeIndex !== -1) domainSpecificBreakpoint.enabledBreakpointTypeIds.splice(breakpointTypeIndex, 1);
                    }
                }
            }

            await vscode.debug.activeDebugSession.customRequest('enableStandaloneBreakpointTypes', { sourceFile: sourceFile, breakpointTypeIds: Array.from(enabledStandaloneBreakpointTypes) });
            const getEnabledStandaloneBreakpointTypesResponse: GetEnabledStandaloneBreakpointTypesResponse = await vscode.debug.activeDebugSession.customRequest('getEnabledStandaloneBreakpointTypes', { sourceFile: sourceFile });
            provider.enabledStandaloneBreakpointTypes = new Set(getEnabledStandaloneBreakpointTypesResponse.enabledStandaloneBreakpointTypesIds);

            await vscode.debug.activeDebugSession.customRequest('setDomainSpecificBreakpoints', { sourceFile: sourceFile, breakpoints: enabledDomainSpecificBreakpoints });
            const getDomainSpecificBreakpointsResponse: GetDomainSpecificBreakpointsResponse = await vscode.debug.activeDebugSession.customRequest('getDomainSpecificBreakpoints', { sourceFile: sourceFile });
            provider.domainSpecificBreakpoints = getDomainSpecificBreakpointsResponse.breakpoints;

            provider.refresh(undefined);
        });

        context.subscriptions.push(
            // Retrieval of breakpoint types
            vscode.debug.onDidStartDebugSession(async () => {
                if (vscode.debug.activeDebugSession === undefined) throw new Error('Undefined debug session.');
                provider.initialize(vscode.debug.activeDebugSession.configuration.sourceFile);

                const getBreakpointTypesResponse: GetBreakpointTypesResponse = await vscode.debug.activeDebugSession.customRequest('getBreakpointTypes', { sourceFile: provider.sourceFile });
                provider.breakpointTypes = new Map();
                for (const breakpointType of getBreakpointTypesResponse.breakpointTypes) {
                    provider.breakpointTypes.set(breakpointType.id, breakpointType);
                }

                const getEnabledStandaloneBreakpointTypesResponse: GetEnabledStandaloneBreakpointTypesResponse = await vscode.debug.activeDebugSession.customRequest('getEnabledStandaloneBreakpointTypes', { sourceFile: provider.sourceFile });
                provider.enabledStandaloneBreakpointTypes = new Set(getEnabledStandaloneBreakpointTypesResponse.enabledStandaloneBreakpointTypesIds);



                provider.refresh(undefined)
            }),
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
                    await vscode.debug.activeDebugSession.customRequest('enableStep', { sourceFile: sourceFile, stepId: step.stepId });
                }
            }

            provider.refresh(undefined);
        });

        context.subscriptions.push(treeView);

        return provider;
    }

    private registerCommands(context: vscode.ExtensionContext): void {
        context.subscriptions.push(vscode.commands.registerCommand('focusLine', (filePath: string, line: number) => {
            const fileUri: vscode.Uri = vscode.Uri.file(filePath);
            const position: vscode.Position = new vscode.Position(line - 1, 0);
            vscode.window.showTextDocument(fileUri, { selection: new vscode.Selection(position, position) });
        }));
    }

    private isStandaloneBreakpointTypeTreeItem(item: BreakpointTypeTreeItem): item is StandaloneBreakpointTypeTreeItem {
        return item.isStandalone;
    }

    private isParameterizedBreakpointTypeTreeItem(item: BreakpointTypeTreeItem): item is ParameterizedBreakpointTypeTreeItem {
        return !item.isStandalone;
    }
}