import { InsightDatasetKind, InsightError } from "./IInsightFacade";

export class Datasets {
	public sections: Section[];
	public rooms: Room[];
	public numRows: number;
	public kind: InsightDatasetKind;

	constructor(k: InsightDatasetKind) {
		this.sections = [];
		this.rooms = [];
		this.numRows = 0;
		this.kind = k;
	}

	public addSection(newCourse: Section): void {
		++this.numRows;
		this.sections.push(newCourse);
	}

	public addRoom(newRoom: Room): void {
		++this.numRows;
		this.rooms.push(newRoom);
	}
}

export class Section {
	public uuid: string;
	public id: string;
	public title: string;
	public instructor: string;
	public dept: string;
	public year: number;
	public avg: number;
	public pass: number;
	public fail: number;
	public audit: number;

	constructor(section: any, isRaw = true) {
		// check if section is valid
		if (!this.isValidSection(section)) {
			throw new InsightError("Undefined variable -> invalid section");
		}
		try {
			if (isRaw) {
				this.uuid = String(section.id);
				this.id = String(section.Course);
				this.title = String(section.Title);
				this.instructor = String(section.Professor);
				this.dept = String(section.Subject);
				if (section.Section === "overall") {
					this.year = 1900;
				} else {
					this.year = this.anyToNum(section.Year);
				}

				this.avg = this.anyToNum(section.Avg);
				this.pass = this.anyToNum(section.Pass);
				this.fail = this.anyToNum(section.Fail);
				this.audit = this.anyToNum(section.Audit);
			} else {
				this.uuid = section.uuid;
				this.id = section.id;
				this.title = section.title;
				this.instructor = section.instructor;
				this.dept = section.dept;
				this.year = section.year;
				this.avg = section.avg;
				this.pass = section.pass;
				this.fail = section.fail;
				this.audit = section.audit;
			}
		} catch (_err) {
			throw new InsightError("invalid variable type");
		}
	}

	public isValidSection(c: any): boolean {
		return (
			c.id !== undefined ||
			c.Course !== undefined ||
			c.title !== undefined ||
			c.Professor !== undefined ||
			c.Subject !== undefined ||
			c.Section !== undefined ||
			c.Year !== undefined ||
			c.Avg !== undefined ||
			c.Pass !== undefined ||
			c.Fail !== undefined ||
			c.Audit !== undefined
		);
	}

	public anyToNum(n: any): number {
		const num = Number(n);
		// if (isNaN(num)) {
		// 	console.log("hellp");
		// 	throw new InsightError("n is not a number");
		// }
		return num;
	}
}

export class Room {
	public fullname: string;
	public shortname: string;
	public number: string;
	public name: string;
	public address: string;
	public lat: number;
	public lon: number;
	public seats: number;
	public type: string;
	public furniture: string;
	public href: string;

	constructor(room: any) {
		// check if section is valid
		if (!this.isValidRoom(room)) {
			throw new InsightError("Undefined variable -> invalid section");
		}
		try {
			this.fullname = String(room.fullname);
			this.shortname = String(room.shortname);
			this.number = String(room.number);
			this.name = String(room.name);
			this.address = String(room.address);
			this.lat = this.anyToNum(room.lat);
			this.lon = this.anyToNum(room.lon);
			this.seats = this.anyToNum(room.seats);
			this.type = String(room.type);
			this.furniture = String(room.furniture);
			this.href = String(room.href);
		} catch (_err) {
			throw new InsightError("invalid variable type");
		}
	}

	public isValidRoom(r: any): boolean {
		return (
			r.fullname !== undefined &&
			r.shortname !== undefined &&
			r.number !== undefined &&
			r.name !== undefined &&
			r.address !== undefined &&
			r.seats !== undefined &&
			r.type !== undefined &&
			r.furniture !== undefined &&
			r.href !== undefined &&
			r.lat !== undefined &&
			r.lon !== undefined
		);
		//tambahin lat and lon
	}

	public anyToNum(n: any): number {
		const num = Number(n);
		if (isNaN(num)) {
			throw new InsightError("n is not a number");
		}
		return num;
	}
}
