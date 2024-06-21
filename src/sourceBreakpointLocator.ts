import { DebugProtocol } from '@vscode/debugprotocol';
import * as vscode from 'vscode';

export function findVSCodeSourceBreakpoint(filePath: string, line: number, column: number): vscode.SourceBreakpoint |undefined {
    const vscodeSourceBreakpointsOnFile: vscode.SourceBreakpoint[] = vscode.debug.breakpoints.filter(b => b instanceof vscode.SourceBreakpoint && b.location.uri.path === filePath) as vscode.SourceBreakpoint[];
    const vscodeSourceBreakpoint: vscode.SourceBreakpoint | undefined = vscodeSourceBreakpointsOnFile.find(b => b.location.range.start.line === line && b.location.range.start.character === column);

    return vscodeSourceBreakpoint;
}

export function locationEqualsDAP(sb1: DebugProtocol.SourceBreakpoint, sb2: DebugProtocol.SourceBreakpoint): boolean {
    return sb1.line === sb2.line && sb1.column === sb2.column;
}

export function locationEqualsDAPAndVSCode(sb1: DebugProtocol.SourceBreakpoint, sb2: vscode.SourceBreakpoint): boolean {
    return sb1.line === sb2.location.range.start.line && sb1.column === sb2.location.range.start.character;
}