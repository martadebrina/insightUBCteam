import { InsightDatasetKind, InsightError } from "./IInsightFacade";

export class Datasets {
	// private datasetMap: Map<string, DatasetInfo>;

	public sections: Section[];
	public numRows: number;
	public kind: InsightDatasetKind;

	constructor() {
		this.sections = [];
		this.numRows = 0;
		this.kind = InsightDatasetKind.Sections;
	}

	public addSection(newCourse: Section): void {
		++this.numRows;
		this.sections.push(newCourse);
	}
}

export class Section {
	// private sectionList: any[];

	public uuid: string;
	public id: string;
	public title: string;
	public instructor: string;
	public dept: string;
	public year: number;
	public avg: number;
	public pass: number;
	public fail: number;
	public audit: number;

	constructor(section: any) {
		// check if section is valid
		if (!this.isValidSection(section)) {
			throw new InsightError("Undefined variable -> invalid section");
		}
		try {
			this.uuid = String(section.id);
			this.id = String(section.Course);
			this.title = String(section.title);
			this.instructor = String(section.Professor);
			this.dept = String(section.Subject);
			if (section.Section === "overall") {
				this.year = 1900;
			} else {
				this.year = this.anyToNum(section.Year);
			}
			this.avg = this.anyToNum(section.Avg);
			this.pass = this.anyToNum(section.Pass);
			this.fail = this.anyToNum(section.Fail);
			this.audit = this.anyToNum(section.Audit);
		} catch (_err) {
			throw new InsightError("invalid variable type");
		}
	}

	public isValidSection(c: any): boolean {
		return (
			c.id === undefined ||
			c.Course === undefined ||
			c.title === undefined ||
			c.Professor === undefined ||
			c.Subject === undefined ||
			c.Section === undefined ||
			c.Year === undefined ||
			c.Avg === undefined ||
			c.Pass === undefined ||
			c.Fail === undefined ||
			c.Audit === undefined
		);
	}

	public anyToNum(n: any): number {
		const num = Number(n);
		if (isNaN(num)) {
			throw new InsightError("n is not a number");
		}
		return num;
	}
}
