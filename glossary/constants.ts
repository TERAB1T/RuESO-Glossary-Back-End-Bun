export type GlossaryServer = 'live' | 'pts';

export const DEFAULT_SERVER: GlossaryServer = 'live';

export const TES_DB_PATHS: Record<GlossaryServer, string> = {
	live: './db/glossary_tes_live.db',
	pts: './db/glossary_tes_pts.db',
};
export const FALLOUT_DB_PATHS: Record<GlossaryServer, string> = {
	live: './db/glossary_fallout_live.db',
	pts: './db/glossary_fallout_pts.db',
};

export const TABLE_NAME = 'glossary';
export const COLUMNS = ['game', 'type', 'en', 'ru'];

export const TES_VALID_GAMES = ['eso', 'skyrim', 'oblivion', 'morrowind', 'legends', 'blades', 'castles', 'redguard', 'battlespire', 'travels', 'arena', 'daggerfall'];
export const FALLOUT_VALID_GAMES = ['fallout 1', 'fallout 2', 'tactics', 'fallout 3', 'new vegas', 'fallout 4', 'shelter', 'fallout 76'];

// The online game is requested per server: request game → [game name stored in the DB, server].
// Both servers' DBs store the game under the same plain name.
export const TES_SERVER_GAMES: Record<string, [string, GlossaryServer]> = {
	eso_live: ['eso', 'live'],
	eso_pts: ['eso', 'pts'],
};
export const FALLOUT_SERVER_GAMES: Record<string, [string, GlossaryServer]> = {
	fallout76_live: ['fallout 76', 'live'],
	fallout76_pts: ['fallout 76', 'pts'],
};
