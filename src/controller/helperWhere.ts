import { InsightError } from "./IInsightFacade";
import { Section } from "./helperClass";
import { HelperFunction } from "./helperFunction";

export class HelperWhere {
	private hf = new HelperFunction();

	public async handleWhere(where: any, sections: Section[], queryId: string): Promise<Section[]> {
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

	private async handleMComp(where: any, sections: Section[], queryId: string): Promise<Section[]> {
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

	private async handleSComp(where: any, sections: Section[], queryId: string): Promise<Section[]> {
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
		const a = sections.filter((s) => {
			const valueType = this.hf.getValueType(value);
			const compareValue = this.hf.getParamString(param, s);
			if (valueType === "startend") {
				const newString = value.slice(1, -1);
				return compareValue.includes(newString);
			} else if (valueType === "start") {
				const newString = value.slice(1);
				// console.log(newString);
				return compareValue.endsWith(newString);
			} else if (valueType === "end") {
				const newString = value.slice(0, -1);
				return compareValue.startsWith(newString);
			} else {
				return compareValue === value;
			}
		});

		return a;
	}

	private async handleLogicComp(where: any, sections: Section[], queryId: string): Promise<Section[]> {
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

	private async handleOr(where: any, sections: Section[], queryId: string): Promise<Section[]> {
		if (where.OR.length === 0) {
			throw new InsightError("Invalid Query Syntax");
		}

		const orPromises = where.OR.map(async (condition: any) => this.handleWhere(condition, sections, queryId));

		const filteredSections = await Promise.all(orPromises);

		// check whether the section is found in one of the filteredSections members
		function sectionChecker(s: Section): boolean {
			for (const x of filteredSections) {
				if (x.includes(s)) {
					return true;
				}
			}
			return false;
		}

		return sections.filter((s: Section) => {
			return sectionChecker(s);
		});
	}

	private async handleAnd(where: any, sections: Section[], queryId: string): Promise<Section[]> {
		if (where.AND.length === 0) {
			throw new InsightError("Invalid Query Syntax");
		}

		const andPromises = where.AND.map(async (condition: any) => this.handleWhere(condition, sections, queryId));

		const filteredSections = await Promise.all(andPromises);

		return sections.filter((section) => filteredSections.every((filtered) => filtered.includes(section)));
	}

	private async handleNegation(where: any, sections: Section[], queryId: string): Promise<Section[]> {
		const filteredSections = await this.handleWhere(where.NOT, sections, queryId);
		return sections.filter((s: Section) => {
			return !filteredSections.includes(s);
		});
	}
}
