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
		await this.loadDatasetsFromDisk();

		// console.log(query);

		// go through the json (from chatGPT)
		const { WHERE, OPTIONS } = query as any;

		if (!WHERE || !OPTIONS) {
			throw new InsightError("invalid format");
		}

		const queryId = await this.getQueryId(query);
		if (!this.datasets.has(queryId)) {
			throw new InsightError("No dataset found");
		}

		// const foundDataset = this.datasets.get(queryId);
		// WHERE
		// const filtered = await this.handleWhere(WHERE, this.datasets.get(queryId).sections);

		// OPTIONS
		// const result = await this.handleOptions(OPTIONS, filtered);

		throw new Error(`InsightFacadeImpl::performQuery() is unimplemented! - query=${query};`);
	}

	// private async getQueryId(query: unknown): Promise<string> {
	// 	// TODO!!!
	// 	return "";
	// }

	// private async handleWhere(WHERE: any, dataset: Section[]): Promise<Section[]> {
	// 	return [];
	// }

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
}
