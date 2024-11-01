import { InsightError, InsightResult } from "./IInsightFacade";

export class HelperSort {
	public sortResults(results: InsightResult[], order: any, queryId: string, columnParam: string[]): void {
		if (typeof order === "string") {
			this.basicSort(order, queryId, columnParam, results);
		} else {
			this.advancedSort(order, queryId, columnParam, results);
		}
	}

	// when order is just a single key, whether it's mkey skey or the customkey (no _)
	private basicSort(order: string, queryId: string, columnParam: string[], results: InsightResult[]): void {
		this.validateOrderColumn(order, queryId, columnParam);

		results.sort((a, b) => {
			const aValue = a[order];
			const bValue = b[order];

			// Use ternary operator for comparison
			if (typeof aValue === "string" && typeof bValue === "string") {
				return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
			} else if (typeof aValue === "number" && typeof bValue === "number") {
				return aValue - bValue; // Numeric comparison for numbers
			} else {
				throw new InsightError("Cannot compare values of different types");
			}
		});
	}

	// when order is a composite object, {dir:"direction" , keys:[key1,key2]}
	// key-n is just a single key, whether it's mkey skey or the customkey (no _)
	private advancedSort(order: any, queryId: string, columnParam: string[], results: InsightResult[]): void {
		const direction = order.dir;
		const sortKeys = order.keys;

		if (!direction || !sortKeys || sortKeys.length === 0) {
			throw new InsightError("Invalid query format: order syntax wrong");
		}
		sortKeys.forEach((key: string) => this.validateOrderColumn(key, queryId, columnParam));

		if (direction === "UP") {
			this.sortUp(results, sortKeys);
		} else if (direction === "DOWN") {
			this.sortDown(results, sortKeys);
		} else {
			throw new InsightError("Invalid sort direction");
		}
	}

	private validateOrderColumn(order: string, queryId: string, columnParam: string[]): void {
		if (order.includes("_")) {
			const [dataset, orderParam] = order.split("_");
			if (dataset !== queryId) {
				throw new InsightError("Invalid dataset");
			}
			if (!columnParam.includes(orderParam)) {
				throw new InsightError("Invalid column: ${orderParam}");
			}
		} else {
			if (!columnParam.includes(order)) {
				throw new InsightError("Invalid column: ${order}");
			}
		}
	}

	private sortUp(results: InsightResult[], sortKeys: string[]): void {
		results.sort((a, b) => {
			for (const key of sortKeys) {
				const aValue = a[key];
				const bValue = b[key];

				// Ternary operator for string and number comparison
				if (typeof aValue === "string" && typeof bValue === "string") {
					const comparison = aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
					if (comparison !== 0) {
						return comparison;
					}
				} else if (typeof aValue === "number" && typeof bValue === "number") {
					if (aValue !== bValue) {
						return aValue - bValue;
					}
				} else {
					throw new InsightError("Cannot compare values of different types");
				}
			}
			return 0; // All keys are equal
		});
	}

	private sortDown(results: InsightResult[], sortKeys: string[]): void {
		results.sort((a, b) => {
			for (const key of sortKeys) {
				const aValue = a[key];
				const bValue = b[key];

				// Reverse ternary operator comparison for descending order
				if (typeof aValue === "string" && typeof bValue === "string") {
					const comparison = aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
					if (comparison !== 0) {
						return comparison;
					}
				} else if (typeof aValue === "number" && typeof bValue === "number") {
					if (aValue !== bValue) {
						return bValue - aValue;
					}
				} else {
					throw new InsightError("Cannot compare values of different types");
				}
			}
			return 0; // All keys are equal
		});
	}
}
