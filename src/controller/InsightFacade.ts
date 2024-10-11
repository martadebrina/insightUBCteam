import {
	IInsightFacade,
	InsightDataset,
	InsightDatasetKind,
	InsightResult,
	NotFoundError,
	InsightError,
	ResultTooLargeError,
} from "./IInsightFacade";
import JSZip, { loadAsync } from "jszip";
import * as fs from "fs-extra";
import { Datasets, Section } from "./helperClass";
import { HelperFunction } from "./helperFunction";
// import * as path from "path";

export default class InsightFacade implements IInsightFacade {
	private datasets = new Map<string, Datasets>();
	private hf = new HelperFunction();

	public async addDataset(id: string, content: string, kind: InsightDatasetKind): Promise<string[]> {
		await this.loadDatasetsFromDisk();

		if (!this.hf.isValidId(id)) {
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

		if (!this.hf.isValidId(id)) {
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

		// go through the query (from chatGPT)
		const { WHERE, OPTIONS } = query as any;

		// check valid WHERE and valid OPTION
		if (!WHERE || !OPTIONS) {
			throw new InsightError("invalid format");
		}

		if (typeof query !== "object") {
			throw new InsightError();
		}

		if (!query) {
			throw new InsightError();
		}

		for (const x of Object.keys(query)) {
			if (x !== "WHERE" && x !== "OPTIONS") {
				throw new InsightError();
			}
		}

		// get id from first element of column
		const queryId = await this.hf.getQueryId(OPTIONS);

		const foundDataset = this.datasets.get(queryId);

		// no dataset with id found
		if (!foundDataset) {
			throw new InsightError("reference not found");
		}

		const filtered = await this.handleWhere(WHERE, foundDataset.sections, queryId);

		if (filtered.length === 0) {
			return [];
		}

		// handle OPTIONS
		const result = await this.handleOptions(OPTIONS, filtered, queryId);

		const limit = 5000;

		if (result.length > limit) {
			throw new ResultTooLargeError("result too large");
		}

		// console.log(result);

		return result;
	}

	private async handleOptions(options: any, filtered: Section[], queryId: string): Promise<InsightResult[]> {
		const columns = options.COLUMNS;
		const order = options.ORDER;
		const columnParam: String[] = [];

		// map filtered sections to the required columns
		const results: InsightResult[] = filtered.map((section) => {
			const result: any = {};
			columns.forEach((col: string) => {
				const [datasetId, field] = col.split("_");
				if (datasetId !== queryId) {
					throw new InsightError("invalid dataset");
				}
				columnParam.push(field);
				result[col] = this.hf.getParamAll(field, section);
			});
			return result;
		});

		// If ORDER exists, sort the results
		if (order) {
			this.sortResults(results, order, queryId, columnParam);
		}

		return results;
	}

	private sortResults(results: InsightResult[], order: string, queryId: string, columnParam: String[]): void {
		if (typeof order !== "string") {
			throw new InsightError("Invalid order key");
		}

		const [dataset, orderParam] = order.split("_");
		if (dataset !== queryId) {
			throw new InsightError("Invalid dataset");
		}
		if (!columnParam.includes(orderParam)) {
			throw new InsightError("");
		}

		results.sort((a, b) => {
			const aValue = a[order];
			const bValue = b[order];

			if (typeof aValue === "string" && typeof bValue === "string") {
				return aValue.localeCompare(bValue); // Lexical comparison for strings
			} else if (typeof aValue === "number" && typeof bValue === "number") {
				return aValue - bValue; // Numeric comparison for numbers
			} else {
				throw new InsightError("Cannot compare values of different types");
			}
		});
	}

	private async handleWhere(where: any, sections: Section[], queryId: string): Promise<Section[]> {
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
		// now we have list of sections with ID yang dimau
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
			return await this.handleOr(where, sections, queryId);
		}

		if (where.AND) {
			return await this.handleAnd(where, sections, queryId);
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
		// const filteredSections: any[] = [];
		// const andArrLength = where.AND.length;

		// // fill in with the result of each recursion
		// for (let i = 0; i < andArrLength; i++) {
		// 	filteredSections[i] = this.handleWhere(where.AND[i], sections, queryId);
		// }

		if (where.AND.length === 0) {
			throw new InsightError("Invalid Query Syntax");
		}

		const andPromises = where.AND.map(async (condition: any) => this.handleWhere(condition, sections, queryId));

		const filteredSections = await Promise.all(andPromises);

		// console.log(filteredSections);

		// check whether the section is found in all of the filteredSections members
		// function sectionChecker(s: Section): boolean {
		// 	for (const x of filteredSections) {
		// 		if (!x.includes(s)) {
		// 			return false;
		// 		}
		// 	}
		// 	return true;
		// }

		return sections.filter((section) => filteredSections.every((filtered) => filtered.includes(section)));
	}

	private async handleNegation(where: any, sections: Section[], queryId: string): Promise<Section[]> {
		// filter the sections

		const filteredSections = await this.handleWhere(where.NOT, sections, queryId);
		return sections.filter((s: Section) => {
			return !filteredSections.includes(s);
		});
	}

	private async handleOptions(options: any, sections: Section[], queryId: string): Promise<InsightResult[]> {
		const columns = options.COLUMNS;
		const fields: string[] = [];
	
		// Step 1: Project the results (keep only fields in COLUMNS)
		const projectedResults = sections.map((section) => {
			const result: InsightResult = {};
			columns.forEach((col: string) => {
				const [id, field] = col.split("_");
	
				// Check that the id in the columns matches the query id
				if (id !== queryId) {
					throw new InsightError(`Invalid column reference: ${col} (expected dataset id: ${queryId})`);
				}
				if (!fields.includes(field)) {
					fields.push(field);
				}
	
				// Copy the value of the field from the section
				result[col] = this.getParamValue(field, section);
			});
			return result;
		});

		// console.log(projectedResults);
	
		// Step 2: Handle ORDER, if specified
		if (options.ORDER) {
			const orderKey = options.ORDER;
			const [id, field] = orderKey.split("_");
	
			// Check that the order key refers to the correct dataset
			if (id !== queryId) {
				throw new InsightError(`Invalid order reference: ${orderKey} (expected dataset id: ${queryId})`);
			}

			if (!fields.includes(field)) {
				throw new InsightError("");
			}
	
			// Sort the results based on the order key
			projectedResults.sort((a, b) => {
				const valueA = a[orderKey];
				const valueB = b[orderKey];
	
				if (valueA < valueB) return -1;
				if (valueA > valueB) return 1;
				return 0;
			});
		}
	
		return projectedResults;
	}
	

	private getParamValue(field: string, section: Section): string | number {
		switch (field) {
			case "uuid":
				return section.uuid;
			case "id":
				return section.id;
			case "title":
				return section.title;
			case "instructor":
				return section.instructor;
			case "dept":
				return section.dept;
			case "year":
				return section.year;
			case "avg":
				return section.avg;
			case "pass":
				return section.pass;
			case "fail":
				return section.fail;
			case "audit":
				return section.audit;
			default:
				throw new InsightError(`Invalid field: ${field}`);
		}
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
