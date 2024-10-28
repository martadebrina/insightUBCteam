import { InsightError } from "./IInsightFacade";
import { Section } from "./helperClass";

export class HelperFunction {
	public getParamNum(param: String, s: Section): number {
		if (param === "year") {
			return s.year;
		}
		if (param === "avg") {
			return s.avg;
		}
		if (param === "pass") {
			return s.pass;
		}
		if (param === "fail") {
			return s.fail;
		}
		if (param === "audit") {
			return s.audit;
		}
		throw new InsightError();
	}

	public getParamString(param: String, s: Section): string {
		if (param === "uuid") {
			return s.uuid;
		}
		if (param === "id") {
			return s.id;
		}
		if (param === "title") {
			return s.title;
		}
		if (param === "instructor") {
			return s.instructor;
		}
		if (param === "dept") {
			return s.dept;
		}

		throw new InsightError("no valid param");
	}

	public getParamAll(param: String, s: Section): number | string {
		if (typeof param === "string") {
			return this.getParamString(param, s);
		}
		if (typeof param === "number") {
			return this.getParamNum(param, s);
		}
		throw new InsightError("no valid param");
	}

	public async getQueryId(options: any): Promise<string> {
		// TODO: return dataset id from first element of column
		// check for no column and empty column
		const columns = options.COLUMNS as any;
		if (!columns) {
			throw new InsightError("no columns");
		}
		if (columns.length === 0) {
			throw new InsightError("column is empty");
		}
		const id = columns[0].split("_")[0];
		return id;
	}

	public isValidId(id: string): boolean {
		const trimmedId = id.trim();
		return trimmedId.length > 0 && !trimmedId.includes("_") && !trimmedId.includes(" ");
	}

	public getValueType(value: string): string {
		if (value.startsWith("*") && value.endsWith("*")) {
			const newString = value.slice(1, -1);
			if (newString.includes("*")) {
				throw new InsightError("Invalid wildcards filter: * found in the middle");
			}
			return "startend";
		} else if (value.startsWith("*")) {
			const newString = value.slice(1);
			if (newString.includes("*")) {
				throw new InsightError("Invalid wildcards filter: * found in the middle");
			}
			return "start";
		} else if (value.endsWith("*")) {
			const newString = value.slice(0, -1);
			if (newString.includes("*")) {
				throw new InsightError("Invalid wildcards filter: * found in the middle");
			}
			return "end";
		} else if (value.includes("*")) {
			throw new InsightError("Invalid wildcards filter: * found in the middle");
		} else {
			return "normal";
		}
	}

	public async handleGreaterThan(where: any, sections: Section[], queryId: string): Promise<Section[]> {
		const [key, value]: [string, unknown] = Object.entries(where.GT)[0];
		const param = key.split("_")[1];
		const dataset = key.split("_")[0];
		if (dataset !== queryId) {
			throw new InsightError("");
		}
		if (typeof value !== "number") {
			throw new InsightError(`Invalid value type for ${key}. Expected a number but got ${typeof value}`);
		}

		if (isNaN(value)) {
			throw new InsightError(`Invalid value for ${key}. NaN is not allowed.`);
		}

		return sections.filter((s) => {
			return this.getParamNum(param, s) > value;
		});
	}

	public async handleLessThan(where: any, sections: Section[], queryId: string): Promise<Section[]> {
		const [key, value]: [string, unknown] = Object.entries(where.LT)[0];
		const param = key.split("_")[1];
		const dataset = key.split("_")[0];
		if (dataset !== queryId) {
			throw new InsightError("");
		}
		// console.log(param);
		if (typeof value !== "number") {
			throw new InsightError(`Invalid value type for ${key}. Expected a number but got ${typeof value}`);
		}

		if (isNaN(value)) {
			throw new InsightError(`Invalid value for ${key}. NaN is not allowed.`);
		}

		return sections.filter((s) => {
			return this.getParamNum(param, s) < value;
		});
	}

	public async handleEqual(where: any, sections: Section[], queryId: string): Promise<Section[]> {
		const [key, value]: [string, unknown] = Object.entries(where.EQ)[0];
		const param = key.split("_")[1];
		const dataset = key.split("_")[0];
		if (dataset !== queryId) {
			throw new InsightError("");
		}
		// console.log(param);
		if (typeof value !== "number") {
			throw new InsightError(`Invalid value type for ${key}. Expected a number but got ${typeof value}`);
		}

		if (isNaN(value)) {
			throw new InsightError(`Invalid value for ${key}. NaN is not allowed.`);
		}
		return sections.filter((s) => {
			return this.getParamNum(param, s) === value;
		});
	}
}
