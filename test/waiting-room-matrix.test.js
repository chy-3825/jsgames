const assert = require('node:assert/strict');
const test = require('node:test');

const registry = require('../server/games/registry');
const Room = require('../server/room');

function supportedPlayerCounts(metadata) {
    const min = Number(metadata.minPlayers ?? 1);
    const max = Number(metadata.maxPlayers ?? min);
    if (Array.isArray(metadata.playerCounts) && metadata.playerCounts.length) {
        return metadata.playerCounts
            .map(Number)
            .filter(count => Number.isInteger(count) && count >= 2 && count <= 12);
    }
    if (min === 1 && max === 1) return [1];
    const first = Math.max(2, min);
    const last = Math.min(12, max);
    return Array.from({ length: Math.max(0, last - first + 1) }, (_, index) => first + index);
}

function roomOptions(type, playerCount) {
    if (type === 'werewolf') {
        return { playerCount, sheriffEnabled: true, winCondition: 'edge' };
    }
    if (type === 'decrypto') return { encryptorMode: 'rotation' };
    return {};
}

test('所有游戏支持的 2–12 人档位都能完成等待房间准备与开局', () => {
    const cases = [];

    for (const metadata of registry.listGames()) {
        for (const playerCount of supportedPlayerCounts(metadata)) {
            const type = metadata.type;
            const hostId = `matrix-host-${type}-${playerCount}`;
            const room = new Room(
                `matrix-${type}-${playerCount}`,
                hostId,
                '房主',
                type,
                roomOptions(type, playerCount),
                { readyCheckEnabled: true },
            );

            for (let index = 0; index < playerCount; index += 1) {
                const playerId = index === 0 ? hostId : `matrix-player-${type}-${playerCount}-${index}`;
                const result = room.addPlayer({ id: playerId, name: `玩家${index + 1}` });
                assert.equal(result.success, true, `${type} ${playerCount} 人加入失败`);
            }

            const snapshot = room.getInfo();
            assert.equal(snapshot.players.length, playerCount);
            assert.equal(snapshot.players.every(player => player.ready === true), true, `${type} ${playerCount} 人默认准备状态错误`);
            assert.equal(snapshot.players[0].seatIndex, 0);

            const member = room.players.find(player => player.id !== hostId);
            if (member) {
                assert.equal(room.setPlayerReady(hostId, false).success, false, `${type} 不应要求房主准备`);
                assert.equal(room.setPlayerReady(member.id, false).success, true);
                const blocked = room.startGame();
                assert.equal(blocked.success, false, `${type} ${playerCount} 人未准备时错误开局`);
                assert.match(blocked.message, /所有成员准备/);
                assert.equal(room.setPlayerReady(member.id, true).success, true);
            }

            const started = room.startGame();
            assert.equal(started.success, true, `${type} ${playerCount} 人开局失败：${started.message || '未知错误'}`);
            cases.push(`${type}:${playerCount}`);
        }
    }

    assert.equal(cases.length, 109);
});
