import { IInsightFacade, InsightDataset, InsightDatasetKind, InsightResult } from "./IInsightFacade";
import { InsightError } from "./IInsightFacade";
import JSZip from "jszip";

/**
 * This is the main programmatic entry point for the project.
 * Method documentation is in IInsightFacade
 *
 */
export default class InsightFacade implements IInsightFacade {
	//datasets storage

	private datasets: Record<string, InsightDataset> = {};

	public async addDataset(id: string, content: string, kind: InsightDatasetKind): Promise<string[]> {

		// reject invalid params and dataset already exist
		if (id === "" || id === " " || id.includes("_") || this.datasets[id]) {
			throw new InsightError();
		}

		const validSections = await this.getValidSections(content);

		// no valid section in the zip file
		if (validSections.length === 0) {
			throw new InsightError();
		}
		//store valid section back to datasets
		this.datasets[id] = {
			id,
			kind,
			numRows: validSections.length,
		};
		// return the valid section
		return Object.keys(this.datasets);
	}

	public async removeDataset(id: string): Promise<string> {
		// TODO: Remove this once you implement the methods!
		throw new Error(`InsightFacadeImpl::removeDataset() is unimplemented! - id=${id};`);
	}

	public async performQuery(query: unknown): Promise<InsightResult[]> {
		// TODO: Remove this once you implement the methods!
		throw new Error(`InsightFacadeImpl::performQuery() is unimplemented! - query=${query};`);
	}

	public async listDatasets(): Promise<InsightDataset[]> {
		// TODO: Remove this once you implement the methods!
		throw new Error(`InsightFacadeImpl::listDatasets is unimplemented!`);
	}

	// helper functions

	private async getValidSections(content: string): Promise<any[]> {
		const unzip = await this.loadZip(content);
		const jsonFilesContent = await this.extractJsonFiles(unzip);
		return this.parseJsonFiles(jsonFilesContent);
	}

	private async loadZip(content: string): Promise<JSZip> {
		const newZip = new JSZip();
		try {
			return await newZip.loadAsync(content, { base64: true });
		} catch {
			throw new InsightError();
		}
	}

	private async extractJsonFiles(unzip: JSZip): Promise<string[]> {
		const jsonFilePromises = Object.keys(unzip.files)
			.filter((f) => f.endsWith(".json"))
			.map(async (f) => unzip.files[f].async("string"));

		try {
			return await Promise.all(jsonFilePromises);
		} catch {
			throw new InsightError();
		}
	}

	private parseJsonFiles(jsonFilesContent: string[]): any[] {
		const validSections: any[] = [];
		for (const fileContent of jsonFilesContent) {
			try {
				const parsedFile = JSON.parse(fileContent);
				if (Array.isArray(parsedFile)) {
					for (const section of parsedFile) {
						if (section && typeof section === "object") {
							validSections.push(section);
						}
					}
				}
			} catch {
				throw new InsightError();
			}
		}
		return validSections;
	}
}
