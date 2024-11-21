import { expect } from "chai";
import request, { Response } from "supertest";
import { StatusCodes } from "http-status-codes";
import Log from "@ubccpsc310/folder-test/build/Log";
import Server from "../../src/rest/Server";
import { clearDisk, getContentFromArchives } from "../TestUtil";
import InsightFacade from "../../src/controller/InsightFacade";
import { InsightDatasetKind } from "../../src/controller/IInsightFacade";

describe("Facade C3", function () {
	let sections: string;
	let server: Server;
	let insightFacade: InsightFacade;

	before(async function () {
		// TODO: start server here once and handle errors properly
		const add = 4321;
		server = new Server(add);
		insightFacade = new InsightFacade();

		try {
			sections = await getContentFromArchives("pair.zip");
			await server.start();
			Log.info("Server started successfully for testing.");
		} catch (err) {
			Log.error("Error starting server: " + err);
		}
	});

	after(async function () {
		// TODO: stop server here once!
		try {
			await server.stop();
			Log.info("Server stopped successfully after testing.");
		} catch (err) {
			Log.error("Error stopping server: " + err);
		}
	});

	beforeEach(async function () {
		// might want to add some process logging here to keep track of what is going on
		Log.info("Starting a test...");
		await clearDisk();
	});

	afterEach(async function () {
		// might want to add some process logging here to keep track of what is going on
		Log.info("Completed a test...");
		await clearDisk();
	});

	// Sample on how to format PUT requests
	it("PUT test for courses dataset", async function () {
		const SERVER_URL = "http://localhost:4321";
		const ENDPOINT_URL = "/dataset/courses/sections";
		const ZIP_FILE_DATA = Buffer.from(sections, "base64");

		// bisa ga ya ditambahin
		// try {
		// 	await request(SERVER_URL).delete("/dataset/courses");
		// } catch {
		// 	Log.info("Dataset not found or already deleted, proceeding to add.");
		// }

		Log.info(`Testing PUT request to ${ENDPOINT_URL}`);

		try {
			return request(SERVER_URL)
				.put(ENDPOINT_URL)
				.send(ZIP_FILE_DATA)
				.set("Content-Type", "application/x-zip-compressed")
				.then(function (res: Response) {
					// some logging here please!
					Log.info("PUT Response: " + JSON.stringify(res.body));
					expect(res.status).to.be.equal(StatusCodes.OK);
				})
				.catch(function (err) {
					// some logging here please!
					Log.error("Error in PUT test: " + err);
					expect.fail();
				});
		} catch (err) {
			Log.error(err);
			// and some more logging here!
		}
	});

	// Test for DELETE request to remove a dataset
	it("DELETE test for removing a dataset", async function () {
		const SERVER_URL = "http://localhost:4321";
		const ENDPOINT_URL = "/dataset/courses";
		await insightFacade.addDataset("courses", sections, InsightDatasetKind.Sections);

		return request(SERVER_URL)
			.delete(ENDPOINT_URL)
			.then(function (res: Response) {
				Log.info("DELETE Response: " + JSON.stringify(res.body));
				expect(res.status).to.be.equal(StatusCodes.OK);
				expect(res.body).to.have.property("result");
			})
			.catch(function (err) {
				Log.error("Error in DELETE test: " + err);
				expect.fail();
			});
	});

	// Test for GET request to list datasets
	it("GET test for listing datasets", async function () {
		const SERVER_URL = "http://localhost:4321";
		const ENDPOINT_URL = "/datasets";

		return request(SERVER_URL)
			.get(ENDPOINT_URL)
			.then(function (res: Response) {
				Log.info("GET Response: " + JSON.stringify(res.body));
				expect(res.status).to.be.equal(StatusCodes.OK);
				expect(res.body).to.have.property("result");
				expect(res.body.result).to.be.an("array");
			})
			.catch(function (err) {
				Log.error("Error in GET test: " + err);
				expect.fail();
			});
	});

	// Test for POST request to query data
	it("POST test for querying a dataset", async function () {
		await insightFacade.addDataset("sections", sections, InsightDatasetKind.Sections);
		const SERVER_URL = "http://localhost:4321";
		const ENDPOINT_URL = "/query";
		const QUERY_PAYLOAD = {
			WHERE: {
				GT: {
					sections_avg: 97,
				},
			},
			OPTIONS: {
				COLUMNS: ["sections_dept", "sections_avg"],
				ORDER: "sections_avg",
			},
		};

		return request(SERVER_URL)
			.post(ENDPOINT_URL)
			.send(QUERY_PAYLOAD)
			.set("Content-Type", "application/json")
			.then(function (res: Response) {
				Log.info("POST Response: " + JSON.stringify(res.body));
				expect(res.status).to.be.equal(StatusCodes.OK);
				expect(res.body).to.have.property("result");
				expect(res.body.result).to.be.an("array");
			})
			.catch(function (err) {
				Log.error("Error in POST test: " + err);
				expect.fail();
			});
	});
	// The other endpoints work similarly. You should be able to find all instructions in the supertest documentation
});
