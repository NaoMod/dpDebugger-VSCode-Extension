import { DebugProtocol } from '@vscode/debugprotocol';
import * as vscode from 'vscode';
import { BreakpointType, GetModelElementReferenceFromSourceArguments, GetModelElementReferenceFromSourceResponse, ModelElementReference } from './DAPExtension';
import { pickBreakpointType, pickValueForParameter } from './breakpointValuesPicker';
import { DomainSpecificBreakpointsProvider, Value } from './domainSpecificBreakpoints';
import { TreeDataProvider } from './treeItem';

/**
 * Factory for {@link StoppedDebugAdapterTracker}.
 */
export class StoppedDebugAdapterTrackerFactory implements vscode.DebugAdapterTrackerFactory {
    public providers: TreeDataProvider[] = [];

    public createDebugAdapterTracker(session: vscode.DebugSession): vscode.ProviderResult<vscode.DebugAdapterTracker> {
        return new StoppedDebugAdapterTracker(this.providers);
    }
}

/**
 * Listener for stopped debug adapter messages.
 */
export class StoppedDebugAdapterTracker implements vscode.DebugAdapterTracker {
    constructor(private providers: TreeDataProvider[]) { }

    public onDidSendMessage(message: any): void {
        if (message.event !== 'stopped') return;

        for (const provider of this.providers) {
            provider.refresh(undefined);
        }
    }
}

/**
 * Factory for {@link InvalidatedStacksDebugAdapterTracker}.
 */
export class InvalidatedStacksDebugAdapterTrackerFactory implements vscode.DebugAdapterTrackerFactory {
    public createDebugAdapterTracker(session: vscode.DebugSession): vscode.ProviderResult<vscode.DebugAdapterTracker> {
        return new InvalidatedStacksDebugAdapterTracker();
    }
}

/**
 * Listener for invalidated stacks debug adapter messages.
 */
export class InvalidatedStacksDebugAdapterTracker implements vscode.DebugAdapterTracker {
    private mustFocusOnNextRefresh: boolean = false;

    public onDidSendMessage(message: any): void {
        // Refresh focus on stack trace to highlight correct step position on the editor
        if (message.command === 'variables' && this.mustFocusOnNextRefresh) {
            this.refreshFocus();
            return;
        }

        if (message.event !== 'invalidated') return;

        if (message.body.areas === undefined) {
            this.mustFocusOnNextRefresh = true;
            return;
        }

        for (const area of message.body.areas) {
            if (area === 'all' || area === 'threads' || area === 'stacks') {
                this.mustFocusOnNextRefresh = true;
                return;
            }
        }

    }

    private async refreshFocus() {
        // Pretty bad but hey, it works
        vscode.commands.executeCommand('workbench.debug.action.focusCallStackView');
        await new Promise<void>(resolve => setTimeout(() => {
            resolve()
        }, 100));
        vscode.commands.executeCommand('workbench.action.debug.callStackTop');
        this.mustFocusOnNextRefresh = false;
    }
}

/**
 * Factory for {@link SetBreakpointsDebugAdapterTracker}.
 */
export class SetBreakpointsDebugAdapterTrackerFactory implements vscode.DebugAdapterTrackerFactory {
    constructor(private domainSpecificBreakpointProvider: DomainSpecificBreakpointsProvider) { }

    public createDebugAdapterTracker(session: vscode.DebugSession): vscode.ProviderResult<vscode.DebugAdapterTracker> {
        return new SetBreakpointsDebugAdapterTracker(this.domainSpecificBreakpointProvider);
    }
}

/**
 * Listener for setBreakpoints debug adapter messages.
 */
export class SetBreakpointsDebugAdapterTracker implements vscode.DebugAdapterTracker {
    private requestSeq: number = NaN;
    private submittedSourceBreakpoints: DebugProtocol.SourceBreakpoint[] = [];
    private validatedSourceBreakpoints: DebugProtocol.SourceBreakpoint[] = [];

    constructor(private domainSpecificBreakpointProvider: DomainSpecificBreakpointsProvider) { }

    public async onWillReceiveMessage(message: any): Promise<void> {
        if (message.type !== 'request' || message.command !== 'setBreakpoints') return;

        const setBreakpointsRequest = message as DebugProtocol.SetBreakpointsRequest;
        // FIXME: not sufficient
        await this.domainSpecificBreakpointProvider.waitForInitialization();
        const isRequestOnDebuggedFile: boolean = (setBreakpointsRequest.arguments.source.path !== undefined && setBreakpointsRequest.arguments.source.path === this.domainSpecificBreakpointProvider.sourceFile) || (setBreakpointsRequest.arguments.source.path === undefined && setBreakpointsRequest.arguments.source.name === this.domainSpecificBreakpointProvider.sourceFile);
        if (!isRequestOnDebuggedFile) return;

        this.requestSeq = setBreakpointsRequest.seq;
        this.submittedSourceBreakpoints = setBreakpointsRequest.arguments.breakpoints !== undefined ? setBreakpointsRequest.arguments.breakpoints : [];
    }

