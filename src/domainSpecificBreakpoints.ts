import { DebugProtocol } from '@vscode/debugprotocol';
import * as vscode from 'vscode';
import { BreakpointParameter, BreakpointType, ModelElementReference, SetDomainSpecificBreakpointsArguments, SetDomainSpecificBreakpointsResponse } from './DAPExtension';
import { findVSCodeSourceBreakpoint, locationEqualsDAP } from './sourceBreakpointLocator';
import { valuesToEntries } from './transformations';
import { TreeDataProvider, TreeItem } from './treeItem';

/**
 * Data provider for the 'Domain-Specific Breakpoints' view.
 */
export class DomainSpecificBreakpointsProvider extends TreeDataProvider {
    private _sourceFile: string = '';
    private memorizedDomainSpecificBreakpoints: ViewDomainSpecificBreakpoint[] = [];
    private enabledBreakpoints: ViewDomainSpecificBreakpoint[] = [];
    public breakpointTypes: Map<string, BreakpointType> = new Map();

    /** Current status regarding the initialization of the runtime. */
    private initializationStatus: InitializationStatus = new InitializationStatus();

    public async getChildren(element?: TreeItem<TreeDataProvider> | undefined): Promise<TreeItem<TreeDataProvider>[] | null | undefined> {
        if (element) return element.getChildren();

        return this.memorizedDomainSpecificBreakpoints.map((breakpoint, i) => new DomainSpecificBreakpointTreeItem(breakpoint, i.toString(), this.enabledBreakpoints.includes(breakpoint), this));
    }

    /**
     * Requests the creation of a new domain-specific breakpoint.
     * Refreshes the content of the view.
     * 
     * @param breakpoint Breakpoint to create.
     */
    public async addBreakpoints(breakpoints: ViewDomainSpecificBreakpoint[]): Promise<void> {
        const requestedDomainSpecificBreakpoints: ViewDomainSpecificBreakpoint[] = [...this.enabledBreakpoints, ...breakpoints];
        const verifiedDomainSpecificBreakpoints: ViewDomainSpecificBreakpoint[] = await this.requestBreakpointsCreation(requestedDomainSpecificBreakpoints);
        this.enabledBreakpoints = verifiedDomainSpecificBreakpoints;
        this.memorizedDomainSpecificBreakpoints = this.updateMemorizedBreakpoints(this.memorizedDomainSpecificBreakpoints, requestedDomainSpecificBreakpoints, verifiedDomainSpecificBreakpoints);
        this.refresh(undefined);
    }

    /**
     * Deletes an existing domain-specific breakpoint.
     * Refreshes the content of the view.
     * 
     * @param breakpoint Breakpoint to delete.
     */
    public async deleteBreakpoints(breakpoints: ViewDomainSpecificBreakpoint[], removeSourceBreakpoints: boolean): Promise<void> {
        this.memorizedDomainSpecificBreakpoints = this.domainSpecificBreakpoints.filter(b => !breakpoints.includes(b));
        const requestedDomainSpecificBreakpoints: ViewDomainSpecificBreakpoint[] = this.enabledBreakpoints.filter(b => !breakpoints.includes(b));
        const verifiedDomainSpecificBreakpoints: ViewDomainSpecificBreakpoint[] = await this.requestBreakpointsCreation(requestedDomainSpecificBreakpoints);
        this.enabledBreakpoints = verifiedDomainSpecificBreakpoints;
        this.memorizedDomainSpecificBreakpoints = this.updateMemorizedBreakpoints(this.memorizedDomainSpecificBreakpoints, requestedDomainSpecificBreakpoints, verifiedDomainSpecificBreakpoints);

        if (removeSourceBreakpoints) {
            const sourceBreakpointsToRemove: vscode.Breakpoint[] = [];
            for (const breakpoint of breakpoints) {
                if (breakpoint.sourceBreakpoint === undefined) continue;
    
                const vscodeSourceBreakpoint: vscode.SourceBreakpoint | undefined = findVSCodeSourceBreakpoint(this.sourceFile, breakpoint.sourceBreakpoint.line - 1, breakpoint.sourceBreakpoint.column! - 1);
                if (vscodeSourceBreakpoint === undefined) throw new Error('Could not find source breakpoint.');
    
                sourceBreakpointsToRemove.push(vscodeSourceBreakpoint);
            }
            
            vscode.debug.removeBreakpoints(sourceBreakpointsToRemove);
        }

        this.refresh(undefined);
    }

