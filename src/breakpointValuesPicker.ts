import { DebugProtocol } from '@vscode/debugprotocol';
import * as vscode from 'vscode';
import { BreakpointParameter, BreakpointType, GetModelElementsReferencesArguments, GetModelElementsReferencesResponse, ModelElementReference } from './DAPExtension';
import { ArrayValue, BooleanArrayValue, BooleanSingleValue, NumberArrayValue, NumberSingleValue, ReferenceArrayValue, ReferenceSingleValue, SingleValue, StringArrayValue, StringSingleValue, Value } from './domainSpecificBreakpoints';

export async function pickBreakpointType(breakpointTypes: BreakpointType[], sourceBreakpoint?: DebugProtocol.SourceBreakpoint): Promise<BreakpointType | undefined> {
    const quickPickItems: CustomQuickPickItem<BreakpointType>[] = breakpointTypes.map(bt => ({ label: bt.name, element: bt }));
    const title: string = sourceBreakpoint === undefined ? 'Select Breakpoint Type' : `Select Breakpoint Type for Breakpoint at (${sourceBreakpoint.line}:${sourceBreakpoint.column})`;
    const pickedBreakpointType: CustomQuickPickItem<BreakpointType> | undefined = await vscode.window.showQuickPick(quickPickItems, { title: title });
    if (pickedBreakpointType === undefined) return;

    return pickedBreakpointType.element;
}

export async function pickValueForParameter(parameter: BreakpointParameter): Promise<Value | undefined> {
    return parameter.isMultivalued ? pickValuesForArrayParameter(parameter) : pickValueForSingleParameter(parameter);
}

export async function pickValueForSingleParameter(parameter: BreakpointParameter): Promise<SingleValue | undefined> {
    if (parameter.isMultivalued) return undefined;

    if (parameter.type === 'primitive') {
        const title: string = `Select Value for Parameter '${parameter.name}'`;

        switch (parameter.primitiveType) {
            case 'boolean':
                return pickSingleBoolean(title);

            case 'number':
                return pickSingleNumber(title);

            case 'string':
                return pickSingleString(title);
        }
    }

    const title: string = parameter.isMultivalued ? `Select Values for Parameter '${parameter.name}'` : `Select Value for Parameter '${parameter.name}'`;
    return pickSingleReference(title, parameter.elementType);
}

export async function pickValuesForArrayParameter(parameter: BreakpointParameter): Promise<ArrayValue | undefined> {
    if (!parameter.isMultivalued) return undefined;

    if (parameter.type === 'primitive') {
        const title: string = `Select Values for Parameter '${parameter.name}'`;
        switch (parameter.primitiveType) {
            case 'boolean':
                return pickMultipleBooleans(title);

            case 'number':
                return pickMultipleNumbers(title);

            case 'string':
                return pickMultipleStrings(title);
        }
    }

    const title: string = parameter.isMultivalued ? `Select Values for Parameter '${parameter.name}'` : `Select Value for Parameter '${parameter.name}'`;
    return pickMultipleReferences(title, parameter.elementType);
}

export async function pickSingleBoolean(title: string): Promise<BooleanSingleValue | undefined> {
    const booleanString: string | undefined = await vscode.window.showQuickPick(['true', 'false'], { title: title });
    if (booleanString === 'true') return { type: 'primitive', primitiveType: 'boolean', isMultivalued: false, content: true };
    if (booleanString === 'false') return { type: 'primitive', primitiveType: 'boolean', isMultivalued: false, content: false };
    return undefined;
}

export async function pickSingleNumber(title: string): Promise<NumberSingleValue | undefined> {
    const numberString: string | undefined = await vscode.window.showInputBox({
        title: title,
        validateInput(value) {
            return validateNumber(value);
        }
    });

    if (numberString === undefined || isNaN(+numberString)) return undefined;
    return { type: 'primitive', primitiveType: 'number', isMultivalued: false, content: +numberString };
}

export async function pickSingleString(title: string): Promise<StringSingleValue | undefined> {
    const string: string | undefined = await vscode.window.showInputBox({ title: title });

    if (string === undefined) return undefined;
    return { type: 'primitive', primitiveType: 'string', isMultivalued: false, content: string };
}

export async function pickSingleReference(title: string, elementType: string): Promise<ReferenceSingleValue | undefined> {
    if (vscode.debug.activeDebugSession === undefined) throw new Error('Undefined debug session.');
    const sourceFile: string = vscode.debug.activeDebugSession.configuration.sourceFile;

    const args: GetModelElementsReferencesArguments = { sourceFile: sourceFile, type: elementType };
    const response: GetModelElementsReferencesResponse = await vscode.debug.activeDebugSession.customRequest('getModelElementsReferences', args);
    const quickPickItems: CustomQuickPickItem<ModelElementReference>[] = response.elements.map(e => ({ label: e.label, element: e }));

    const pickedElement: CustomQuickPickItem<ModelElementReference> | undefined = await vscode.window.showQuickPick(quickPickItems, { title: title, canPickMany: false });
    if (pickedElement === undefined) return undefined;

    return { type: 'reference', elementType: elementType, isMultivalued: false, content: pickedElement.element };
}

