export type CrateSection = "seasonal" | "special";
export type SaleSeason = "spring" | "summer" | "autumn" | "winter";

export interface CrateListItem {
	id: number;
	slug: string;
	nameEn: string;
	nameRu: string;
	section: CrateSection;
	// Winter of saleYear runs from December of saleYear to February of saleYear + 1.
	saleSeason: SaleSeason | null;
	saleYear: number | null;
	isPTS: boolean;
	addedVersion: string;
	cardBack: string;
	// Card back shown on hover.
	cardBackGlow: string;
	image: string | null;
	rewardsCount: number;
}

// Tiers: 1 COMMON, 2 FINE, 3 SUPERIOR, 4 EPIC, 5 LEGENDARY, 6 APEX, 7 RADIANT APEX.
export interface CrateCard {
	card: number;
	tiers: number[];
}

export interface Reward {
	productId: number;
	tier: number;
	position: number;
	collectibleId: number | null;
	itemId: number | null;
	nameEn: string;
	nameRu: string;
	typeEn: string;
	typeRu: string;
	descriptionEn: string | null;
	descriptionRu: string | null;
	flavorEn: string | null;
	flavorRu: string | null;
	cooldownMs: number | null;
	count: number;
	// Gem price (0 — can't be bought for gems) and gems received for a duplicate.
	price: number;
	extraction: number;
	card: string;
	cardSmall: string;
	image: string | null;
	icon: string | null;
}

export interface Crate extends CrateListItem {
	descriptionEn: string | null;
	descriptionRu: string | null;
	noteEn: string | null;
	noteRu: string | null;
	cards: CrateCard[];
	rewards: Reward[];
}
