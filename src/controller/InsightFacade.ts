import {
	IInsightFacade,
	InsightDataset,
	InsightDatasetKind,
	InsightResult,
	NotFoundError,
	InsightError,
} from "./IInsightFacade";
import JSZip, { loadAsync } from "jszip";
import * as fs from "fs-extra";
// import * as path from "path";

class Datasets {
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

class Section {
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

export default class InsightFacade implements IInsightFacade {
	private datasets = new Map<string, Datasets>();

	public async addDataset(id: string, content: string, kind: InsightDatasetKind): Promise<string[]> {
		await this.loadDatasetsFromDisk();

		if (!this.isValidId(id)) {
			throw new InsightError("Invalid id");
		}

		if (kind !== InsightDatasetKind.Sections) {
			throw new InsightError("kind not valid");
		}

		if (this.datasets.has(id)) {
			throw new InsightError("Dataset already exists");
		}

		let zipData: JSZip;
		try {
			zipData = await loadAsync(content, { base64: true });
			const files = zipData.folder("courses");
			if (!files) {
				throw new InsightError("no courses folder");
			}
			if (files.length === 0) {
				throw new InsightError("no content in files");
			}
			await this.parseZipFile(id, zipData, this.datasets);
		} catch (_err) {
			throw new InsightError("Fail to unzip");
		}

		return Array.from(this.datasets.keys());
	}

	public async removeDataset(id: string): Promise<string> {
		await this.loadDatasetsFromDisk();

		if (!this.isValidId(id)) {
			throw new InsightError("Invalid id");
		}

		if (!this.datasets.has(id)) {
			throw new NotFoundError("cannot find id");
		}

		this.datasets.delete(id);

		await this.saveDatasetsDisk(this.datasets);

		return id;
	}

	public async listDatasets(): Promise<InsightDataset[]> {
		await this.loadDatasetsFromDisk();

		const insightDatasetList: InsightDataset[] = [];
		const datasetList = this.datasets.entries();

		for (const [id, dataset] of datasetList) {
			// from chatGPT (next 5 lines)
			const insightDataset: InsightDataset = {
				id: id,
				kind: dataset.kind,
				numRows: dataset.numRows,
			};
			insightDatasetList.push(insightDataset);
		}
		return insightDatasetList;
	}

	public async performQuery(query: unknown): Promise<InsightResult[]> {
		// load from disk
		await this.loadDatasetsFromDisk();

		// console.log(query);

		// go through the query (from chatGPT)
		const { WHERE, OPTIONS } = query as any;

		// check valid WHERE and valid OPTION
		if (!WHERE || !OPTIONS) {
			throw new InsightError("invalid format");
		}

		// get id from first element of column
		const queryId = await this.getQueryId(OPTIONS);

		const foundDataset = this.datasets.get(queryId);
		// no dataset with id found
		if (!foundDataset) {
			throw new InsightError("reference not found");
		}
		const filtered = await this.handleWhere(WHERE, foundDataset.sections, queryId);

		// handle OPTIONS
		// const result = await this.handleOptions(OPTIONS, filtered);

		throw new Error(`InsightFacadeImpl::performQuery() is unimplemented! - query=${query};`);
	}

