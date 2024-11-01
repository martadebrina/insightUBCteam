import { InsightError, InsightResult } from "./IInsightFacade";
import { Room, Section } from "./helperClass";
import { HelperFunction } from "./helperFunction";
import { HelperSort } from "./helperSort";

//type SR = Section | Room;

export class HelperTransformation {
	private hf = new HelperFunction();
	private hs = new HelperSort();

	public async handleTransformation(trans: any, sections: Section[] | Room[]): Promise<any[]> {
		// Validate query since the process will be long and we don't want errors
		if (!trans.GROUP || trans.GROUP.length === 0 || !trans.APPLY) {
			throw new InsightError("invalid ebnf");
		}
		const group: string[] = trans.GROUP.map((item: string) => {
			return item.split("_")[1];
		});

		// each string[] here can contain distinct strings, for example when
		// group by instructor and title, we will have ["Jean", "310"], ["Casey", "310"],
		// ["Kelly", "210"], and so on.
		// the Section[] will contain all the filtered sections that qualifies
		const groupedData = new Map<string, Section[] | Room[]>();

		sections.forEach((section) => {
			// group is ["instructor", "title"]

			// datagroup example is ["Jean", "310"], there will be many
			const dataList: (string | number)[] = [];

			group.forEach((col) => {
				// dataName example "Jean", "310", 87.7
				const dataName = this.hf.getParamAll(col, section);
				//console.log(dataName);
				dataList.push(dataName);
			});

			//console.log(dataList);

			const tryAccessMapElement = groupedData.get(JSON.stringify(dataList));
			//console.log(tryAccessMapElement);
			if (tryAccessMapElement) {
				// dataList found, just need to add the section
				//console.log("hi");
				tryAccessMapElement.push(section as any);
			} else {
				// undefined since key does not exist
				groupedData.set(JSON.stringify(dataList), [section as any]);
			}
		});
		// Notice that 1 section can only be at one group, so this algorithm is possible

		//console.log(groupedData);

		const result = this.handleApply(trans.APPLY, groupedData as any, trans.GROUP);

		//console.log(result);

		return result;
	}

	private handleApply(apply: any[], groupedData: Map<string, Section[]>, group: string): any[] {
		// one result will be {groupKey1: Value1 , groupKey2: Value2, new_col1: agg1, new_col2: agg2, ...}
		const results: any[] = [];

		// process each groupedData one by one
		groupedData.forEach((sections, groupKey) => {
			// Make a record to keep results of applyRule,
			// preserve each Record <new_col1, resultof{"MIN" : s_key}>
			const applyResult: Record<string, any> = {};

			//console.log(groupKey);

			// Add group keys to result, they will be the new_col s
			(JSON.parse(groupKey) as (string | number)[]).forEach((key, index) => {
				applyResult[group[index]] = key; // Match group key to its corresponding group name
			});

			// Apply each rule to get the result in form of compacted fields,
			// the result of each aggregation {"MIN" : s_key} will be filled
			apply.forEach((applyRule) => {
				const applyKey = Object.keys(applyRule)[0];
				const operation = Object.keys(applyRule[applyKey])[0];
				const targetKey = applyRule[applyKey][operation].split("_")[1];
				applyResult[applyKey] = this.performAggregation(operation, targetKey, sections);
			});

			// then we push one result
			results.push(applyResult);
		});

		return results;
	}

	// Helper function to handle aggregation logic
	private performAggregation(operation: string, param: string, sections: Section[]): number {
		switch (operation) {
			case "MAX":
				return Math.max(...sections.map((s) => this.hf.getParamNum(param, s)));
			case "MIN":
				return Math.min(...sections.map((s) => this.hf.getParamNum(param, s)));
			case "AVG":
				return sections.reduce((acc, s) => acc + this.hf.getParamNum(param, s), 0) / sections.length;
			case "SUM":
				return sections.reduce((acc, s) => acc + this.hf.getParamNum(param, s), 0);
			case "COUNT":
				return new Set(sections.map((s) => this.hf.getParamAll(param, s))).size;
			default:
				throw new InsightError(`Invalid APPLYTOKEN: ${operation}`);
		}
	}

	public async handleTransOptions(options: any, filtered: any[], queryId: string): Promise<InsightResult[]> {
		const { COLUMNS, ORDER } = options;

		// Assume filtered is now transformed data if TRANSFORMATIONS applied
		const results: InsightResult[] = filtered.map((item) => {
			const result: any = {};

			// Handle each column in the result
			COLUMNS.forEach((column: string) => {
				if (Object.prototype.hasOwnProperty.call(item, column)) {
					result[column] = item[column];
				} else {
					throw new InsightError(`Column ${column} not found in transformed dataset.`);
				}
			});

			return result;
		});

		// Apply ORDER if it exists
		if (ORDER) {
			this.hs.sortResults(results, ORDER, queryId, COLUMNS);
		}

		return results;
	}
}
