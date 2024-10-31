import { InsightError, InsightResult } from "./IInsightFacade";

export class HelperSort {
	public sortResults(results: InsightResult[], order: string, queryId: string, columnParam: String[]): void {
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
				return aValue > bValue ? 1 : 0; // Lexical comparison for strings
			} else if (typeof aValue === "number" && typeof bValue === "number") {
				return aValue - bValue; // Numeric comparison for numbers
			} else {
				throw new InsightError("Cannot compare values of different types");
			}
		});
	}
}
