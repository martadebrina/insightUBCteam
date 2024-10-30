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
import { Datasets, Section, Room } from "./helperClass";
import { HelperFunction } from "./helperFunction";
import { HelperRoom } from "./helperRoom";
import * as parse5 from "parse5";
import { HelperWhere } from "./helperWhere";
// import * as path from "path";

export default class InsightFacade implements IInsightFacade {
	private datasets = new Map<string, Datasets>();
	private hf = new HelperFunction();
	private hr = new HelperRoom();
	private hw = new HelperWhere();

	public async addDataset(id: string, content: string, kind: InsightDatasetKind): Promise<string[]> {
		await this.loadDatasetsFromDisk(kind);

		if (!this.hf.isValidId(id)) {
			throw new InsightError("Invalid id");
		}
		if (this.datasets.has(id)) {
			throw new InsightError("Dataset already exists");
		}

		let zipData: JSZip;
		try {
			zipData = await loadAsync(content, { base64: true });
			if (kind === InsightDatasetKind.Sections) {
				const files = zipData.folder("courses");
				if (!files) {
					throw new InsightError("no courses folder");
				}
				if (files.length === 0) {
					throw new InsightError("no content in files");
				}
				await this.parseZipFile(id, zipData, this.datasets);
			} else if (kind === InsightDatasetKind.Rooms) {
				await this.parseRoomZipFile(id, zipData, this.datasets);
			} else {
				throw new InsightError("Invalid dataset kind");
			}
		} catch (_err) {
			throw new InsightError("Fail to unzip");
		}

		return Array.from(this.datasets.keys());
	}

	public async removeDataset(id: string): Promise<string> {
		await this.loadDatasetsFromDisk(InsightDatasetKind.Sections);
		await this.loadDatasetsFromDisk(InsightDatasetKind.Rooms);

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

	private async parseRoomZipFile(id: string, zipData: JSZip, datasets: Map<string, Datasets>): Promise<void> {
		const dumpDatasets = new Datasets(InsightDatasetKind.Rooms);
		const indexFilePath = Object.keys(zipData.files).find((path) => path.endsWith("index.htm"));
		if (!indexFilePath) {
			throw new InsightError("no index.htm folderß");
		}
		const indexFile = zipData.file(indexFilePath);
		if (!indexFile) {
			throw new InsightError("no index file inside the folder");
		}
		const indexContent = await indexFile.async("string");
		const document = parse5.parse(indexContent);

		// find building and classrooms table
		const tables = this.hr.findAllNodesByName(document, "table");
		const buildingTable = tables.find((table) => this.hr.isValidBuildingTable(table));
		//console.log(buildingTable);
		if (!buildingTable) {
			throw new InsightError("no valid building table");
		}

		// extract room data
		const { buildings, buildingLinks } = this.hr.extractBuildingsData(buildingTable);

		await this.hr.assignLatLon(buildings);
		const rooms = await this.hr.extractRoomData(buildingLinks, buildings, zipData);
		for (const room of rooms) {
			if (!room) {
				continue;
			}
			const roomInstance = new Room(room);
			console.log(roomInstance);
			dumpDatasets.addRoom(roomInstance);
		}
		datasets.set(id, dumpDatasets);
		await this.saveDatasetsDisk(datasets);
	}

	public async listDatasets(): Promise<InsightDataset[]> {
		await this.loadDatasetsFromDisk(InsightDatasetKind.Sections);
		await this.loadDatasetsFromDisk(InsightDatasetKind.Rooms);

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
		await this.loadDatasetsFromDisk(InsightDatasetKind.Sections);
		await this.loadDatasetsFromDisk(InsightDatasetKind.Rooms);

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

		const filtered = await this.hw.handleWhere(WHERE, foundDataset.sections, queryId);

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

	private async loadDatasetsFromDisk(k: InsightDatasetKind): Promise<void> {
		if (k === InsightDatasetKind.Sections) {
			const exist = await fs.pathExists("./data/Datasets.json");

			if (!exist) {
				return;
			}

			const datasetArray: [string, Datasets][] = await fs.readJSON("./data/Datasets.json");

			for (const [id, dataset] of datasetArray) {
				if (this.datasets.has(id)) {
					continue;
				}
				const newData = new Datasets(k);
				newData.sections = dataset.sections;
				newData.numRows = dataset.numRows;
				newData.kind = dataset.kind;
				this.datasets.set(id, newData);
			}
		}
	}

	private async parseZipFile(id: string, zip: JSZip, datasets: Map<string, Datasets>): Promise<void> {
		const dumpDatasets = new Datasets(InsightDatasetKind.Sections);
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

		await fs.ensureDir("./data");

		await fs.writeJSON("./data/Datasets.json", datasetsArray);
	}
}
