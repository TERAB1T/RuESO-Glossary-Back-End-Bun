import type { Database } from "bun:sqlite";
import { getDb } from "../db";
import { DB_PATH, TABLE_NAME_CRATES, TABLE_NAME_CRATE_CARDS, TABLE_NAME_REWARDS, LIST_COLUMNS } from "./constants";

import type { Crate, CrateCard, CrateListItem, Reward } from "./types";

type CrateRow<T> = Omit<T, "isPTS"> & { isPTS: number };

export class Crates {
	#db: Database;

	constructor() {
		this.#db = getDb(DB_PATH);
	}

	async getCrates(): Promise<CrateListItem[]> {
		return this.#db.query<CrateRow<CrateListItem>, []>(
			`SELECT ${LIST_COLUMNS} FROM ${TABLE_NAME_CRATES} ORDER BY orderId`
		).all().map(crate => ({ ...crate, isPTS: crate.isPTS === 1 }));
	}

	async getCrate(crateId: number): Promise<Crate | null> {
		const crate = this.#db.query<CrateRow<Omit<Crate, "cards" | "rewards">>, [number]>(
			`SELECT ${LIST_COLUMNS}, descriptionEn, descriptionRu, noteEn, noteRu FROM ${TABLE_NAME_CRATES} WHERE id = ?`
		).get(crateId);

		if (!crate) return null;

		const cardRows = this.#db.query<{ card: number; tier: number }, [number]>(
			`SELECT card, tier FROM ${TABLE_NAME_CRATE_CARDS} WHERE crateId = ? ORDER BY card, tier`
		).all(crateId);

		const cards: CrateCard[] = [];
		for (const row of cardRows) {
			const last = cards[cards.length - 1];
			if (last?.card === row.card) last.tiers.push(row.tier);
			else cards.push({ card: row.card, tiers: [row.tier] });
		}

		const rewards = this.#db.query<Reward, [number]>(
			`SELECT productId, tier, position, collectibleId, itemId, nameEn, nameRu, typeEn, typeRu,
				descriptionEn, descriptionRu, flavorEn, flavorRu, cooldownMs, count, price, extraction, card, cardSmall, image, icon
			FROM ${TABLE_NAME_REWARDS} WHERE crateId = ? ORDER BY tier DESC, position`
		).all(crateId);

		return { ...crate, isPTS: crate.isPTS === 1, cards, rewards };
	}
}
