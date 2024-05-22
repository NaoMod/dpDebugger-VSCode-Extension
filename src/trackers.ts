import { DebugProtocol } from '@vscode/debugprotocol';
import * as vscode from 'vscode';
import { DomainSpecificBreakpointsFromSourceBreakpoint, GetDomainSpecificBreakpointsResponse, GetSourceBreakpointsTargetTypesResponse } from './DAPExtension';
import { DomainSpecificBreakpointsProvider } from './domainSpecificBreakpoints';
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

    constructor(private domainSpecificBreakpointProvider: DomainSpecificBreakpointsProvider) { }

    public async onWillReceiveMessage(message: any): Promise<void> {
        if (message.type !== 'request' || message.command !== 'setBreakpoints') return;

        const setBreakpointsRequest = message as DebugProtocol.SetBreakpointsRequest;
        await this.domainSpecificBreakpointProvider.waitForInitialization();
        const isRequestOnDebuggedFile: boolean = (setBreakpointsRequest.arguments.source.path !== undefined && setBreakpointsRequest.arguments.source.path === this.domainSpecificBreakpointProvider.sourceFile) || (setBreakpointsRequest.arguments.source.path === undefined && setBreakpointsRequest.arguments.source.name === this.domainSpecificBreakpointProvider.sourceFile);
        if (!isRequestOnDebuggedFile) return;

        this.requestSeq = setBreakpointsRequest.seq;
        this.submittedSourceBreakpoints = setBreakpointsRequest.arguments.breakpoints !== undefined ? setBreakpointsRequest.arguments.breakpoints : [];
    }

    // TODO: fix on first debug session
    public async onDidSendMessage(message: any): Promise<void> {
        if (message.type !== 'response' || message.command !== 'setBreakpoints' || message.request_seq !== this.requestSeq) return;

        const setBreakpointsResponse = message as DebugProtocol.SetBreakpointsResponse;
        if (setBreakpointsResponse.body.breakpoints.length !== this.submittedSourceBreakpoints.length) throw new Error('Number of source breakpoints different in request and response.');

        if (vscode.debug.activeDebugSession === undefined) throw new Error('Undefined debug session.');
        const sourceFile: string = vscode.debug.activeDebugSession.configuration.sourceFile;

        this.domainSpecificBreakpointProvider.sourceBreakpoints.clear();
        this.domainSpecificBreakpointProvider.domainSpecificBreakpoints = [];

        const getDomainSpecificBreakpointsResponse: GetDomainSpecificBreakpointsResponse = await vscode.debug.activeDebugSession.customRequest('getDomainSpecificBreakpoints', { sourceFile: sourceFile });

        for (let i = 0; i < this.submittedSourceBreakpoints.length; i++) {
            if (!setBreakpointsResponse.body.breakpoints[i].verified) continue;

            const sourceBreakpoint: DebugProtocol.SourceBreakpoint = this.submittedSourceBreakpoints[i];
            const sourceBreakpointId: number | undefined = setBreakpointsResponse.body.breakpoints[i].id;
            if (sourceBreakpointId === undefined) throw new Error('Undefined ID for verified source breakpoint.');

            const domainSpecificBreakpoint: DomainSpecificBreakpointsFromSourceBreakpoint | undefined = getDomainSpecificBreakpointsResponse.breakpoints.find(b => b.sourceBreakpointId === sourceBreakpointId);
            if (domainSpecificBreakpoint === undefined) throw new Error(`Undefined domain-specific breakpoint for source breakpoint ${sourceBreakpointId}.`);

            this.domainSpecificBreakpointProvider.sourceBreakpoints.set(sourceBreakpointId, sourceBreakpoint);
            this.domainSpecificBreakpointProvider.domainSpecificBreakpoints.push(domainSpecificBreakpoint);
        }

        const getSourceBreakpointTargetTypesResponse: GetSourceBreakpointsTargetTypesResponse = await vscode.debug.activeDebugSession.customRequest('getSourceBreakpointsTargetTypes', { sourceFile: sourceFile, sourceBreakpointsIds: this.domainSpecificBreakpointProvider.domainSpecificBreakpoints.map(b => b.sourceBreakpointId) });
        this.domainSpecificBreakpointProvider.sourceBreakpointsTargetTypes = getSourceBreakpointTargetTypesResponse.sourceBreakpointTargetTypes;

        this.domainSpecificBreakpointProvider.refresh(undefined);
    }
}