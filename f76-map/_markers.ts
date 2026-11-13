import type { Database } from "bun:sqlite";
import { getDb } from "../db";
import {
	DB_PATH, TABLE_NAME_COMPONENTS, TABLE_NAME_ITEM_COMPONENTS, TABLE_NAME_ITEM_POINTS, TABLE_NAME_ITEMS, TABLE_NAME_LAYERS,
	TABLE_NAME_MARKERS, TABLE_NAME_OBJECTS, TABLE_NAME_PLACES, TABLE_NAME_REGIONS, TABLE_NAME_ZONES
} from "./constants";

import type {
	MapComponent, MapData, MapItem, MapItemCatalog, MapItemPoints, MapItemSummary, MapLayer, MapLayerContents, MapMarker, MapObject, MapPlace,
	MapRegion
} from "./types";

type MarkerRow = Omit<MapMarker, "isPts" | "initiallyDisabled"> & { isPts: number; initiallyDisabled: number };
type ObjectRow = Omit<MapObject, "isPts" | "inside"> & { isPts: number; inside: number };
type LayerRow = Omit<MapLayer, "isPts"> & { isPts: number };
type ZoneRow = { kind: string; rings: string };
type ItemRow = Omit<MapItem, "isPts" | "components"> & { isPts: number };
type ItemPointRow = { itemId: string; placeFormId: string | null; mapX: number; mapY: number; count: number; inside: number; isPts: number };

export class Markers {
	#db: Database;

	constructor() {
		this.#db = getDb(DB_PATH);
	}

	async getMapData(): Promise<MapData> {
		const regions = this.#db.query<MapRegion, []>(
			`SELECT formId, nameEn, nameRu FROM ${TABLE_NAME_REGIONS} ORDER BY nameRu`
		).all();

