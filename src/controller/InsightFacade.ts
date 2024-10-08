import {
	IInsightFacade,
	InsightDataset,
	InsightDatasetKind,
	InsightResult,
	// NotFoundError,
	InsightError,
} from "./IInsightFacade";
import JSZip, { loadAsync } from "jszip";
import * as fs from "fs-extra";
// import * as path from "path";

class Datasets {
	// private datasetMap: Map<string, DatasetInfo>;

	public courses: Course[];
	public numRows: number;
	private kind: InsightDatasetKind;

	constructor() {
		this.courses = [];
		this.numRows = 0;
		this.kind = InsightDatasetKind.Sections;
	}

	public addCourse(newCourse: Course): void {
		this.courses.push(newCourse);
		++this.numRows;
	}
	// public addDatasets(courses: Course[], numRows: number, kind: InsightDatasetKind): void {
	// 	this.datasetMap.set(id, datasetInfo);
	// }

	// public getDataset(): DDatasatasetInfo | undefined {
	// 	return this.dataset.get(id);
	// }

	// public getAllDatasets(): Map<string, DatasetInfo> {
	// 	return this.datasetMap;
	// }
}

class Course {
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
		// check undefined variable
		if (!this.undefinedCheck(section)) {
			// console.log("err1");
			throw new InsightError("Undefined variable");
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
			// console.log("err2");
			throw new InsightError("invalid variable type");
		}
	}
	public undefinedCheck(c: any): boolean {
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

	// public addSection(section: any): void {
	// 	this.sectionList.push(section);
	// }

	// public setSections(sections: any[]): void {
	// 	this.sectionList = sections;
	// }

	// public getSections(): any[] {
	// 	return this.sectionList;
	// }
}

export default class InsightFacade implements IInsightFacade {
	private datasets = new Map<string, Datasets>();

	public async addDataset(id: string, content: string, kind: InsightDatasetKind): Promise<string[]> {
		if (!this.isValidId(id)) {
			throw new InsightError("Invalid id");
		}

		// verify content
		// const base64regex = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/;
		// if (base64regex.test(content)) {
		// 	throw new InsightError("content not base64");
		// }

		// verify kind
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

		// proses zip

		// fs.writeJSON("/data/datasets.json", this.datasets);

		return Array.from(this.datasets.keys());
	}

	public async removeDataset(id: string): Promise<string> {
		return id;
	}

	public async performQuery(query: unknown): Promise<InsightResult[]> {
		throw new Error(`InsightFacadeImpl::performQuery() is unimplemented! - query=${query};`);
	}

	public async listDatasets(): Promise<InsightDataset[]> {
		// return this.getDatasetList();
		return [];
	}

	private isValidId(id: string): boolean {
		const trimmedId = id.trim();
		return trimmedId.length > 0 && !trimmedId.includes("_") && !trimmedId.includes(" ");
	}

	private async loadDatasetsFromDisk(): Promise<void> {
		throw new Error("Function not implemented.");
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
				const dumpCourse = new Course(section);
				dumpDatasets.addCourse(dumpCourse);
				// try {
				// 	const dumpCourse = new Course(section);
				// 	console.log(dumpCourse);
				// 	dumpDatasets.addCourse(dumpCourse);
				// 	// console.log("msuk2");
				// } catch (error) {
				// 	continue;
				// }
			}
		}
		if (dumpDatasets.courses.length === 0) {
			throw new InsightError("");
		}
		// console.log(dumpDatasets.courses);

		// set map
		datasets.set(id, dumpDatasets);
		// Convert Map to an object before writing
		const datasetsArray = Array.from(datasets.entries());

		// Ensure the directory exists
		await fs.ensureDir("./data");

		await fs.writeJSON(`./data/Datasets.json`, datasetsArray);
	}
}
