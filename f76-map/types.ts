export interface MapRegion {
	formId: string;
	nameEn: string;
	nameRu: string;
}

export interface MapMarker {
	formId: string;
	// "location" is a map marker, "region" is a region name label.
	kind: "location" | "region";
	// Symbol class in the game's mapmarkerslibrary.swf; icons are served as <icon>.svg.
	icon: string;
	nameEn: string;
	nameRu: string;
	regionFormId: string | null;
	// Position in pixels of the 4096×4096 map texture, origin top left.
	mapX: number;
	mapY: number;
	// Game world coordinates.
	x: number;
	y: number;
	isPts: boolean;
	initiallyDisabled: boolean;
}

// A layer of points (collectible spawns, vendors) or of areas (C.A.M.P. zones); its contents are loaded separately.
export interface MapLayer {
	id: string;
	kind: "points" | "zones";
	nameEn: string;
	nameRu: string;
	count: number;
	// Every point of the layer is new on PTS
	isPts: boolean;
}

export interface MapObject {
	formId: string;
	// Own name of the point (a vendor); null means the layer's name.
	nameEn: string | null;
	nameRu: string | null;
	regionFormId: string | null;
	// Named location of the point, or the interior it is in; null in the wilderness.
	placeNameEn: string | null;
	placeNameRu: string | null;
	// Inside an interior: the point is the interior's entrance and count is the number of copies inside.
	inside: boolean;
	count: number;
	mapX: number;
	mapY: number;
	isPts: boolean;
}

// An area of a zone layer: the outer ring and its holes, each in map pixels: x0, y0, x1, y1, …
// Areas of one layer never overlap.
export interface MapZone {
	// C.A.M.P. zones: "allowed" — the game doesn't forbid a camp here, "blocked" — it does
	kind: string;
	rings: number[][];
}

export type MapLayerContents =
	| { kind: "points"; objects: MapObject[] }
	| { kind: "zones"; zones: MapZone[] };

export interface MapData {
	regions: MapRegion[];
	markers: MapMarker[];
	layers: MapLayer[];
	// Resources to look for without the item catalog: junk components and ore veins
	components: MapComponent[];
	ores: MapItemSummary[];
}

export interface MapItemSummary {
	id: string;
	nameEn: string;
	nameRu: string;
	count: number;
}

export interface MapComponent {
	formId: string;
	nameEn: string;
	nameRu: string;
}

export interface MapItem {
	id: string;
	// junk, misc, weapon, apparel, aid, book, ammo, note, key, flora, ore
	category: string;
	nameEn: string;
	nameRu: string;
	// Placed copies, counting every copy inside interiors
	count: number;
	isPts: boolean;
	// Indexes into MapItemCatalog.components
	components: number[];
}

export interface MapItemCatalog {
	components: MapComponent[];
	items: MapItem[];
}

export interface MapPlace {
	formId: string;
	nameEn: string;
	nameRu: string;
}

// Compact on purpose: a common item has tens of thousands of points.
// Point: [mapX, mapY, itemIndex, placeIndex (-1 — wilderness), count, inside (0/1), isPts (0/1)].
export interface MapItemPoints {
	items: MapItemSummary[];
	places: MapPlace[];
	points: number[][];
}