		const markers = this.#db.query<MarkerRow, []>(
			`SELECT formId, kind, icon, nameEn, nameRu, regionFormId, mapX, mapY, x, y, isPts, initiallyDisabled, textColor, backgroundColor
			FROM ${TABLE_NAME_MARKERS} ORDER BY nameRu`
		).all().map(m => ({ ...m, isPts: m.isPts === 1, initiallyDisabled: m.initiallyDisabled === 1 }));

		const layers = this.#db.query<LayerRow, []>(
			`SELECT id, kind, nameEn, nameRu, count, isPts FROM ${TABLE_NAME_LAYERS} ORDER BY nameRu`
		).all().map(l => ({ ...l, isPts: l.isPts === 1 }));

		const components = this.#db.query<MapComponent, []>(
			`SELECT formId, nameEn, nameRu FROM ${TABLE_NAME_COMPONENTS} ORDER BY nameRu`
		).all();

		const ores = this.#db.query<MapItemSummary, []>(
			`SELECT id, nameEn, nameRu, count FROM ${TABLE_NAME_ITEMS} WHERE category = 'ore' ORDER BY nameRu`
		).all();

		return { regions, markers, layers, components, ores };
	}

	async getLayer(layerId: string): Promise<MapLayerContents | null> {
		const layer = this.#db.query<{ kind: MapLayer["kind"] }, [string]>(`SELECT kind FROM ${TABLE_NAME_LAYERS} WHERE id = ?`).get(layerId);
		if (!layer) return null;

		if (layer.kind === "zones") {
			const zones = this.#db.query<ZoneRow, [string]>(
				`SELECT kind, rings FROM ${TABLE_NAME_ZONES} WHERE layerId = ? ORDER BY id`
			).all(layerId).map(z => ({ kind: z.kind, rings: JSON.parse(z.rings) as number[][] }));
			return { kind: "zones", zones };
		}

		const objects = this.#db.query<ObjectRow, [string]>(
			`SELECT o.formId, o.nameEn, o.nameRu, o.regionFormId, p.nameEn AS placeNameEn, p.nameRu AS placeNameRu,
				o.inside, o.count, o.mapX, o.mapY, o.isPts
			FROM ${TABLE_NAME_OBJECTS} o LEFT JOIN ${TABLE_NAME_PLACES} p ON p.formId = o.placeFormId
			WHERE o.layerId = ? ORDER BY p.nameRu, o.formId`
		).all(layerId).map(o => ({ ...o, inside: o.inside === 1, isPts: o.isPts === 1 }));
		return { kind: "points", objects };
	}

	async getItemCatalog(): Promise<MapItemCatalog> {
		const components = this.#db.query<MapComponent, []>(
			`SELECT formId, nameEn, nameRu FROM ${TABLE_NAME_COMPONENTS} ORDER BY nameRu`
		).all();
		const componentIndex = new Map(components.map((c, i) => [c.formId, i]));

		const itemComponents = new Map<string, number[]>();
		for (const row of this.#db.query<{ itemId: string; componentFormId: string }, []>(
			`SELECT itemId, componentFormId FROM ${TABLE_NAME_ITEM_COMPONENTS}`
		).all()) {
			const list = itemComponents.get(row.itemId) ?? [];
			list.push(componentIndex.get(row.componentFormId)!);
			itemComponents.set(row.itemId, list);
		}

		const items = this.#db.query<ItemRow, []>(
			`SELECT id, category, nameEn, nameRu, count, isPts FROM ${TABLE_NAME_ITEMS} ORDER BY nameRu`
		).all().map(i => ({ ...i, isPts: i.isPts === 1, components: itemComponents.get(i.id) ?? [] }));

		return { components, items };
	}

	async getItemPoints(itemId: string): Promise<MapItemPoints | null> {
		const item = this.#db.query<{ id: string }, [string]>(`SELECT id FROM ${TABLE_NAME_ITEMS} WHERE id = ?`).get(itemId);
		if (!item) return null;

		return this.#packPoints(this.#db.query<ItemPointRow, [string]>(
			`SELECT itemId, placeFormId, mapX, mapY, count, inside, isPts FROM ${TABLE_NAME_ITEM_POINTS} WHERE itemId = ?`
		).all(itemId));
	}

	// Points of every item that scraps into the component
	async getComponentPoints(componentId: string): Promise<MapItemPoints | null> {
		const component = this.#db.query<{ formId: string }, [string]>(`SELECT formId FROM ${TABLE_NAME_COMPONENTS} WHERE formId = ?`).get(componentId);
		if (!component) return null;

		return this.#packPoints(this.#db.query<ItemPointRow, [string]>(
			`SELECT p.itemId, p.placeFormId, p.mapX, p.mapY, p.count, p.inside, p.isPts
			FROM ${TABLE_NAME_ITEM_COMPONENTS} ic JOIN ${TABLE_NAME_ITEM_POINTS} p ON p.itemId = ic.itemId
			WHERE ic.componentFormId = ?`
		).all(componentId));
	}

	#packPoints(rows: ItemPointRow[]): MapItemPoints {
		const items: string[] = [];
		const itemIndex = new Map<string, number>();
		const placeIndex = new Map<string, number>();
		const placeIds: string[] = [];

		const points = rows.map(r => {
			let i = itemIndex.get(r.itemId);
			if (i === undefined) {
				i = items.push(r.itemId) - 1;
				itemIndex.set(r.itemId, i);
			}
			let p = -1;
			if (r.placeFormId) {
				p = placeIndex.get(r.placeFormId) ?? -1;
				if (p === -1) {
					p = placeIds.push(r.placeFormId) - 1;
					placeIndex.set(r.placeFormId, p);
				}
			}
			return [r.mapX, r.mapY, i, p, r.count, r.inside, r.isPts];
		});

		const itemSummaries = new Map(this.#db.query<MapItemSummary, string[]>(
			`SELECT id, nameEn, nameRu, count FROM ${TABLE_NAME_ITEMS} WHERE id IN (${items.map(() => "?").join(",")})`
		).all(...items).map(i => [i.id, i]));

		let places: MapPlace[] = [];
		if (placeIds.length > 0) {
			const byId = new Map(this.#db.query<MapPlace, string[]>(
				`SELECT formId, nameEn, nameRu FROM ${TABLE_NAME_PLACES} WHERE formId IN (${placeIds.map(() => "?").join(",")})`
			).all(...placeIds).map(p => [p.formId, p]));
			places = placeIds.map(id => byId.get(id)!);
		}

		return { items: items.map(id => itemSummaries.get(id)!), places, points };
	}
}
