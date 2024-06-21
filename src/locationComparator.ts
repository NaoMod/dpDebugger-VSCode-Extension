import { DebugProtocol } from '@vscode/debugprotocol';
import * as vscode from 'vscode';

export function locationEqualsDAP(sb1: DebugProtocol.SourceBreakpoint, sb2: DebugProtocol.SourceBreakpoint): boolean {
    return sb1.line === sb2.line && sb1.column === sb2.column;
}

export function locationEqualsDAPAndVSCode(sb1: DebugProtocol.SourceBreakpoint, sb2: vscode.SourceBreakpoint): boolean {
    return sb1.line === sb2.location.range.start.line && sb1.column === sb2.location.range.start.character;
}