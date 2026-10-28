import type { Database } from "bun:sqlite";
import { getDb } from "../db";
import { DB_PATH, TABLE_NAME_LAYERS, TABLE_NAME_MARKERS, TABLE_NAME_OBJECTS, TABLE_NAME_REGIONS } from "./constants";

import type { MapData, MapLayer, MapMarker, MapObject, MapRegion } from "./types";

type MarkerRow = Omit<MapMarker, "isPts" | "initiallyDisabled"> & { isPts: number; initiallyDisabled: number };
type ObjectRow = Omit<MapObject, "isPts"> & { isPts: number };
type LayerRow = Omit<MapLayer, "isPts"> & { isPts: number };

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
			`SELECT formId, kind, icon, nameEn, nameRu, regionFormId, mapX, mapY, x, y, isPts, initiallyDisabled
			FROM ${TABLE_NAME_MARKERS} ORDER BY nameRu`
		).all().map(m => ({ ...m, isPts: m.isPts === 1, initiallyDisabled: m.initiallyDisabled === 1 }));

		const layers = this.#db.query<LayerRow, []>(
			`SELECT id, nameEn, nameRu, count, isPts FROM ${TABLE_NAME_LAYERS} ORDER BY nameRu`
		).all().map(l => ({ ...l, isPts: l.isPts === 1 }));

		return { regions, markers, layers };
	}

	async getLayerObjects(layerId: string): Promise<MapObject[] | null> {
		const layer = this.#db.query<{ id: string }, [string]>(`SELECT id FROM ${TABLE_NAME_LAYERS} WHERE id = ?`).get(layerId);
		if (!layer) return null;

		return this.#db.query<ObjectRow, [string]>(
			`SELECT formId, regionFormId, locationNameEn, locationNameRu, mapX, mapY, x, y, isPts
			FROM ${TABLE_NAME_OBJECTS} WHERE layerId = ? ORDER BY locationNameRu, formId`
		).all(layerId).map(o => ({ ...o, isPts: o.isPts === 1 }));
	}
}
