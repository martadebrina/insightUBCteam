import {
	IInsightFacade,
	InsightDatasetKind,
	InsightError,
	InsightResult,
	NotFoundError,
	ResultTooLargeError,
} from "../../src/controller/IInsightFacade";
import InsightFacade from "../../src/controller/InsightFacade";
import { clearDisk, getContentFromArchives, loadTestQuery } from "../TestUtil";
import { expect, use } from "chai";
import chaiAsPromised from "chai-as-promised";
use(chaiAsPromised);
export interface ITestQuery {
	title?: string;
	input: unknown;
	errorExpected: boolean;
	expected: any;
}
describe("InsightFacade", function () {
	let facade: IInsightFacade;
	// Declare datasets used in tests. You should add more datasets like this!
	let sections: string;
	let sections1: string;
	let sections2: string;

	before(async function () {
		// This block runs once and loads the datasets.
		sections = await getContentFromArchives("pair.zip");
		sections1 = await getContentFromArchives("novalid.zip");
		sections2 = await getContentFromArchives("nofolder.zip");

		// Just in case there is anything hanging around from a previous run of the test suite
		await clearDisk();
	});

	// describe("Caching Tests without Sinon", function () {
	// 	let insightFacade: InsightFacade;
	// 	const testDataPath = "./testData";  // Directory to store test files

	// 	beforeEach(async function () {
	// 		// Ensure the test directory is clean before each test
	// 		await fs.remove(testDataPath);
	// 		await fs.ensureDir(testDataPath);
	// 		insightFacade = new InsightFacade();
	// 	});

	// 	afterEach(async function () {
	// 		// Clean up after each test
	// 		await fs.remove(testDataPath);
	// 	});

	// 	it("should add dataset and check if file is saved on disk", async function () {
	// 		const id = "courses";
	// 		const content = ;  // Replace with actual encoded content
	// 		const kind = InsightDatasetKind.Sections;

	// 		// Add dataset and verify it's returned in the list
	// 		const datasets = await insightFacade.addDataset(id, content, kind);
	// 		expect(datasets).to.include(id);

	// 		// Verify that the dataset file was saved to disk
	// 		const datasetFilePath = `${testDataPath}/Datasets.json`;
	// 		const fileExists = await fs.pathExists(datasetFilePath);
	// 		expect(fileExists).to.be.true;

	// 		// Read the saved file and verify its content
	// 		const savedData = await fs.readJSON(datasetFilePath);
	// 		expect(savedData.length).to.equal(1);
	// 		expect(savedData[0][0]).to.equal(id);
	// 		expect(savedData[0][1].numRows).to.be.greaterThan(0);  // Example check
	// 	});
	// });

	describe("AddDataset", function () {
		beforeEach(function () {
			// This section resets the insightFacade instance
			// This runs before each test
			facade = new InsightFacade();
		});
		afterEach(async function () {
			// This section resets the data directory (removing any cached data)
			// This runs after each test, which should make each test independent of the previous one
			await clearDisk();
		});
		it("should reject when id is the same as the id of an already added dataset", async function () {
			try {
				await facade.addDataset("courseID", sections, InsightDatasetKind.Sections);
				await facade.addDataset("courseID", sections, InsightDatasetKind.Sections);
				expect.fail("Should have thrown above.");
			} catch (err) {
				expect(err).to.be.instanceOf(InsightError);
			}
		});

		it("should reject with  an empty dataset id", async function () {
			try {
				await facade.addDataset("", sections, InsightDatasetKind.Sections);
				expect.fail("Should not accept an empty dataset id");
			} catch (_err) {
				expect(_err).to.be.instanceOf(InsightError);
			}
		});
		it("should reject id starts with _", async function () {
			try {
				await facade.addDataset("_DEF", sections, InsightDatasetKind.Sections);
				expect.fail("should reject id starts with _");
			} catch (_err) {
				expect(_err).to.be.instanceOf(InsightError);
			}
		});
		it("should reject id with _ in the middle", async function () {
			try {
				await facade.addDataset("D_EF", sections, InsightDatasetKind.Sections);
				expect.fail("should reject id with _ in the middle");
			} catch (_err) {
				expect(_err).to.be.instanceOf(InsightError);
			}
		});
		it("should reject id with _ in the end", async function () {
			try {
				await facade.addDataset("DEF_", sections, InsightDatasetKind.Sections);
				expect.fail("should reject id with _ in the end");
			} catch (err) {
				expect(err).to.be.instanceOf(InsightError);
			}
		});
		it("should reject id with only whitespace", async function () {
			try {
				await facade.addDataset("  ", sections, InsightDatasetKind.Sections);
				expect.fail("should reject id with only whitespace");
			} catch (_err) {
				expect(_err).to.be.instanceOf(InsightError);
			}
		});
		it("should added successfully", async function () {
			try {
				const set1 = await facade.addDataset("CPSC310", sections, InsightDatasetKind.Sections);
				expect(set1).to.have.members(["CPSC310"]);
			} catch (_err) {
				expect.fail("should not fail");
			}
		});
		it("should reject dataset with no valid course", async function () {
			try {
				await facade.addDataset("CPSC313", sections1, InsightDatasetKind.Sections);
				expect.fail("should reject dataset with no valid course");
			} catch (_err) {
				expect(_err).to.be.instanceOf(InsightError);
			}
		});

		it("should reject dataset with no courses folder", async function () {
			try {
				await facade.addDataset("CPSC313", sections2, InsightDatasetKind.Sections);
				expect.fail("should reject dataset with no courses folder");
			} catch (_err) {
				expect(_err).to.be.instanceOf(InsightError);
			}
		});
	});

	describe("RemoveDataset", function () {
		beforeEach(function () {
			// This section resets the insightFacade instance
			// This runs before each test
			facade = new InsightFacade();
		});
		afterEach(async function () {
			// This section resets the data directory (removing any cached data)
			// This runs after each test, which should make each test independent of the previous one
			await clearDisk();
		});
		it("reject with an empty dataset id", async function () {
			try {
				await facade.removeDataset("");
				expect.fail("Should not accept an empty dataset id");
			} catch (_err) {
				expect(_err).to.be.instanceOf(InsightError);
			}
		});
		it("reject id starts with _", async function () {
			try {
				await facade.removeDataset("_DEF");
				expect.fail("should reject id starts with _");
			} catch (_err) {
				expect(_err).to.be.instanceOf(InsightError);
			}
		});
		it("reject id with _ in the middle", async function () {
			try {
				await facade.removeDataset("D_EF");
				expect.fail("should reject id with _ in the middle");
			} catch (_err) {
				expect(_err).to.be.instanceOf(InsightError);
			}
		});
		it("reject id with _ in the end", async function () {
			try {
				await facade.removeDataset("DEF_");
				expect.fail("should reject id with _ in the end");
			} catch (_err) {
				expect(_err).to.be.instanceOf(InsightError);
			}
		});
		it("reject id with only whitespace", async function () {
			try {
				await facade.removeDataset("  ");
				expect.fail("should reject id with only whitespace");
			} catch (_err) {
				expect(_err).to.be.instanceOf(InsightError);
			}
		});
		it("should have removed successfully", async function () {
			try {
				await facade.addDataset("CPSC310", sections, InsightDatasetKind.Sections);
				const set = await facade.removeDataset("CPSC310");
				expect(set).to.equal("CPSC310");
			} catch (_err) {
				expect.fail("should removed successfully");
			}
		});
		it("cannot find id", async function () {
			try {
				await facade.addDataset("CPSC310", sections, InsightDatasetKind.Sections);
				await facade.removeDataset("CPSC");
				expect.fail("cannot find id");
			} catch (_err) {
				expect(_err).to.be.instanceOf(NotFoundError);
			}
		});
		it("cannot remove empty dataset", async function () {
			try {
				await facade.removeDataset("CPSC");
				expect.fail("cannot remove from empty dataset");
			} catch (_err) {
				expect(_err).to.be.instanceOf(NotFoundError);
			}
		});
		it("remove same dataset twice", async function () {
			try {
				await facade.addDataset("CPSC310", sections, InsightDatasetKind.Sections);
				await facade.removeDataset("CPSC310");
				await facade.removeDataset("CPSC310");
				expect.fail("should not remove twice");
			} catch (_err) {
				expect(_err).to.be.instanceOf(NotFoundError);
			}
		});
		it("should have removed multiple successfully", async function () {
			try {
				await facade.addDataset("CPSC310", sections, InsightDatasetKind.Sections);
				await facade.addDataset("CPSC313", sections, InsightDatasetKind.Sections);
				const set = await facade.removeDataset("CPSC310");
				expect(set).to.equal("CPSC310");
				const set1 = await facade.removeDataset("CPSC313");
				expect(set1).to.equal("CPSC313");
			} catch (_err) {
				expect.fail("should removed successfully");
			}
		});
	});

	describe("ListDataset", function () {
		beforeEach(function () {
			// This section resets the insightFacade instance
			// This runs before each test
			facade = new InsightFacade();
		});
		afterEach(async function () {
			// This section resets the data directory (removing any cached data)
			// This runs after each test, which should make each test independent of the previous one
			await clearDisk();
		});
		it("should list nothing", async function () {
			try {
				const set = await facade.listDatasets();
				expect(set).to.deep.equal([]);
			} catch (_err) {
				expect.fail("Should not fail");
			}
		});
		it("should list one dataset", async function () {
			try {
				await facade.addDataset("CPSC310", sections, InsightDatasetKind.Sections);
				const set = await facade.listDatasets();
				expect(set).to.deep.equal([
					{
						id: "CPSC310",
						kind: InsightDatasetKind.Sections,
						numRows: 64612,
					},
				]);
			} catch (_err) {
				expect.fail("Should not fail");
			}
		});
		it("should list multiple datasets", async function () {
			try {
				await facade.addDataset("ubc", sections, InsightDatasetKind.Sections);
				await facade.addDataset("CPSC310", sections, InsightDatasetKind.Sections);
				const set = await facade.listDatasets();
				expect(set).to.deep.equal([
					{
						id: "ubc",
						kind: InsightDatasetKind.Sections,
						numRows: 64612,
					},
					{
						id: "CPSC310",
						kind: InsightDatasetKind.Sections,
						numRows: 64612,
					},
				]);
			} catch (_err) {
				expect.fail("Should not fail");
			}
		});
		it("should return remaining array after removing one", async function () {
			try {
				await facade.addDataset("courseID1", sections, InsightDatasetKind.Sections);
				await facade.addDataset("courseID2", sections, InsightDatasetKind.Sections);
				await facade.removeDataset("courseID1");
				const list3 = await facade.listDatasets();
				expect(list3[0]).to.deep.equal({
					id: "courseID2",
					kind: InsightDatasetKind.Sections,
					numRows: 64612,
				});
			} catch (_err) {
				expect.fail("Should not have thrown an error");
			}
		});
	});

	function sortResults(results: InsightResult[]): InsightResult[] {
		return results.sort((a, b) => {
			// Sort based on a key, for example 'dept' or 'uuid'
			const aKey = Object.values(a).join("");
			const bKey = Object.values(b).join("");
			return aKey.localeCompare(bKey);
		});
	}

	describe("PerformQuery", function () {
		/**
		 * Loads the TestQuery specified in the test name and asserts the behaviour of performQuery.
		 *
		 * Note: the 'this' parameter is automatically set by Mocha and contains information about the test.
		 */
		async function checkQuery(this: Mocha.Context): Promise<void> {
			if (!this.test) {
				throw new Error(
					"Invalid call to checkQuery." +
						"Usage: 'checkQuery' must be passed as the second parameter of Mocha's it(..) function." +
						"Do not invoke the function directly."
				);
			}
			// Destructuring assignment to reduce property accesses
			const { input, expected, errorExpected } = await loadTestQuery(this.test.title);
			let result: InsightResult[];
			try {
				result = await facade.performQuery(input);
				if (errorExpected) {
					expect.fail(`performQuery resolved when it should have rejected with ${expected}`);
				}
				// Sort both result and expected to ensure order does not matter
				const sortedResult = sortResults(result);
				const sortedExpected = sortResults(expected);

				// Compare the sorted results using deep equal
				expect(sortedResult).to.deep.equal(sortedExpected);
				expect(input).to.be.instanceOf(Object);
			} catch (_err) {
				if (!errorExpected) {
					expect.fail(`performQuery threw unexpected error: ${_err}`);
				}
				if (expected === "InsightError") {
					expect(_err).to.be.instanceOf(InsightError);
				} else if (expected === "ResultTooLargeError") {
					expect(_err).to.be.instanceOf(ResultTooLargeError);
				} else {
					expect.fail("should not reach here");
				}
			}
			// return expect.fail("Write your assertion(s) here."); // TODO: replace with your assertions
		}
		before(async function () {
			facade = new InsightFacade();
			// Add the datasets to InsightFacade once.
			// Will *fail* if there is a problem reading ANY dataset.
			const loadDatasetPromises: Promise<string[]>[] = [
				facade.addDataset("sections", sections, InsightDatasetKind.Sections),
			];
			try {
				await Promise.all(loadDatasetPromises);
			} catch (_err) {
				throw new Error(`In PerformQuery Before hook, dataset(s) failed to be added. \n${_err}`);
			}
		});
		after(async function () {
			await clearDisk();
		});
		// Examples demonstrating how to test performQuery using the JSON Test Queries.
		// The relative path to the query file must be given in square brackets.
		it("[valid/simple.json] SELECT dept, avg WHERE avg > 97", checkQuery);
		it("[invalid/invalid.json] Query missing WHERE", checkQuery);
		it(
			"[invalid/asteriskmiddle.json] SELECT dept, instructor WHERE instructor contains asterisk in the middle",
			checkQuery
		);
		it("[invalid/nooptions.json] SELECT with missing OPTIONS field", checkQuery);
		it(
			"[valid/asteriskstart.json] SELECT dept, instructor WHERE instructor contains asterisk in the start",
			checkQuery
		);
		it("[valid/asteriskend.json] SELECT dept, instructor WHERE instructor contains asterisk in the end", checkQuery);
		it(
			"[valid/asteriskstartend.json] SELECT dept, instructor WHERE instructor contains asterisk at start and end",
			checkQuery
		);
		it("[valid/noasterisk.json] SELECT dept, instructor WHERE instructor contains no asterisk", checkQuery);
		it("[invalid/resulttoolarge.json] SELECT dept, result too large", checkQuery);
		it("[valid/lessthan.json] SELECT dept, avg WHERE avg < 25", checkQuery);
		it("[valid/equal.json] SELECT dept, avg WHERE avg = 98", checkQuery);
		it("[valid/negation.json] try negation", checkQuery);
		it("[valid/andcompare.json] and comparator", checkQuery);
		it("[valid/orcompare.json] or comparator", checkQuery);
		it("[valid/combinecompare.json] combine comparator", checkQuery);
		it("[valid/emptyresult.json] empty result", checkQuery);
		it("[invalid/nocolumn.json] no column", checkQuery);
		it("[invalid/emptycolumn.json] empty column", checkQuery);
		it("[invalid/invalidwhere.json] invalid comparator", checkQuery);
		it("[invalid/multwhere.json] multi dataset in where", checkQuery);
		it("[invalid/multoption.json] multi dataset in option", checkQuery);
		it("[invalid/multiple.json] multi dataset in option and where", checkQuery);
		it("[invalid/noinput.json] no input", checkQuery);
		it("[invalid/orderfail.json] order not in column", checkQuery);
		it("[invalid/invalidmkey.json] wrong m key", checkQuery);
		it("[invalid/invalidskey.json] wrong s key", checkQuery);
	});
});
