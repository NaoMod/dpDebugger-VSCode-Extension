import { DebugProtocol } from '@vscode/debugprotocol';
import * as vscode from 'vscode';
import { BreakpointType, DomainSpecificBreakpoint } from './DAPExtension';
import { LeafTreeItem, TreeDataProvider, TreeItem } from './treeItem';

/**
 * Data provider for the 'Domain-Specific Breakpoints' view.
 */
export class DomainSpecificBreakpointsProvider extends TreeDataProvider {
    private _sourceFile: string = '';
    public enabledStandaloneBreakpointTypes: Set<string> = new Set();
    public domainSpecificBreakpoints: DomainSpecificBreakpoint[] = [];
    public sourceBreakpoints: Map<number, DebugProtocol.SourceBreakpoint> = new Map();
    public breakpointTypes: Map<string, BreakpointType> = new Map();

    /** Current status regarding the initialization of the runtime. */
    private initializationStatus: InitializationStatus = new InitializationStatus();

    public async getChildren(element?: TreeItem<TreeDataProvider> | undefined): Promise<TreeItem<TreeDataProvider>[] | null | undefined> {
        if (element) return element.getChildren();

        return [new DomainSpecificBreakpointsList(this), new StandaloneBreakpointTypesList(this)];
    }

    public initialize(sourceFile: string): void {
        this._sourceFile = sourceFile;
        this.initializationStatus.setTrue();
    }

    /**
     * Waits for the initialization of the runtime to be completed.
     */
    public async waitForInitialization(): Promise<void> {
        return this.initializationStatus.wait();
    }

    public get sourceFile(): string {
        return this._sourceFile;
    }
}

class DomainSpecificBreakpointsList extends TreeItem<DomainSpecificBreakpointsProvider> {
    constructor(provider: DomainSpecificBreakpointsProvider) {
        super('Source Breakpoints', provider, vscode.TreeItemCollapsibleState.Collapsed);
    }

    public getChildren(): TreeItem<TreeDataProvider>[] | null | undefined {
        return this._provider.domainSpecificBreakpoints.map(breakpoint => new DomainSpecificBreakpointTreeItem(breakpoint, this._provider));
    }
}

class DomainSpecificBreakpointTreeItem extends TreeItem<DomainSpecificBreakpointsProvider> {
    private domainSpecificBreakpoint: DomainSpecificBreakpoint;

    constructor(domainSpecificBreakpoint: DomainSpecificBreakpoint, provider: DomainSpecificBreakpointsProvider) {
        const fileNameStart: number = provider.sourceFile.lastIndexOf('/');
        const fileName: string = provider.sourceFile.substring(fileNameStart + 1);
        const sourceBreakpoint: DebugProtocol.SourceBreakpoint | undefined = provider.sourceBreakpoints.get(domainSpecificBreakpoint.sourceBreakpointId);
        if (sourceBreakpoint === undefined || sourceBreakpoint.column === undefined) throw new Error(`Problem with source breakpoint ${domainSpecificBreakpoint.sourceBreakpointId}.`);
        const command: vscode.Command = {
            command: 'focusLine',
            title: 'Focus Line',
            arguments: [provider.sourceFile, sourceBreakpoint.line]
        };
        super(fileName, provider, vscode.TreeItemCollapsibleState.Collapsed, command);
        this.domainSpecificBreakpoint = domainSpecificBreakpoint;
        this.description = `(${sourceBreakpoint.line}:${sourceBreakpoint.column})`;
    }

    public getChildren(): TreeItem<TreeDataProvider>[] | null | undefined {
        const matchingBreakpointTypes: BreakpointType[] = Array.from(this._provider.breakpointTypes.values()).filter(breakpointType => breakpointType.targetElementType !== undefined && this.domainSpecificBreakpoint.targetElementTypes.includes(breakpointType.targetElementType));

        return matchingBreakpointTypes.map(breakpointType => {
            const isEnabled: boolean = this.domainSpecificBreakpoint.enabledBreakpointTypeIds.includes(breakpointType.id);
            return new ParameterizedBreakpointTypeTreeItem(this.domainSpecificBreakpoint.sourceBreakpointId, breakpointType.targetElementType!, breakpointType.id, breakpointType.name, isEnabled, this._provider, breakpointType.description);
        });
    }
}

class StandaloneBreakpointTypesList extends TreeItem<DomainSpecificBreakpointsProvider> {

    constructor(provider: DomainSpecificBreakpointsProvider) {
        super('Standalone Breakpoint Types', provider, vscode.TreeItemCollapsibleState.Collapsed);
    }

    public getChildren(): TreeItem<TreeDataProvider>[] | null | undefined {
        return Array.from(this._provider.breakpointTypes.values()).filter(breakpointType => breakpointType.targetElementType === undefined).map(standaloneBreakpointType => new StandaloneBreakpointTypeTreeItem(
            standaloneBreakpointType.id,
            standaloneBreakpointType.name,
            this._provider.enabledStandaloneBreakpointTypes.has(standaloneBreakpointType.id),
            this._provider,
            standaloneBreakpointType.description
        ));
    }
}

export abstract class BreakpointTypeTreeItem extends LeafTreeItem {
    readonly breakpointTypeId: string;
    readonly isStandalone: boolean;

    constructor(breakpointTypeId: string, name: string, isEnabled: boolean, isStandalone: boolean, provider: DomainSpecificBreakpointsProvider, description?: string) {
        super(name, isEnabled, provider, description);
        this.breakpointTypeId = breakpointTypeId;
        this.isStandalone = isStandalone;
    }
}

export class ParameterizedBreakpointTypeTreeItem extends BreakpointTypeTreeItem {
    readonly sourceBreakpointId: number;
    readonly targetElementType: string;

    constructor(sourceBreakpointId: number, targetElementType: string, breakpointTypeId: string, name: string, isEnabled: boolean, provider: DomainSpecificBreakpointsProvider, description?: string) {
        super(breakpointTypeId, name, isEnabled, false, provider, description);
        this.sourceBreakpointId = sourceBreakpointId;
        this.targetElementType = targetElementType;
    }
}

export class StandaloneBreakpointTypeTreeItem extends BreakpointTypeTreeItem {
    constructor(breakpointTypeId: string, name: string, isEnabled: boolean, provider: DomainSpecificBreakpointsProvider, description?: string) {
        super(breakpointTypeId, name, isEnabled, true, provider, description);
    }
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