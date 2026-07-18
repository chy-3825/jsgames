const loveletter = require('./loveletter');
const coup = require('./coup');

const games = new Map([
    [loveletter.metadata.type, loveletter],
    [coup.metadata.type, coup],
]);

function getGame(type) {
    return games.get(type) || null;
}

function listGames() {
    return Array.from(games.values()).map(game => game.metadata);
}

module.exports = {
    getGame,
    listGames,
};
