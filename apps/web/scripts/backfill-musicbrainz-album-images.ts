import { backfillMusicBrainzAlbumImages } from "../src/server/entity-resolver.server";

const result = await backfillMusicBrainzAlbumImages();

console.log(JSON.stringify(result, null, 2));
