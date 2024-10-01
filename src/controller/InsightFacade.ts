import { IInsightFacade, InsightDataset, InsightDatasetKind, InsightResult } from "./IInsightFacade";
import { InsightError } from "./IInsightFacade";
import JSZip from "jszip";
import * as fs from "fs-extra";
import * as path from "path";

/**
 * This is the main programmatic entry point for the project.
 * Method documentation is in IInsightFacade
 *
 */
export default class InsightFacade implements IInsightFacade {
	//datasets storage

	private datasets: Record<string, InsightDataset> = {};

	public async addDataset(id: string, content: string, kind: InsightDatasetKind): Promise<string[]> {
		// Validate the parameters
		console.log(`Adding dataset with ID: ${id}`);

		if (!id || typeof id !== "string" || id.trim() === "" || id.includes("_")) {
			console.error("Invalid dataset ID provided.");
			return Promise.reject(new InsightError("Invalid dataset ID."));
		}

		if (this.datasets[id]) {
			console.error("Dataset with the same ID already exists.");
			return Promise.reject(new InsightError("Dataset with the same ID already exists."));
		}

		try {
			// Call the helper function to get valid sections asynchronously
			console.log("Getting valid sections from the provided content.");
			const validSections = await this.getValidSections(content);

			// No valid section in the zip file
			if (validSections.length === 0) {
				console.error("No valid sections found in the dataset.");
				throw new InsightError("No valid sections found in the dataset.");
			}

			// Store valid sections back to datasets
			console.log(`Storing dataset with ID: ${id}`);
			this.datasets[id] = {
				id,
				kind,
				numRows: validSections.length,
			};

			// Return the updated list of dataset IDs
			console.log("Dataset added successfully. Returning updated list of dataset IDs.");
			return Promise.resolve(Object.keys(this.datasets));
		} catch (err) {
			console.error("Failed to add dataset.");
			return Promise.reject(new InsightError("Failed to add dataset."));
		}
	}

	getValidSections(content: string) {
		return [];
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
		return Object.values(this.datasets);
	}

}