export async function pickMultipleBooleans(title: string): Promise<BooleanArrayValue | undefined> {
    const booleanArrayString: string | undefined = await vscode.window.showInputBox({
        title: title,
        value: '[]',
        validateInput(value) {
            return validateBooleanArray(value);
        }
    });

    if (booleanArrayString === undefined) return undefined;
    return { type: 'primitive', primitiveType: 'boolean', isMultivalued: true, content: JSON.parse(booleanArrayString) };
}

export async function pickMultipleNumbers(title: string): Promise<NumberArrayValue | undefined> {
    const numberArrayString: string | undefined = await vscode.window.showInputBox({
        title: title,
        value: '[]',
        validateInput(value) {
            return validateNumberArray(value);
        }
    });

    if (numberArrayString === undefined) return undefined;
    return { type: 'primitive', primitiveType: 'number', isMultivalued: true, content: JSON.parse(numberArrayString) };
}

export async function pickMultipleStrings(title: string): Promise<StringArrayValue | undefined> {
    const stringArrayString: string | undefined = await vscode.window.showInputBox({
        title: title,
        value: '[]',
        validateInput(value) {
            return validateStringArray(value);
        }
    });

    if (stringArrayString === undefined) return undefined;
    return { type: 'primitive', primitiveType: 'string', isMultivalued: true, content: JSON.parse(stringArrayString) };
}

export async function pickMultipleReferences(title: string, elementType: string): Promise<ReferenceArrayValue | undefined> {
    if (vscode.debug.activeDebugSession === undefined) throw new Error('Undefined debug session.');
    const sourceFile: string = vscode.debug.activeDebugSession.configuration.sourceFile;

    const args: GetModelElementsReferencesArguments = { sourceFile: sourceFile, type: elementType };
    const response: GetModelElementsReferencesResponse = await vscode.debug.activeDebugSession.customRequest('getModelElementsReferences', args);
    const quickPickItems: CustomQuickPickItem<ModelElementReference>[] = response.elements.map(e => ({ label: e.label, element: e }));

    const pickedElements: CustomQuickPickItem<ModelElementReference>[] | undefined = await vscode.window.showQuickPick(quickPickItems, { title: title, canPickMany: true });
    if (pickedElements === undefined) return undefined;

    return { type: 'reference', elementType: elementType, isMultivalued: true, content: pickedElements.map(e => e.element) };
}

function validateNumber(value: string): vscode.InputBoxValidationMessage | undefined {
    if (!isNaN(+value)) return undefined;

    return {
        message: 'Value is not a number',
        severity: vscode.InputBoxValidationSeverity.Error
    };
}

function validateBooleanArray(value: string): vscode.InputBoxValidationMessage | undefined {
    const booleanArrayRegex: RegExp = /^\[\s*((true|false)(\s*,\s*(true|false))*)?\s*\]$/;
    if (booleanArrayRegex.test(value)) return undefined;

    return {
        message: 'Value is not a boolean array.',
        severity: vscode.InputBoxValidationSeverity.Error
    };
}

function validateNumberArray(value: string): vscode.InputBoxValidationMessage | undefined {
    const error: vscode.InputBoxValidationMessage = {
        message: 'Value is not a number array.',
        severity: vscode.InputBoxValidationSeverity.Error
    };

    try {
        const possibleNumberArray: any = JSON.parse(value);

        if (Array.isArray(possibleNumberArray) && possibleNumberArray.every(n => !isNaN(n))) return undefined;
        return error;

    } catch (err: any) {
        return error;
    }
}

function validateStringArray(value: string): vscode.InputBoxValidationMessage | undefined {

    const error: vscode.InputBoxValidationMessage = {
        message: 'Value is not a number array.',
        severity: vscode.InputBoxValidationSeverity.Error
    };

    try {
        const possibleStringArray: any = JSON.parse(value);

        if (Array.isArray(possibleStringArray) && possibleStringArray.every(s => typeof s === 'string')) return undefined;
        return error;

    } catch (err: any) {
        return error;
    }
}

class CustomQuickPickItem<T> implements vscode.QuickPickItem {
    readonly label: string;
    readonly element: T;

    constructor(label: string, element: T) {
        this.label = label;
        this.element = element;
    }
}