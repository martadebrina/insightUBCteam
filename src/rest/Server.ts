import express, { Application, Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import Log from "@ubccpsc310/folder-test/build/Log";
import * as http from "http";
import cors from "cors";
import InsightFacade from "../controller/InsightFacade";
import { InsightDatasetKind, InsightError, NotFoundError } from "../controller/IInsightFacade";

export default class Server {
	private readonly port: number;
	private express: Application;
	private server: http.Server | undefined;

	constructor(port: number) {
		Log.info(`Server::<init>( ${port} )`);
		this.port = port;
		this.express = express();

		this.registerMiddleware();
		this.registerRoutes();

		// NOTE: you can serve static frontend files in from your express server
		// by uncommenting the line below. This makes files in ./frontend/public
		// accessible at http://localhost:<port>/
		this.express.use(express.static("./frontend/public"));
	}

	/**
	 * Starts the server. Returns a promise that resolves if success. Promises are used
	 * here because starting the server takes some time and we want to know when it
	 * is done (and if it worked).
	 *
	 * @returns {Promise<void>}
	 */
	public async start(): Promise<void> {
		return new Promise((resolve, reject) => {
			Log.info("Server::start() - start");
			if (this.server !== undefined) {
				Log.error("Server::start() - server already listening");
				reject();
			} else {
				this.server = this.express
					.listen(this.port, () => {
						Log.info(`Server::start() - server listening on port: ${this.port}`);
						resolve();
					})
					.on("error", (err: Error) => {
						// catches errors in server start
						Log.error(`Server::start() - server ERROR: ${err.message}`);
						reject(err);
					});
			}
		});
	}

	/**
	 * Stops the server. Again returns a promise so we know when the connections have
	 * actually been fully closed and the port has been released.
	 *
	 * @returns {Promise<void>}
	 */
	public async stop(): Promise<void> {
		Log.info("Server::stop()");
		return new Promise((resolve, reject) => {
			if (this.server === undefined) {
				Log.error("Server::stop() - ERROR: server not started");
				reject();
			} else {
				this.server.close(() => {
					Log.info("Server::stop() - server closed");
					resolve();
				});
			}
		});
	}

	// Registers middleware to parse request before passing them to request handlers
	private registerMiddleware(): void {
		// JSON parser must be place before raw parser because of wildcard matching done by raw parser below
		this.express.use(express.json());
		this.express.use(express.raw({ type: "application/*", limit: "10mb" }));

		// enable cors in request headers to allow cross-origin HTTP requests
		this.express.use(cors());
	}

	// Registers all request handlers to routes
	private registerRoutes(): void {
		// This is an example endpoint this you can invoke by accessing this URL in your browser:
		// http://localhost:4321/echo/hello
		this.express.get("/echo/:msg", Server.echo);

		// TODO: your other endpoints should go here
		const insightFacade = new InsightFacade();

		this.express.put("/dataset/:id/:kind", async (req, res) => this.handlePutDataset(req, res, insightFacade));
		this.express.delete("/dataset/:id", async (req, res) => this.handleDeleteDataset(req, res, insightFacade));
		this.express.post("/query", async (req, res) => this.handlePostQuery(req, res, insightFacade));
		this.express.get("/datasets", async (req, res) => this.handleGetDatasets(req, res, insightFacade));
	}

	private async handlePutDataset(req: Request, res: Response, insightFacade: InsightFacade): Promise<void> {
		const { id, kind } = req.params;
		const content = req.body.toString("base64");
		const success = 200;
		const reject = 400;

		try {
			let insightDatasetKind;
			if (kind === "sections") {
				insightDatasetKind = InsightDatasetKind.Sections;
			} else if (kind === "rooms") {
				insightDatasetKind = InsightDatasetKind.Rooms;
			} else {
				throw new InsightError("Invalid dataset kind");
			}
			const results = await insightFacade.addDataset(id, content, insightDatasetKind);
			res.status(success).json({ result: results });
		} catch (_err) {
			res.status(reject).json({ error: (_err as any).message });
		}
	}

	private async handleDeleteDataset(req: Request, res: Response, insightFacade: InsightFacade): Promise<void> {
		const { id } = req.params;
		const success = 200;
		const reject = 400;
		const notFound = 404;

		try {
			const results = await insightFacade.removeDataset(id);
			res.status(success).json({ result: results });
		} catch (_err) {
			if (_err instanceof InsightError) {
				res.status(reject).json({ error: (_err as any).message });
			} else if (_err instanceof NotFoundError) {
				res.status(notFound).json({ error: (_err as any).message });
			}
		}
	}

	private async handlePostQuery(req: Request, res: Response, insightFacade: InsightFacade): Promise<void> {
		const { query } = req.params;
		const success = 200;
		const reject = 400;

		try {
			const results = await insightFacade.performQuery(query);
			res.status(success).json({ result: results });
		} catch (_err) {
			res.status(reject).json({ error: (_err as any).message });
		}
	}

	private async handleGetDatasets(_req: Request, res: Response, insightFacade: InsightFacade): Promise<void> {
		const success = 200;
		const results = await insightFacade.listDatasets();
		res.status(success).json({ result: results });
	}

	// The next two methods handle the echo service.
	// These are almost certainly not the best place to put these, but are here for your reference.
	// By updating the Server.echo function pointer above, these methods can be easily moved.
	private static echo(req: Request, res: Response): void {
		try {
			Log.info(`Server::echo(..) - params: ${JSON.stringify(req.params)}`);
			const response = Server.performEcho(req.params.msg);
			res.status(StatusCodes.OK).json({ result: response });
		} catch (err) {
			res.status(StatusCodes.BAD_REQUEST).json({ error: err });
		}
	}

	private static performEcho(msg: string): string {
		if (typeof msg !== "undefined" && msg !== null) {
			return `${msg}...${msg}`;
		} else {
			return "Message not provided";
		}
	}
}
