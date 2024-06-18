import { Entries } from "./DAPExtension";
import { Value } from "./domainSpecificBreakpoints";

export function valuesToEntries(values: Map<string, Value>): Entries {
    let res: Entries = {};

    for (const entry of values.entries()) {
        if (entry[1].type === 'reference') {
            res[entry[0]] = entry[1].isMultivalued ? entry[1].content.map(c => c.id) : entry[1].content.id;
            break;
        }

        res[entry[0]] = entry[1].content;
    }

    return res;
}