    public async onDidSendMessage(message: any): Promise<void> {
        if (message.type !== 'response' || message.command !== 'setBreakpoints' || message.request_seq !== this.requestSeq) return;

        await this.domainSpecificBreakpointProvider.waitForInitialization();
        if (vscode.debug.activeDebugSession === undefined) throw new Error('Undefined debug session.');

        const setBreakpointsResponse = message as DebugProtocol.SetBreakpointsResponse;
        if (setBreakpointsResponse.body.breakpoints.length !== this.submittedSourceBreakpoints.length) throw new Error('Number of source breakpoints different in request and response.');
        const newValidatedSourceBreakpoints: DebugProtocol.SourceBreakpoint[] = [];
        const vscodeSourceBreakpointsOnFile: vscode.SourceBreakpoint[] = vscode.debug.breakpoints.filter(b => b instanceof vscode.SourceBreakpoint && b.location.uri.path === this.domainSpecificBreakpointProvider.sourceFile) as vscode.SourceBreakpoint[];
        const toRemove: vscode.Breakpoint[] = [];

        for (let i = 0; i < this.submittedSourceBreakpoints.length; i++) {
            if (!setBreakpointsResponse.body.breakpoints[i].verified) continue;

            const sourceBreakpoint: DebugProtocol.SourceBreakpoint = this.submittedSourceBreakpoints[i];
            newValidatedSourceBreakpoints.push(sourceBreakpoint);
            if (this.isAlreadyValidated(sourceBreakpoint)) continue;

            // pick type and additional arguments
            const args: GetModelElementReferenceFromSourceArguments = {
                sourceFile: this.domainSpecificBreakpointProvider.sourceFile,
                line: this.submittedSourceBreakpoints[i].line,
                column: this.submittedSourceBreakpoints[i].column!
            };
            const response: GetModelElementReferenceFromSourceResponse = await vscode.debug.activeDebugSession.customRequest('getModelElementReferenceFromSource', args);

            if (response.element === undefined) {
                toRemove.push(this.findVSCodeSourceBreakpoint(vscodeSourceBreakpointsOnFile, sourceBreakpoint.line - 1, sourceBreakpoint.column! - 1));
                continue;
            }

            const reference: ModelElementReference = response.element;
            const possibleBreakpointTypes: BreakpointType[] = [...this.domainSpecificBreakpointProvider.breakpointTypes.values()].filter(bt => bt.parameters.length > 0 && bt.parameters[0].type === "reference" && reference.types.includes(bt.parameters[0].elementType));

            const breakpointType: BreakpointType | undefined = await pickBreakpointType(possibleBreakpointTypes);
            if (breakpointType === undefined) {
                toRemove.push(this.findVSCodeSourceBreakpoint(vscodeSourceBreakpointsOnFile, sourceBreakpoint.line - 1, sourceBreakpoint.column! - 1));
                continue;
            }

            const values: Map<string, Value> = new Map();
            values.set(breakpointType.parameters[0].name, { type: 'reference', elementType: breakpointType.parameters[0].type, isMultivalued: false, content: reference });
            for (let j = 1; j < breakpointType.parameters.length; j++) {
                const value: Value | undefined = await pickValueForParameter(breakpointType.parameters[j]);
                if (value === undefined) {
                    toRemove.push(this.findVSCodeSourceBreakpoint(vscodeSourceBreakpointsOnFile, sourceBreakpoint.line - 1, sourceBreakpoint.column! - 1));
                    continue;
                }

                values.set(breakpointType.parameters[j].name, value);
            }

            await this.domainSpecificBreakpointProvider.addBreakpoint({ breakpointType: breakpointType, values: values });
        }

        this.validatedSourceBreakpoints = newValidatedSourceBreakpoints;
        this.requestSeq = NaN;
        vscode.debug.removeBreakpoints(toRemove);
    }

    private findVSCodeSourceBreakpoint(vscodeSourceBreakpointsOnFile: vscode.SourceBreakpoint[], line: number, column: number): vscode.SourceBreakpoint {
        const vscodeSourceBreakpoint: vscode.SourceBreakpoint | undefined = vscodeSourceBreakpointsOnFile.find(b => b.location.range.start.line === line && b.location.range.start.character === column);
        if (vscodeSourceBreakpoint === undefined) throw new Error('Could not find source breakpoint to remove.');

        return vscodeSourceBreakpoint;
    }

    private isAlreadyValidated(sourceBreakpoint: DebugProtocol.SourceBreakpoint): boolean {
        return this.validatedSourceBreakpoints.some(s => s.line === sourceBreakpoint.line && s.column === sourceBreakpoint.column);
    }
}