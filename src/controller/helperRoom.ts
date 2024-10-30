import { InsightError } from "./IInsightFacade";
import JSZip from "jszip";
import * as parse5 from "parse5";
import * as http from "node:http";

export class HelperRoom {
	public async extractRoomData(buildingLinks: string[], buildings: any[], zipData: JSZip): Promise<any[]> {
		let j = 0;
		const roomPromises = buildingLinks.map(async (link, index) => {
			const building = buildings[index];
			const roomFilePath = await this.getRoomFilePath(zipData, link);
			const roomFile = zipData.file(roomFilePath);
			//console.log(roomFile);
			if (!roomFile) {
				return [];
			}

			const roomContent = await roomFile.async("string");
			const roomDocument = parse5.parse(roomContent);

			// find room table
			const tables = this.findAllNodesByName(roomDocument, "table");
			const roomTable = tables.find((table) => this.isValidRoomTable(table));
			//console.log(roomTable);
			if (!roomTable) {
				throw new InsightError("no valid room table");
			}
			//console.log(this.extractRoom(roomTable, building))
			j++;
			return await this.extractRoom(roomTable, building);
		});
		//console.log(roomPromises);
		const roomPromises2 = (await Promise.allSettled(roomPromises)).flat();
		const rooms = roomPromises2
			.map((result) => {
				if (result.status === "fulfilled") {
					return result.value;
				}
			})
			.flat();
		//console.log(j);
		return rooms;
	}

	public isValidBuildingTable(table: any): boolean {
		// we want to find <tbody> node in the table
		const tbody = table.childNodes.find((child: any) => child.nodeName === "tbody");
		if (!tbody) {
			//gadak isi tabelnya
			return false;
		}
		if (!tbody.childNodes) {
			//gadak anaknya
			return false;
		}
		let hasTitleField = false;
		let hasAddressField = false;

		// iterate each <tr>
		for (const tr of tbody.childNodes) {
			if (tr.nodeName === "tr" && tr.childNodes) {
				// iterate each (<td>)
				for (const td of tr.childNodes) {
					if (td.nodeName === "td" && td.attrs) {
						// from CHATGPT
						// check if this <td> has the "views-field-title" class
						if (td.attrs.some((attr: any) => attr.name === "class" && attr.value.includes("views-field-title"))) {
							hasTitleField = true;
						}
						// check if this <td> has the "views-field-field-building-address" class
						if (
							td.attrs.some(
								(attr: any) => attr.name === "class" && attr.value.includes("views-field-field-building-address")
							)
						) {
							hasAddressField = true;
						}
					}

					if (hasTitleField && hasAddressField) {
						return true;
					}
				}
			}
		}

		return false;
	}

	public async getRoomFilePath(zipData: JSZip, link: string): Promise<string> {
		// from ChatGPT
		const num = 2;
		const adjustedLink = link.startsWith("./") ? link.slice(num) : link;
		return Object.keys(zipData.files).find((path) => path.endsWith(adjustedLink)) || adjustedLink;
	}

	public async extractRoom(roomTable: any, building: any): Promise<any[]> {
		const rooms: any[] = [];
		const tbody = roomTable.childNodes.find((child: any) => child.nodeName === "tbody");

		for (const tr of tbody.childNodes) {
			if (tr.nodeName === "tr" && tr.childNodes) {
				const roomData: any = {
					fullname: building.fullname,
					shortname: building.shortname,
					address: building.address,
					lat: building.lat,
					lon: building.lon,
				};

				for (const td of tr.childNodes) {
					if (td.nodeName === "td" && td.attrs) {
						this.getRoomAttribute(td, roomData);
					}
				}
				roomData.name = `${roomData.shortname}_${roomData.number}`;
				if (Object.keys(roomData).length > 0) {
					rooms.push(roomData);
				}
			}
		}
		return rooms;
	}

	public getRoomAttribute(td: any, roomData: any): void {
		const classAttr = td.attrs.find((attr: any) => attr.name === "class");
		if (classAttr) {
			if (classAttr.value.includes("views-field views-field-field-room-number")) {
				roomData.number = td.childNodes[1].childNodes[0]?.value.trim();
				//console.log(roomData.number);
			} else if (classAttr.value.includes("views-field views-field-field-room-capacity")) {
				roomData.seats = parseInt(td.childNodes[0]?.value.trim(), 10);
			} else if (classAttr.value.includes("views-field views-field-field-room-furniture")) {
				roomData.furniture = td.childNodes[0]?.value.trim();
				//console.log(roomData.furniture);
			} else if (classAttr.value.includes("views-field views-field-field-room-type")) {
				roomData.type = td.childNodes[0]?.value.trim();
			} else if (classAttr.value.includes("views-field views-field-nothing")) {
				const link = td.childNodes.find((node: any) => node.nodeName === "a");
				if (link?.attrs) {
					const hrefAttr = link.attrs.find((attr: any) => attr.name === "href");
					if (hrefAttr) {
						roomData.href = hrefAttr.value;
					}
				}
			}
		}
	}