	private async getQueryId(options: any): Promise<string> {
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

	private async handleWhere(where: any, sections: Section[], queryId: string): Promise<Section[]> {
		// Todo: traverse the BODY

		// base case
		if (where.length === 0) {
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
		// now we have list of sections with ID yang dimau
		if (where.GT) {
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
		if (where.LT) {
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

		if (where.EQ) {
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
				return this.getParamNum(param, s) > value;
			});
		}

		throw new InsightError("no m comp");
	}

	private async handleSComp(where: any, sections: Section[], queryId: string): Promise<Section[]> {
		const [key, value]: [string, unknown] = Object.entries(where.IS)[0];
		const param = key.split("_")[1];
		const dataset = key.split("_")[0];
		if (dataset !== queryId) {
			throw new InsightError("");
		}
		// console.log(param);
		if (typeof value !== "string") {
			throw new InsightError(`Invalid value type for ${key}. Expected a string but got ${typeof value}`);
		}
		const a = sections.filter((s) => {
			const valueType = this.getValueType(value);
			const compareValue = this.getParamString(param, s);
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
			} else if (valueType === "normal") {
				return compareValue === value;
			}
		});
		// console.log(a);
		return a;
	}

	private getValueType(value: string): string {
		if (value.startsWith("*") && value.endsWith("*")) {
			const newString = value.slice(1, -1);
			if (newString.includes("*")) {
				throw new InsightError("");
			}
			return "startend";
		} else if (value.startsWith("*")) {
			const newString = value.slice(1);
			if (newString.includes("*")) {
				throw new InsightError("");
			}
			return "start";
		} else if (value.endsWith("*")) {
			const newString = value.slice(0, -1);
			if (newString.includes("*")) {
				throw new InsightError("");
			}
			return "end";
		} else if (value.includes("*")) {
			throw new InsightError("");
		} else {
			return "normal";
		}
	}

	private getParamString(param: String, s: Section): string {
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

	private async handleLogicComp(where: any, sections: Section[], queryId: string): Promise<Section[]> {
		return sections;
	}

	private async handleNegation(where: any, sections: Section[], queryId: string): Promise<Section[]> {
		// filter the sections

		const filteredSections = await this.handleWhere(where.NOT, sections, queryId);
		return sections.filter((s: Section) => {
			return !filteredSections.includes(s);
		});
	}

	private isValidId(id: string): boolean {
		const trimmedId = id.trim();
		return trimmedId.length > 0 && !trimmedId.includes("_") && !trimmedId.includes(" ");
	}

	private async loadDatasetsFromDisk(): Promise<void> {
		const exist = await fs.pathExists("./data/Datasets.json");

		if (!exist) {
			return;
		}

		const datasetArray: [string, Datasets][] = await fs.readJSON("./data/Datasets.json");

		// this.datasets.clear();

		for (const [id, dataset] of datasetArray) {
			if (this.datasets.has(id)) {
				continue;
			}
			const newData = new Datasets();
			newData.sections = dataset.sections;
			newData.numRows = dataset.numRows;
			newData.kind = dataset.kind;
			this.datasets.set(id, newData);
		}
		// console.log(this.datasets);
	}

	private async parseZipFile(id: string, zip: JSZip, datasets: Map<string, Datasets>): Promise<void> {
		const dumpDatasets = new Datasets();
		const zipContent = zip.files;
		const keyContent = Object.keys(zipContent);
		const filteredContent = keyContent.filter((checkPath: string) => {
			return checkPath.startsWith("courses/") && checkPath !== "courses/";
		});

		const listPromises = filteredContent.map(async (checkPath) => {
			const file = zip.file(checkPath);
			if (file) {
				const stringContent = await file.async("string");
				return JSON.parse(stringContent).result;
			}
		});

		const fulfillPromises = await Promise.all(listPromises);

		for (const course of fulfillPromises) {
			for (const section of course) {
				const dumpSection = new Section(section);
				dumpDatasets.addSection(dumpSection);
			}
		}
		if (dumpDatasets.sections.length === 0) {
			throw new InsightError("");
		}

		// set map
		datasets.set(id, dumpDatasets);

		await this.saveDatasetsDisk(datasets);
	}

	private async saveDatasetsDisk(datasets: Map<String, Datasets>): Promise<void> {
		// Convert Map to an object before writing, from chatGPT
		const datasetsArray = Array.from(datasets.entries());
		// console.log(this.datasets);

		await fs.ensureDir("./data");

		await fs.writeJSON("./data/Datasets.json", datasetsArray);
	}

	private getParamNum(param: String, s: Section): number {
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
			return s.year;
		}
		if (param === "audit") {
			return s.audit;
		}
		throw new InsightError();
	}
}
