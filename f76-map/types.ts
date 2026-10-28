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

// A layer of placed objects (e.g. event collectibles); its points are loaded separately.
export interface MapLayer {
	id: string;
	nameEn: string;
	nameRu: string;
	count: number;
	// Every point of the layer is new on PTS
	isPts: boolean;
}

export interface MapObject {
	formId: string;
	regionFormId: string | null;
	// Named location of the object's cell; null in the wilderness.
	locationNameEn: string | null;
	locationNameRu: string | null;
	mapX: number;
	mapY: number;
	x: number;
	y: number;
	isPts: boolean;
}

export interface MapData {
	regions: MapRegion[];
	markers: MapMarker[];
	layers: MapLayer[];
}
