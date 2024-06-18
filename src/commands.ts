import { BreakpointType } from './DAPExtension';
import { pickBreakpointType, pickSingleBoolean, pickSingleNumber, pickSingleReference, pickSingleString, pickValueForParameter, pickValueForSingleParameter } from "./breakpointValuesPicker";
import { ArrayEntryTreeItem, DomainSpecificBreakpointTreeItem, DomainSpecificBreakpointsProvider, SingleValue, SingleValueTreeItem, Value } from "./domainSpecificBreakpoints";


export function addBreakpoint(provider: DomainSpecificBreakpointsProvider): () => Promise<void> {
    return async () => {
        const breakpointType: BreakpointType | undefined = await pickBreakpointType([...provider.breakpointTypes.values()]);
        if (breakpointType === undefined) return;

        const values: Map<string, Value> = new Map();
        for (const parameter of breakpointType.parameters) {
            const value: Value | undefined = await pickValueForParameter(parameter);
            if (value === undefined) return;

            values.set(parameter.name, value);
        }

        await provider.addBreakpoint({ breakpointType: breakpointType, values: values });
    };
}

export function removeBreakpoint(provider: DomainSpecificBreakpointsProvider): (item: DomainSpecificBreakpointTreeItem) => Promise<void> {
    return async (item: DomainSpecificBreakpointTreeItem) => {
        await provider.deleteBreakpoint(item.breakpoint);
    };
}

export async function changeSingleParameterValue(item: SingleValueTreeItem): Promise<void> {
    const newValue: SingleValue | undefined = await pickValueForSingleParameter(item.parameter);
    if (newValue === undefined) return;

    item.changeValue(newValue);
    item.refresh();
}

export async function changeArrayEntry(item: ArrayEntryTreeItem): Promise<void> {
    const title: string = `Select New Value for ${item.parameter.name}[${item.index}]`;
    let newValue: SingleValue | undefined = undefined;

    if (item.parameter.type === 'reference') {
        newValue = await pickSingleReference(title, item.parameter.elementType);
    } else {
        switch (item.parameter.primitiveType) {
            case 'boolean':
                newValue = await pickSingleBoolean(title);
                break;

            case 'number':
                newValue = await pickSingleNumber(title);
                break;

            case 'string':
                newValue = await pickSingleString(title);
                break;
        }
    }

    if (newValue === undefined) return;
    item.changeValue(newValue);
    item.refresh();
}