	public isValidRoomTable(table: any): boolean {
		const tbody = table.childNodes.find((child: any) => child.nodeName === "tbody");
		if (!tbody?.childNodes) {
			return false;
		}
		let hasRoomNumber = false;
		let hasCapacity = false;
		let hasFurniture = false;
		let hasRoomType = false;

		for (const tr of tbody.childNodes) {
			if (tr.nodeName === "tr" && tr.childNodes) {
				for (const td of tr.childNodes) {
					if (td.nodeName === "td" && td.attrs) {
						const classAttr = td.attrs.find((attr: any) => attr.name === "class");
						if (classAttr) {
							hasRoomNumber ||= this.hasField(classAttr, "views-field views-field-field-room-number");
							hasCapacity ||= this.hasField(classAttr, "views-field views-field-field-room-capacity");
							hasFurniture ||= this.hasField(classAttr, "views-field views-field-field-room-furniture");
							hasRoomType ||= this.hasField(classAttr, "views-field views-field-field-room-type");
						}

						// If we have all indicators, we’ve found a valid room table
						if (hasRoomNumber && hasCapacity && hasFurniture && hasRoomType) {
							return true;
						}
					}
				}
			}
		}
		return false;
	}

	public processBuildingRow(row: any, buildingLinks: string[]): any {
		const buildingData: any = {};

		for (const td of row.childNodes) {
			if (td.nodeName === "td" && td.attrs) {
				const classAttr = td.attrs.find((attr: any) => attr.name === "class")?.value;

				if (classAttr) {
					if (classAttr.includes("views-field-title")) {
						const linkElement = td.childNodes.find((node: any) => node.nodeName === "a");
						const hrefAttr = linkElement?.attrs?.find((attr: any) => attr.name === "href")?.value;
						if (hrefAttr) {
							buildingLinks.push(hrefAttr);
						}
						buildingData.fullname = linkElement?.childNodes[0]?.value.trim();
					} else if (classAttr.includes("views-field-field-building-code")) {
						buildingData.shortname = td.childNodes[0]?.value.trim();
					} else if (classAttr.includes("views-field-field-building-address")) {
						buildingData.address = td.childNodes[0]?.value.trim();
					}
				}
			}
		}
		return buildingData;
	}

	public hasField(classAttr: any, fieldName: string): boolean {
		return classAttr.value.includes(fieldName);
	}

	public findAllNodesByName(node: any, name: string): any[] {
		const nodes: any[] = [];
		// base case
		if (node.nodeName === name) {
			nodes.push(node);
		}
		// recursively search the node
		if (node.childNodes) {
			for (const child of node.childNodes) {
				nodes.push(...this.findAllNodesByName(child, name));
			}
		}
		return nodes;
	}

	public extractBuildingsData(buildingTable: any): { buildings: any[]; buildingLinks: string[] } {
		const buildings: any[] = [];
		const buildingLinks: string[] = [];

		const tbody = buildingTable.childNodes.find((node: any) => node.nodeName === "tbody");
		if (!tbody) {
			throw new InsightError("invalid tbody in table");
		}

		for (const tr of tbody.childNodes) {
			if (tr.nodeName === "tr" && tr.childNodes) {
				const buildingData = this.processBuildingRow(tr, buildingLinks);
				if (Object.keys(buildingData).length > 0) {
					buildings.push(buildingData);
				}
			}
		}
		return { buildings, buildingLinks };
	}

	public async assignLatLon(buildings: any[]): Promise<void> {
		let i =0;
		const geolocationPromises = buildings.map(async (building) => {
			//console.log(building.address);
			const geolocation = await this.getGeolocation(building.address);
			//console.log(geolocation);
			i++;
			if (geolocation.lat !== undefined || geolocation.lon !== undefined) {
				building.lat = geolocation.lat;
				building.lon = geolocation.lon;
			} else {
				throw new InsightError("no geo");
			}
		});
		//console.log(i);
		await Promise.all(geolocationPromises);
	}

	public async getGeolocation(address: string): Promise<any> {
		// const http = require("node:http");
		return new Promise((resolve, reject) => {
			const encodedAddress = encodeURIComponent(address);
			const url = `http://cs310.students.cs.ubc.ca:11316/api/v1/project_team139/${encodedAddress}`;

			http
				.get(url, (res) => {
					let data = "";
					res.on("data", (chunk) => {
						data += chunk;
					});

					const successful = 200;
					res.on("end", () => {
						if (res.statusCode === successful) {
							try {
								const json = JSON.parse(data);
								resolve(json);
							} catch (_error) {
								reject(new InsightError("Failed to parse response"));
							}
						} else {
							reject(new InsightError("Failed to parse response"));
						}
					});
				})
				.on("error", (error) => {
					reject(error);
				});
		});
	}
}