    /**
     * Enables an existing domain-specific breakpoint.
     * Refreshes the content of the view.
     * 
     * @param breakpoint Breakpoint to enable.
     */
    public async enableBreakpoint(breakpoint: ViewDomainSpecificBreakpoint): Promise<void> {
        if (this.enabledBreakpoints.includes(breakpoint)) return;

        const requestedDomainSpecificBreakpoints: ViewDomainSpecificBreakpoint[] = [...this.enabledBreakpoints, breakpoint];
        const verifiedDomainSpecificBreakpoints: ViewDomainSpecificBreakpoint[] = await this.requestBreakpointsCreation(requestedDomainSpecificBreakpoints);
        this.enabledBreakpoints = verifiedDomainSpecificBreakpoints;
        this.memorizedDomainSpecificBreakpoints = this.updateMemorizedBreakpoints(this.memorizedDomainSpecificBreakpoints, requestedDomainSpecificBreakpoints, verifiedDomainSpecificBreakpoints);
        this.refresh(undefined);
    }

    /**
     * Disables an existing domain-specific breakpoint.
     * Refreshes the content of the view.
     * 
     * @param breakpoint Breakpoint to disable.
     */
    public async disableBreakpoint(breakpoint: ViewDomainSpecificBreakpoint): Promise<void> {
        if (!this.enabledBreakpoints.includes(breakpoint)) return;

        const requestedDomainSpecificBreakpoints: ViewDomainSpecificBreakpoint[] = this.enabledBreakpoints.filter(b => b !== breakpoint);
        const verifiedDomainSpecificBreakpoints: ViewDomainSpecificBreakpoint[] = await this.requestBreakpointsCreation(requestedDomainSpecificBreakpoints);
        this.enabledBreakpoints = verifiedDomainSpecificBreakpoints;
        this.memorizedDomainSpecificBreakpoints = this.updateMemorizedBreakpoints(this.memorizedDomainSpecificBreakpoints, requestedDomainSpecificBreakpoints, verifiedDomainSpecificBreakpoints);
        this.refresh(undefined);
    }

    public findBreakpointFromSource(sourceBreakpoint: DebugProtocol.SourceBreakpoint): ViewDomainSpecificBreakpoint | undefined {
        if (sourceBreakpoint.column === undefined) return undefined;

        //TODO: check source file
        return this.memorizedDomainSpecificBreakpoints.find(b => b.sourceBreakpoint !== undefined && locationEqualsDAP(sourceBreakpoint, b.sourceBreakpoint));
    }

    public async validateBreakpoints(): Promise<void> {
        await this.requestBreakpointsCreation(this.enabledBreakpoints);
    }

    public initialize(sourceFile: string, breakpointTypes: BreakpointType[]): void {
        this._sourceFile = sourceFile;
        this.breakpointTypes.clear();
        for (const breakpointType of breakpointTypes) {
            this.breakpointTypes.set(breakpointType.id, breakpointType);
        }
        this.initializationStatus.setTrue();
    }

    public terminate(): void {
        this._sourceFile = '';
        this.memorizedDomainSpecificBreakpoints = [];
        this.breakpointTypes.clear();
        this.enabledBreakpoints = [];
        this.initializationStatus = new InitializationStatus();
    }


    /**
     * Waits for the initialization of the runtime to be completed.
     */
    public async waitForInitialization(): Promise<void> {
        return this.initializationStatus.wait();
    }

    public get domainSpecificBreakpoints(): ViewDomainSpecificBreakpoint[] {
        return Array.from(this.memorizedDomainSpecificBreakpoints);
    }

    public get sourceFile(): string {
        return this._sourceFile;
    }

    private updateMemorizedBreakpoints(memorizedBreakpoints: ViewDomainSpecificBreakpoint[], requestedBreakpoints: ViewDomainSpecificBreakpoint[], verifiedBreakpoints: ViewDomainSpecificBreakpoint[]): ViewDomainSpecificBreakpoint[] {
        const disabledBreakpoints: ViewDomainSpecificBreakpoint[] = memorizedBreakpoints.filter(b => !requestedBreakpoints.includes(b));

        return [...disabledBreakpoints, ...verifiedBreakpoints];
    }

