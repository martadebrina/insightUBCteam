import {
	IInsightFacade,
	InsightDataset,
	InsightDatasetKind,
	InsightResult,
	NotFoundError,
	InsightError,
} from "./IInsightFacade";
import JSZip from "jszip";
import * as fs from "fs-extra";
import * as path from "path";

const DEFAULT_YEAR = 1900;
const DATA_DIR = path.join(process.cwd(), "data");

export class Section {
	public section: string;
	public uuid: string;
	public year: number;
	public instructor: string;
	public avg: number;
	public pass: number;
	public fail: number;
	public audit: number;

	constructor(
		section: string,
		uuid: string,
		year: number,
		instructor: string,
		avg: number,
		pass: number,
		fail: number,
		audit: number
	) {
		this.section = section;
		this.uuid = uuid;
		this.year = year;
		this.instructor = instructor;
		this.avg = avg;
		this.pass = pass;
		this.fail = fail;
		this.audit = audit;
	}

	public toJSON(): any {
		return {
			section: this.section,
			uuid: this.uuid,
			year: this.year,
			instructor: this.instructor,
			avg: this.avg,
			pass: this.pass,
			fail: this.fail,
			audit: this.audit,
		};
	}
}

class Course {
	public dept: string;
	public id: string;
	public title: string;
	public sections: Section[];

	constructor(dept: string, id: string, title: string) {
		this.dept = dept;
		this.id = id;
		this.title = title;
		this.sections = [];
	}

	public addSection(section: Section): void {
		this.sections.push(section);
	}

	public toJSON(): any {
		return {
			dept: this.dept,
			id: this.id,
			title: this.title,
			sections: this.sections.map((section) => section.toJSON()),
		};
	}
}

export default class InsightFacade implements IInsightFacade {
	private datasets: Map<string, Course[]>;

	constructor() {
		this.datasets = new Map<string, Course[]>();
		// void this.loadDatasetsFromDisk().catch((_error) => {
		// 	throw new InsightError("");
		// });
	}

	public async addDataset(id: string, content: string, kind: InsightDatasetKind): Promise<string[]> {
		if (!this.isValidId(id)) {
			throw new InsightError("Invalid id");
		}

		if (kind !== InsightDatasetKind.Sections) {
			throw new InsightError("Invalid dataset kind");
		}

		if (this.datasets.has(id)) {
			throw new InsightError(`Dataset with id '${id}' already exists`);
		}

		let zipData: JSZip;
		try {
			const data = Buffer.from(content, "base64");
			zipData = await JSZip.loadAsync(data);
		} catch (_error) {
			throw new InsightError("Failed to parse zip file");
		}

		const courses = await this.processZipFile(zipData);

		if (courses.length === 0) {
			throw new InsightError("No valid courses found in dataset");
		}

		// await this.saveDatasetToDisk(id, courses);
		this.datasets.set(id, courses);

		return Array.from(this.datasets.keys());
	}

	public async removeDataset(id: string): Promise<string> {
		if (!this.isValidId(id)) {
			throw new InsightError("Invalid id");
		}

		if (!this.datasets.has(id)) {
			throw new NotFoundError(`Dataset with id '${id}' does not exist`);
		}

		this.datasets.delete(id);
		const filePath = path.join(DATA_DIR, `${id}.json`);

		try {
			await fs.remove(filePath);
		} catch (_error) {
			throw new InsightError("Failed to remove dataset from disk");
		}

		return id;
	}

	public async performQuery(query: unknown): Promise<InsightResult[]> {
		throw new Error(`InsightFacadeImpl::performQuery() is unimplemented! - query=${query};`);
	}

	public async listDatasets(): Promise<InsightDataset[]> {
		return this.getDatasetList();
	}

	private isValidId(id: string): boolean {
		if (typeof id !== "string") {
			return false;
		}
		const trimmedId = id.trim();
		return trimmedId.length > 0 && !trimmedId.includes("_");
	}

	private async processZipFile(zip: JSZip): Promise<Course[]> {
		const coursesMap = new Map<string, Course>();
		const coursesFolder = zip.folder("courses");

		if (!coursesFolder) {
			throw new InsightError("The zip file does not contain a 'courses' folder");
		}

		const files = coursesFolder.filter((_relativePath, file) => !file.dir);
		const filePromises = files.map(async (file) => this.processFile(file, coursesMap));

		await Promise.all(filePromises);
		return Array.from(coursesMap.values());
	}

