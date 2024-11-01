import { InsightError } from "./IInsightFacade";
import { Section, Room } from "./helperClass";

export class HelperFunction {
	public getParamNum(param: String, s: Section | Room): number {
		if (s instanceof Section) {
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
		} else if (s instanceof Room) {
			if (param === "lat") {
				return s.lat;
			}
			if (param === "lon") {
				return s.lon;
			}
			if (param === "seats") {
				return s.seats;
			}
		}

		throw new InsightError();
	}

	public getParamString(param: string, s: Section | Room): string {
		if (s instanceof Section) {
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
		} else if (s instanceof Room) {
			const result = this.getParamStringRoom(param, s);
			if (result !== "error") {
				return result;
			}
		}
		throw new InsightError("no valid param");
	}

	private getParamStringRoom(param: string, s: Room): string {
		if (param === "fullname") {
			return s.fullname;
		}
		if (param === "shortname") {
			return s.shortname;
		}
		if (param === "number") {
			return s.number;
		}
		if (param === "name") {
			return s.name;
		}
		if (param === "address") {
			return s.address;
		}
		if (param === "type") {
			return s.type;
		}
		if (param === "furniture") {
			return s.furniture;
		}
		if (param === "href") {
			return s.href;
		} else {
			return "error";
		}
	}

	public getParamAll(param: string, s: Section | Room): number | string {
		try {
			return this.getParamString(param, s);
		} catch {
			return this.getParamNum(param, s);
		}
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

	public async handleGreaterThan(
		where: any,
		sections: Section[] | Room[],
		queryId: string
	): Promise<Section[] | Room[]> {
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

		if (this.isSectionArray(sections)) {
			return sections.filter((s: Section) => this.getParamNum(param, s) > value) as Section[];
		} else if (this.isRoomArray(sections)) {
			return sections.filter((s: Room) => this.getParamNum(param, s) > value) as Room[];
		}

		throw new InsightError("Unexpected type in sections array");
	}

	public async handleLessThan(where: any, sections: Section[] | Room[], id: string): Promise<Section[] | Room[]> {
		const [key, value]: [string, unknown] = Object.entries(where.LT)[0];
		const [dataset, param] = key.split("_");

		if (dataset !== id) {
			throw new InsightError("");
		}
		if (typeof value !== "number" || isNaN(value)) {
			throw new InsightError("Invalid value type}");
		}

		if (this.isSectionArray(sections)) {
			return sections.filter((s: Section) => this.getParamNum(param, s) < value) as Section[];
		} else if (this.isRoomArray(sections)) {
			return sections.filter((s: Room) => this.getParamNum(param, s) < value) as Room[];
		}

		throw new InsightError("Unexpected type in sections array");
	}

	public async handleEqual(where: any, sections: Section[] | Room[], queryId: string): Promise<Section[] | Room[]> {
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
		if (this.isSectionArray(sections)) {
			return sections.filter((s: Section) => this.getParamNum(param, s) === value) as Section[];
		} else if (this.isRoomArray(sections)) {
			return sections.filter((s: Room) => this.getParamNum(param, s) === value) as Room[];
		}

		throw new InsightError("Unexpected type in sections array");
	}

	// Type guard for Section[]
	public isSectionArray(arr: any[]): arr is Section[] {
		return arr.every((item) => item instanceof Section);
	}

	// Type guard for Room[]
	public isRoomArray(arr: any[]): arr is Room[] {
		return arr.every((item) => item instanceof Room);
	}
}