    private async requestBreakpointsCreation(requestedDomainSpecificBreakpoints: ViewDomainSpecificBreakpoint[]): Promise<ViewDomainSpecificBreakpoint[]> {
        if (vscode.debug.activeDebugSession === undefined) throw new Error('Undefined debug session.');

        const args: SetDomainSpecificBreakpointsArguments = {
            sourceFile: vscode.debug.activeDebugSession.configuration.sourceFile,
            breakpoints: requestedDomainSpecificBreakpoints.map(b => ({
                breakpointTypeId: b.breakpointType.id,
                entries: valuesToEntries(b.values)
            }))
        };
        const response: SetDomainSpecificBreakpointsResponse = await vscode.debug.activeDebugSession.customRequest('setDomainSpecificBreakpoints', args);
        if (requestedDomainSpecificBreakpoints.length !== response.breakpoints.length) throw new Error(`Requested the creation of ${requestedDomainSpecificBreakpoints.length} breakpoints, but got a response for ${response.breakpoints.length}.`);


        const newDomainSpecificBreakpoints: ViewDomainSpecificBreakpoint[] = [];
        for (let i = 0; i < requestedDomainSpecificBreakpoints.length; i++) {
            if (response.breakpoints[i].verified) newDomainSpecificBreakpoints.push(requestedDomainSpecificBreakpoints[i]);
        }

        if (newDomainSpecificBreakpoints.length < requestedDomainSpecificBreakpoints.length) vscode.window.showErrorMessage(`${requestedDomainSpecificBreakpoints.length - newDomainSpecificBreakpoints.length} breakpoints could not be set.`);

        return newDomainSpecificBreakpoints;
    }
}

export type ViewDomainSpecificBreakpoint = {
    breakpointType: BreakpointType;
    values: Map<string, Value>;
    sourceBreakpoint?: DebugProtocol.SourceBreakpoint;
}

export class DomainSpecificBreakpointTreeItem extends TreeItem<DomainSpecificBreakpointsProvider> {
    readonly breakpoint: ViewDomainSpecificBreakpoint;

    constructor(breakpoint: ViewDomainSpecificBreakpoint, label: string, isEnabled: boolean, provider: DomainSpecificBreakpointsProvider) {
        super(label, provider, vscode.TreeItemCollapsibleState.Collapsed);
        this.breakpoint = breakpoint;
        this.description = breakpoint.breakpointType.name;
        this.checkboxState = isEnabled ? vscode.TreeItemCheckboxState.Checked : vscode.TreeItemCheckboxState.Unchecked;
        this.contextValue = 'breakpoint';
    }

    public getChildren(): TreeItem<TreeDataProvider>[] | null | undefined {
        return this.breakpoint.breakpointType.parameters.map(p => {
            const value: Value | undefined = this.breakpoint.values.get(p.name);
            if (value === undefined) throw new Error(`Undefined value for parameter ${p.name}.`);

            return value.isMultivalued ? new ArrayValueTreeItem(p, value, this._provider) : new SingleValueTreeItem(p, value, this._provider);
        });
    }
}

export abstract class ValueTreeItem extends TreeItem<DomainSpecificBreakpointsProvider> {
    readonly parameter: BreakpointParameter;

    constructor(parameter: BreakpointParameter, label: string, provider: DomainSpecificBreakpointsProvider, description?: string) {
        super(label, provider, parameter.isMultivalued ? vscode.TreeItemCollapsibleState.Collapsed : undefined);
        this.description = description;
        this.parameter = parameter;
    }
}

export class SingleValueTreeItem extends ValueTreeItem {
    private value: SingleValue;

    constructor(parameter: BreakpointParameter, value: SingleValue, provider: DomainSpecificBreakpointsProvider) {
        const label: string = parameter.type === 'primitive' ? `${parameter.name}: ${parameter.primitiveType}` : `${parameter.name}: ${parameter.elementType}`;
        const description: string = value.type === 'primitive' ? JSON.stringify(value.content) : value.content.label;

        super(parameter, label, provider, description);
        this.value = value;
        this.contextValue = 'singleParameterValue';
    }

    public getChildren(): TreeItem<TreeDataProvider>[] | null | undefined {
        return undefined;
    }