	private async processFile(file: JSZip.JSZipObject, coursesMap: Map<string, Course>): Promise<void> {
		try {
			const content = await file.async("text");
			const json = JSON.parse(content);
			const result = json.result;

			if (Array.isArray(result)) {
				for (const rawSection of result) {
					if (this.isValidSection(rawSection)) {
						const courseKey = `${rawSection.Subject}${rawSection.Course}`;
						const section = this.parseSection(rawSection);

						let course = coursesMap.get(courseKey);
						if (!course) {
							course = new Course(rawSection.Subject, rawSection.Course, rawSection.Title);
							coursesMap.set(courseKey, course);
						}

						course.addSection(section);
					}
				}
			}
		} catch (_error) {
			// Skip file if parsing fails
		}
	}

	private isValidSection(section: any): boolean {
		return (
			section &&
			typeof section.Subject === "string" &&
			typeof section.Course === "string" &&
			!isNaN(Number(section.Avg)) &&
			typeof section.Professor === "string" &&
			typeof section.Title === "string" &&
			!isNaN(Number(section.Pass)) &&
			!isNaN(Number(section.Fail)) &&
			!isNaN(Number(section.Audit)) &&
			section.id !== null &&
			typeof section.Section === "string" &&
			!isNaN(Number(section.Year))
		);
	}

	private parseSection(section: any): Section {
		const year = section.Section === "overall" ? DEFAULT_YEAR : Number(section.Year);

		return new Section(
			section.Section,
			section.id.toString(),
			year,
			section.Professor || "",
			Number(section.Avg),
			Number(section.Pass),
			Number(section.Fail),
			Number(section.Audit)
		);
	}

	// private async loadDatasetsFromDisk(): Promise<void> {
	// 	try {
	// 		const exists = await fs.pathExists(DATA_DIR);
	// 		if (!exists) {
	// 			return;
	// 		}

	// 		const files = await fs.readdir(DATA_DIR);
	// 		const jsonFiles = files.filter((file) => file.endsWith(".json"));

	// 		await this.loadAllDatasets(jsonFiles);
	// 	} catch (_error) {
	// 		// console.error("Failed to read datasets from disk:", error);
	// 	}
	// }

	// private async loadAllDatasets(jsonFiles: string[]): Promise<void> {
	// 	const loadPromises = jsonFiles.map(async (file) => this.loadDatasetFromFile(file));
	// 	await Promise.all(loadPromises);
	// }

	// private async loadDatasetFromFile(file: string): Promise<void> {
	// 	const filePath = path.join(DATA_DIR, file);
	// 	try {
	// 		const serializedCourses: any[] = await fs.readJSON(filePath);
	// 		const id = path.basename(file, ".json");

	// 		const courses = serializedCourses.map((serializedCourse) => this.deserializeCourse(serializedCourse));
	// 		this.datasets.set(id, courses);
	// 	} catch (_error) {
	// 		// console.error(`Failed to load dataset from file ${file}:`, error);
	// 	}
	// }

	// private deserializeCourse(serializedCourse: any): Course {
	// 	const course = new Course(serializedCourse.dept, serializedCourse.id, serializedCourse.title);

	// 	course.sections = serializedCourse.sections.map(
	// 		(serializedSection: any) =>
	// 			new Section(
	// 				serializedSection.section,
	// 				serializedSection.uuid,
	// 				serializedSection.year,
	// 				serializedSection.instructor,
	// 				serializedSection.avg,
	// 				serializedSection.pass,
	// 				serializedSection.fail,
	// 				serializedSection.audit
	// 			)
	// 	);

	// 	return course;
	// }

	// private async saveDatasetToDisk(id: string, courses: Course[]): Promise<void> {
	// 	const filePath = path.join(DATA_DIR, `${id}.json`);

	// 	try {
	// 		await fs.ensureDir(DATA_DIR);
	// 		const serializedCourses = courses.map((course) => course.toJSON());
	// 		await fs.writeJSON(filePath, serializedCourses);
	// 	} catch (_error) {
	// 		throw new InsightError("Failed to save dataset to disk");
	// 	}
	// }

	private getDatasetList(): InsightDataset[] {
		const datasetsList: InsightDataset[] = [];

		for (const [id, courses] of this.datasets) {
			let numRows = 0;
			for (const course of courses) {
				numRows += course.sections.length;
			}
			datasetsList.push({
				id,
				kind: InsightDatasetKind.Sections,
				numRows,
			});
		}

		return datasetsList;
	}
}
