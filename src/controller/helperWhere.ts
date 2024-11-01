import { InsightError } from "./IInsightFacade";
import { Section, Room } from "./helperClass";
import { HelperFunction } from "./helperFunction";

export class HelperWhere {
	private hf = new HelperFunction();

	public async handleWhere(where: any, sections: Section[] | Room[], queryId: string): Promise<Section[] | Room[]> {
		// base case
		if (Object.keys(where).length === 0) {
			return sections;
		}
		if (where.AND || where.OR) {
			// handle logic comp
			return await this.handleLogicComp(where, sections, queryId);
		}
		if (where.NOT) {
			return await this.handleNegation(where, sections, queryId);
		}
		if (where.IS) {
			return await this.handleSComp(where, sections, queryId);
		}
		if (where.LT || where.GT || where.EQ) {
			return await this.handleMComp(where, sections, queryId);
		}

		throw new InsightError("invalid ebnf");
	}

	private async handleMComp(where: any, sections: Section[] | Room[], queryId: string): Promise<Section[] | Room[]> {
		// now we have list of sections with ID that we want
		if (where.GT) {
			return await this.hf.handleGreaterThan(where, sections, queryId);
		}
		if (where.LT) {
			return await this.hf.handleLessThan(where, sections, queryId);
		}

		if (where.EQ) {
			return await this.hf.handleEqual(where, sections, queryId);
		}
		throw new InsightError("no m comp");
	}

	private async handleSComp(where: any, sections: Section[] | Room[], queryId: string): Promise<Section[] | Room[]> {
		if (Object.keys(where.IS).length === 0) {
			throw new InsightError("Invalid Query Syntax for IS");
		}

		const [key, value]: [string, unknown] = Object.entries(where.IS)[0];
		const param = key.split("_")[1];
		const dataset = key.split("_")[0];
		if (dataset !== queryId) {
			throw new InsightError("");
		}

		if (typeof value !== "string") {
			throw new InsightError("invalid skey");
		}

		const valueType = this.hf.getValueType(value);

		// Use helper function to filter based on Section or Room type
		if (this.hf.isSectionArray(sections)) {
			return this.filterByComparison(sections, valueType, value, param) as Section[];
		} else if (this.hf.isRoomArray(sections)) {
			return this.filterByComparison(sections, valueType, value, param) as Room[];
		}

		throw new InsightError("Unexpected type in sections array");
		// let a: Section[] | Room[] = [];

		// if (this.hf.isSectionArray(sections)) {
		// 	a = sections.filter((s: Section) => {
		// 		const valueType = this.hf.getValueType(value);
		// 		const compareValue = this.hf.getParamString(param, s);
		// 		if (valueType === "startend") {
		// 			const newString = value.slice(1, -1);
		// 			return compareValue.includes(newString);
		// 		} else if (valueType === "start") {
		// 			const newString = value.slice(1);
		// 			// console.log(newString);
		// 			return compareValue.endsWith(newString);
		// 		} else if (valueType === "end") {
		// 			const newString = value.slice(0, -1);
		// 			return compareValue.startsWith(newString);
		// 		} else {
		// 			return compareValue === value;
		// 		}
		// 	}) as Section[];
		// } else if (this.hf.isRoomArray(sections)) {
		// 	a = sections.filter((s: Room) => {
		// 		const valueType = this.hf.getValueType(value);
		// 		const compareValue = this.hf.getParamString(param, s);
		// 		if (valueType === "startend") {
		// 			const newString = value.slice(1, -1);
		// 			return compareValue.includes(newString);
		// 		} else if (valueType === "start") {
		// 			const newString = value.slice(1);
		// 			// console.log(newString);
		// 			return compareValue.endsWith(newString);
		// 		} else if (valueType === "end") {
		// 			const newString = value.slice(0, -1);
		// 			return compareValue.startsWith(newString);
		// 		} else {
		// 			return compareValue === value;
		// 		}
		// 	}) as Room[];
		// }

		// return a;
	}

	private filterByComparison<T extends Section | Room>(
		items: T[],
		valueType: string,
		value: string,
		param: string
	): T[] {
		return items.filter((item) => {
			const compareValue = this.hf.getParamString(param, item);
			return this.compareValues(valueType, value, compareValue);
		});
	}

	private compareValues(valueType: string, value: string, compareValue: string): boolean {
		if (valueType === "startend") {
			const newString = value.slice(1, -1);
			return compareValue.includes(newString);
		} else if (valueType === "start") {
			const newString = value.slice(1);
			return compareValue.endsWith(newString);
		} else if (valueType === "end") {
			const newString = value.slice(0, -1);
			return compareValue.startsWith(newString);
		} else {
			return compareValue === value;
		}
	}

	private async handleLogicComp(
		where: any,
		sections: Section[] | Room[],
		queryId: string
	): Promise<Section[] | Room[]> {
		// where.LOGIC is an array, e.g. ( { AND: [ { GT: [Object] }, { IS: [Object] } ] } )
		// therefore filteredSections in handleOr and handleAnd stores the result of each recursion of each branches inside the where.LOGIC

		if (where.OR) {
			return this.handleOr(where, sections, queryId);
		}

		if (where.AND) {
			return this.handleAnd(where, sections, queryId);
		}

		throw new InsightError(`Invalid logical operator: ${where[0]}`);
	}

	private async handleOr(where: any, sections: Section[] | Room[], queryId: string): Promise<Section[] | Room[]> {
		if (where.OR.length === 0) {
			throw new InsightError("Invalid Query Syntax");
		}

		const orPromises = where.OR.map(async (condition: any) => this.handleWhere(condition, sections, queryId));

		const filteredSections = await Promise.all(orPromises);

		const flattenedSections = filteredSections.flat();

		if (this.hf.isSectionArray(flattenedSections) && this.hf.isSectionArray(sections)) {
			return sections.filter((s: Section) => flattenedSections.includes(s));
		} else if (this.hf.isRoomArray(flattenedSections) && this.hf.isRoomArray(sections)) {
			return sections.filter((s: Room) => flattenedSections.includes(s));
		}
		throw new InsightError("invalid kind");
	}

	private async handleAnd(where: any, sections: Section[] | Room[], queryId: string): Promise<Section[] | Room[]> {
		if (where.AND.length === 0) {
			throw new InsightError("Invalid Query Syntax");
		}

		const andPromises = where.AND.map(async (condition: any) => this.handleWhere(condition, sections, queryId));

		const filteredSections = await Promise.all(andPromises);

		if (this.hf.isSectionArray(sections)) {
			return sections.filter((section) =>
				filteredSections.every((filtered) => filtered.includes(section))
			) as Section[];
		} else if (this.hf.isRoomArray(sections)) {
			return sections.filter((section) => filteredSections.every((f) => f.includes(section))) as Room[];
		}

		throw new InsightError("no valid kind");
		//return sections.filter((section) => filteredSections.every((filtered) => filtered.includes(section))) as Section[] | Room[];
	}

	private async handleNegation(where: any, sections: Section[] | Room[], id: string): Promise<Section[] | Room[]> {
		const filteredSections = await this.handleWhere(where.NOT, sections, id);
		if (this.hf.isSectionArray(filteredSections) && this.hf.isSectionArray(sections)) {
			return sections.filter((s: Section) => {
				return !filteredSections.includes(s);
			}) as Section[];
		} else if (this.hf.isRoomArray(filteredSections) && this.hf.isRoomArray(sections)) {
			return sections.filter((s: Room) => {
				return !filteredSections.includes(s);
			}) as Room[];
		}
		return [];
	}
}
