const loveletter = require('./loveletter');
const coup = require('./coup');
const guessnumber = require('./guessnumber');
const monopoly = require('./monopoly');
const monopolydeal = require('./monopolydeal');
const chess = require('./chess');
const xiangqi = require('./xiangqi');
const jungle = require('./jungle');
const gobang = require('./gobang');
const checkers = require('./checkers');
const aeroplane = require('./aeroplane');
const junqi = require('./junqi');
const takefive = require('./takefive');
const hanabi = require('./hanabi');
const splendor = require('./splendor');
const kingdomino = require('./kingdomino');
const acquire = require('./acquire');
const citadels = require('./citadels');
const witchtown = require('./witchtown');
const lasvegas = require('./lasvegas');
const avalon = require('./avalon');
const scout = require('./scout');
const decrypto = require('./decrypto');
const manila = require('./manila');
const modernart = require('./modernart');
const camelup = require('./camelup');
const magicalathlete = require('./magicalathlete');
const werewolf = require('./werewolf');
const { decorateGameMetadata } = require('./groups');

const games = new Map([
    [loveletter.metadata.type, loveletter],
    [coup.metadata.type, coup],
    [guessnumber.metadata.type, guessnumber],
    [monopoly.metadata.type, monopoly],
    [monopolydeal.metadata.type, monopolydeal],
    [chess.metadata.type, chess],
    [xiangqi.metadata.type, xiangqi],
    [jungle.metadata.type, jungle],
    [gobang.metadata.type, gobang],
    [checkers.metadata.type, checkers],
    [aeroplane.metadata.type, aeroplane],
    [junqi.metadata.type, junqi],
    [takefive.metadata.type, takefive],
    [hanabi.metadata.type, hanabi],
    [splendor.metadata.type, splendor],
    [kingdomino.metadata.type, kingdomino],
    [acquire.metadata.type, acquire],
    [citadels.metadata.type, citadels],
    [witchtown.metadata.type, witchtown],
    [lasvegas.metadata.type, lasvegas],
    [avalon.metadata.type, avalon],
    [scout.metadata.type, scout],
    [decrypto.metadata.type, decrypto],
    [manila.metadata.type, manila],
    [modernart.metadata.type, modernart],
    [camelup.metadata.type, camelup],
    [magicalathlete.metadata.type, magicalathlete],
    [werewolf.metadata.type, werewolf],
]);

function getGame(type) {
    return games.get(type) || null;
}

function listGames() {
    return Array.from(games.values())
        .map(game => decorateGameMetadata(game.metadata))
        .sort((a, b) => (a.groupOrder || 99) - (b.groupOrder || 99) || (a.sortOrder || 999) - (b.sortOrder || 999));
}

module.exports = {
    getGame,
    listGames,
};
