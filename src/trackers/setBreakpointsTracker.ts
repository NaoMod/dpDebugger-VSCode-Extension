import { DebugProtocol } from '@vscode/debugprotocol';
import * as vscode from 'vscode';
import { BreakpointType, GetModelElementReferenceFromSourceArguments, GetModelElementReferenceFromSourceResponse, ModelElementReference } from '../DAPExtension';
import { pickBreakpointType, pickValueForParameter } from '../breakpointValuesPicker';
import { DomainSpecificBreakpointsProvider, Value, ViewDomainSpecificBreakpoint } from '../domainSpecificBreakpoints';
import { locationEqualsDAP } from '../locationComparator';

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
    private submittedSourceBreakpoints: DebugProtocol.SourceBreakpoint[] = [];
    private validatedSourceBreakpoints: DebugProtocol.SourceBreakpoint[] = [];
    private treatedRequests: RequestQueue = new RequestQueue();

    constructor(private domainSpecificBreakpointProvider: DomainSpecificBreakpointsProvider) { }

    public async onWillReceiveMessage(message: any): Promise<void> {
        if (message.type !== 'request' || message.command !== 'setBreakpoints') return;
        const setBreakpointsRequest = message as DebugProtocol.SetBreakpointsRequest;

        await this.domainSpecificBreakpointProvider.waitForInitialization();
        const isRequestOnDebuggedFile: boolean = (setBreakpointsRequest.arguments.source.path !== undefined && setBreakpointsRequest.arguments.source.path === this.domainSpecificBreakpointProvider.sourceFile) || (setBreakpointsRequest.arguments.source.path === undefined && setBreakpointsRequest.arguments.source.name === this.domainSpecificBreakpointProvider.sourceFile);
        if (!isRequestOnDebuggedFile) {
            this.treatedRequests.setTreated(setBreakpointsRequest.seq, RequestStatus.NOT_RELEVANT);
            return;
        }

        await this.handleSetBreakpointsRequest(setBreakpointsRequest);
        this.treatedRequests.setTreated(setBreakpointsRequest.seq, RequestStatus.RELEVANT);
    }

    public async onDidSendMessage(message: any): Promise<void> {
        if (message.type !== 'response' || message.command !== 'setBreakpoints') return;
        const setBreakpointsResponse = message as DebugProtocol.SetBreakpointsResponse;

        const requestStatus: RequestStatus = await this.treatedRequests.waitForTreatment(setBreakpointsResponse.request_seq);
        if (requestStatus === RequestStatus.RELEVANT) await this.handleSetBreakpointsResponse(setBreakpointsResponse);
    }

    private async handleSetBreakpointsRequest(setBreakpointsRequest: DebugProtocol.SetBreakpointsRequest): Promise<void> {
        if (setBreakpointsRequest.arguments.breakpoints === undefined) {
            this.submittedSourceBreakpoints = [];
            return;
        }

        this.submittedSourceBreakpoints = setBreakpointsRequest.arguments.breakpoints;
        const domainSpecificBreakpointsToRemove: ViewDomainSpecificBreakpoint[] = [];

        for (const validatedSourceBreakpoint of this.validatedSourceBreakpoints) {
            if (setBreakpointsRequest.arguments.breakpoints.find(b => locationEqualsDAP(validatedSourceBreakpoint, b))) continue;

            const toRemove: ViewDomainSpecificBreakpoint | undefined = this.domainSpecificBreakpointProvider.findBreakpointFromSource(validatedSourceBreakpoint);
            if (toRemove !== undefined) domainSpecificBreakpointsToRemove.push(toRemove);
        }

        await this.domainSpecificBreakpointProvider.deleteBreakpoints(domainSpecificBreakpointsToRemove);
    }

    private async handleSetBreakpointsResponse(setBreakpointsResponse: DebugProtocol.SetBreakpointsResponse): Promise<void> {
        if (vscode.debug.activeDebugSession === undefined) throw new Error('Undefined debug session.');

        if (setBreakpointsResponse.body.breakpoints.length !== this.submittedSourceBreakpoints.length) throw new Error('Number of source breakpoints different in request and response.');
        const newValidatedSourceBreakpoints: DebugProtocol.SourceBreakpoint[] = [];
        const vscodeSourceBreakpointsOnFile: vscode.SourceBreakpoint[] = vscode.debug.breakpoints.filter(b => b instanceof vscode.SourceBreakpoint && b.location.uri.path === this.domainSpecificBreakpointProvider.sourceFile) as vscode.SourceBreakpoint[];
        const sourceBreakpointsToRemove: vscode.Breakpoint[] = [];
        const domainSpecificBreakpointsToRemove: ViewDomainSpecificBreakpoint[] = [];

        for (let i = 0; i < this.submittedSourceBreakpoints.length; i++) {
            const sourceBreakpoint: DebugProtocol.SourceBreakpoint = this.submittedSourceBreakpoints[i];

            if (!setBreakpointsResponse.body.breakpoints[i].verified) {
                const toRemove: ViewDomainSpecificBreakpoint | undefined = this.domainSpecificBreakpointProvider.findBreakpointFromSource(sourceBreakpoint);
                if (toRemove !== undefined) domainSpecificBreakpointsToRemove.push(toRemove);
                continue;
            }

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
                sourceBreakpointsToRemove.push(this.findVSCodeSourceBreakpoint(vscodeSourceBreakpointsOnFile, sourceBreakpoint.line - 1, sourceBreakpoint.column! - 1));
                continue;
            }

            const reference: ModelElementReference = response.element;
            const possibleBreakpointTypes: BreakpointType[] = [...this.domainSpecificBreakpointProvider.breakpointTypes.values()].filter(bt => bt.parameters.length > 0 && bt.parameters[0].type === "reference" && reference.types.includes(bt.parameters[0].elementType));

            const breakpointType: BreakpointType | undefined = await pickBreakpointType(possibleBreakpointTypes, sourceBreakpoint);
            if (breakpointType === undefined) {
                sourceBreakpointsToRemove.push(this.findVSCodeSourceBreakpoint(vscodeSourceBreakpointsOnFile, sourceBreakpoint.line - 1, sourceBreakpoint.column! - 1));
                continue;
            }

            const values: Map<string, Value> = new Map();
            values.set(breakpointType.parameters[0].name, { type: 'reference', elementType: breakpointType.parameters[0].type, isMultivalued: false, content: reference });
            for (let j = 1; j < breakpointType.parameters.length; j++) {
                const value: Value | undefined = await pickValueForParameter(breakpointType.parameters[j]);
                if (value === undefined) {
                    sourceBreakpointsToRemove.push(this.findVSCodeSourceBreakpoint(vscodeSourceBreakpointsOnFile, sourceBreakpoint.line - 1, sourceBreakpoint.column! - 1));
                    continue;
                }

                values.set(breakpointType.parameters[j].name, value);
            }

            await this.domainSpecificBreakpointProvider.addBreakpoints([{ breakpointType: breakpointType, values: values, sourceBreakpoint: sourceBreakpoint }]);
        }

        this.domainSpecificBreakpointProvider.deleteBreakpoints(domainSpecificBreakpointsToRemove);
        this.validatedSourceBreakpoints = newValidatedSourceBreakpoints;
        vscode.debug.removeBreakpoints(sourceBreakpointsToRemove);
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

class RequestQueue {
    private treated: Map<number, RequestStatus> = new Map();
    private requested: Map<number, (s: RequestStatus) => void> = new Map();

    public setTreated(requestSeq: number, status: RequestStatus): void {
        if (!this.requested.has(requestSeq)) {
            this.treated.set(requestSeq, status);
            return;
        }

        const resolve: (s: RequestStatus) => void = this.requested.get(requestSeq)!;
        this.requested.delete(requestSeq);
        resolve(status);
    }

    public async waitForTreatment(requestSeq: number): Promise<RequestStatus> {
        return new Promise<RequestStatus>(resolve => {
            if (this.treated.has(requestSeq)) {
                const status: RequestStatus = this.treated.get(requestSeq)!;
                this.treated.delete(requestSeq);
                resolve(status);
            } else {
                this.requested.set(requestSeq, resolve);
            }
        });
    }
}

enum RequestStatus {
    RELEVANT, NOT_RELEVANT
}