    public changeValue(newValue: SingleValue): void {
        if (this.value.type !== newValue.type) return;
        if (this.value.type === 'primitive' && newValue.type === 'primitive' && this.value.primitiveType !== newValue.primitiveType) return;
        if (this.value.type === 'reference' && newValue.type === 'reference' && this.value.elementType !== newValue.elementType) return;

        this.value.content = newValue.content;
        this.description = this.value.type === 'primitive' ? JSON.stringify(this.value.content) : this.value.content.label;
    }
}

export class ArrayValueTreeItem extends ValueTreeItem {
    private value: ArrayValue;

    constructor(parameter: BreakpointParameter, value: ArrayValue, provider: DomainSpecificBreakpointsProvider) {
        const label: string = parameter.type === 'primitive' ? `${parameter.name}: ${parameter.primitiveType}[]` : `${parameter.name}: ${parameter.elementType}[]`;
        super(parameter, label, provider);
        this.value = value;
    }

    public getChildren(): TreeItem<TreeDataProvider>[] | null | undefined {
        return this.value.content.map((_, i) => new ArrayEntryTreeItem(this.parameter, this.value, i, this._provider));
    }
}

export class ArrayEntryTreeItem extends ValueTreeItem {
    readonly index: number;
    private array: ArrayValue;

    constructor(parameter: BreakpointParameter, array: ArrayValue, index: number, provider: DomainSpecificBreakpointsProvider) {
        const label: string = array.type === 'primitive' ? `${index}: ${array.content[index]}` : `${index}: ${array.content[index].label}`;
        super(parameter, label, provider);
        this.index = index;
        this.array = array;
        this.description = array.type === 'primitive' ? JSON.stringify(array.content[index]) : array.content[index].label;
        this.contextValue = 'arrayEntry';
    }

    public getChildren(): TreeItem<TreeDataProvider>[] | null | undefined {
        return undefined;
    }

    public changeValue(newValue: SingleValue): void {
        if (this.array.type !== newValue.type) return;
        if (this.array.type === 'primitive' && newValue.type === 'primitive' && this.array.primitiveType !== newValue.primitiveType) return;
        if (this.array.type === 'reference' && newValue.type === 'reference' && this.array.elementType !== newValue.elementType) return;

        this.array.content[this.index] = newValue.content;
        this.description = this.array.type === 'primitive' ? JSON.stringify(this.array.content[this.index]) : this.array.content[this.index].label;
    }
}

export type Value = ArrayValue | SingleValue;

export type ArrayValue = PrimitiveArrayValue | ReferenceArrayValue;

export type PrimitiveArrayValue = BooleanArrayValue | NumberArrayValue | StringArrayValue;

export type BooleanArrayValue = {
    type: 'primitive';
    primitiveType: 'boolean';
    isMultivalued: true;
    content: boolean[];
}

export type NumberArrayValue = {
    type: 'primitive';
    primitiveType: 'number';
    isMultivalued: true;
    content: number[];
}

export type StringArrayValue = {
    type: 'primitive';
    primitiveType: 'string';
    isMultivalued: true;
    content: string[];
}

export type ReferenceArrayValue = {
    type: 'reference';
    elementType: string;
    isMultivalued: true;
    content: ModelElementReference[];
}

export type SingleValue = PrimitiveSingleValue | ReferenceSingleValue;

export type PrimitiveSingleValue = BooleanSingleValue | NumberSingleValue | StringSingleValue;

export type BooleanSingleValue = {
    type: 'primitive';
    primitiveType: 'boolean';
    isMultivalued: false;
    content: boolean;
}

export type NumberSingleValue = {
    type: 'primitive';
    primitiveType: 'number';
    isMultivalued: false;
    content: number;
}

export type StringSingleValue = {
    type: 'primitive';
    primitiveType: 'string';
    isMultivalued: false;
    content: string;
}

export type ReferenceSingleValue = {
    type: 'reference';
    elementType: string;
    isMultivalued: false;
    content: ModelElementReference;
}

class InitializationStatus {
    private done: boolean = false;
    private resolveFuncs: (() => void)[] = [];

    public setTrue(): void {
        this.done = true;
        this.resolveFuncs.forEach(resolve => resolve());
        this.resolveFuncs = [];
    }

    public async wait(): Promise<void> {
        return new Promise<void>(resolve => {
            if (this.done) {
                resolve();
            } else {
                this.resolveFuncs.push(resolve);
            }
        });
    }
}