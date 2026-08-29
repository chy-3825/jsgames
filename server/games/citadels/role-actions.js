'use strict';

/**
 * Character-specific actions for Citadels.  The engine owns turn sequencing
 * and state projection; this adapter owns the role action transaction bodies.
 *
 * Return null for actions handled by the generic turn finalizer.  Returning
 * the engine's normal result object keeps validation and presentation events
 * identical to the pre-split implementation.
 */
function handleRoleAction(engine, playerId, action, player, role) {
            if (action.kind === 'assassinate') {
                if (role.id !== 'assassin' || engine.turn.powerUsed) return { success: false, message: '当前不能使用刺杀', state: engine.getPlayerState(playerId) };
                const target = engine._role(action.roleId);
                if (!target || target.id === role.id) return { success: false, message: '请选择其他角色', state: engine.getPlayerState(playerId) };
                engine.killedRole = target.id;
                engine.turn.powerUsed = true;
                engine._startPresentation(player, 'assassinationDeclared', { targetRole: engine._publicRole(target.id) });
                return engine._success(`刺客宣布暗杀「${target.name}」`);
            }
            if (action.kind === 'rob') {
                if (role.id !== 'thief' || engine.turn.powerUsed) return { success: false, message: '当前不能使用盗窃', state: engine.getPlayerState(playerId) };
                const target = engine._role(action.roleId);
                if (!target || ['assassin', 'thief'].includes(target.id) || target.id === engine.killedRole) return { success: false, message: '盗贼不能选择刺客、自己或被暗杀的角色', state: engine.getPlayerState(playerId) };
                engine.pendingRobRole = target.id;
                engine.turn.powerUsed = true;
                engine._startPresentation(player, 'robberyDeclared', { targetRole: engine._publicRole(target.id) });
                return engine._success(`盗贼决定洗劫「${target.name}」`);
            }
            if (action.kind === 'magicianExchange') {
                if (role.id !== 'magician' || engine.turn.powerUsed) return { success: false, message: '当前不能使用交换手牌', state: engine.getPlayerState(playerId) };
                const target = engine._player(action.targetId);
                if (!target || target.id === playerId) return { success: false, message: '请选择其他玩家交换手牌', state: engine.getPlayerState(playerId) };
                const mine = player.hand;
                const mineCount = mine.length;
                const targetCount = target.hand.length;
                player.hand = target.hand;
                target.hand = mine;
                engine.turn.powerUsed = true;
                engine._startPresentation(player, 'magicianExchange', { targetPlayerId: target.id, targetPlayerName: target.name, actorCardCount: mineCount, targetCardCount: targetCount });
                return engine._success(`魔术师与 ${target.name} 交换了全部手牌`);
            }
            if (action.kind === 'magicianSwap') {
                if (role.id !== 'magician' || engine.turn.powerUsed) return { success: false, message: '当前不能使用换牌', state: engine.getPlayerState(playerId) };
                const cardIds = Array.isArray(action.cardIds) ? action.cardIds : [];
                const handIds = player.hand.map(card => card.id);
                if (!cardIds.every(id => handIds.includes(id)) || new Set(cardIds).size !== cardIds.length) return { success: false, message: '请选择自己手牌中的城区牌', state: engine.getPlayerState(playerId) };
                const discarded = player.hand.filter(card => cardIds.includes(card.id));
                player.hand = player.hand.filter(card => !cardIds.includes(card.id));
                engine.drawPile.unshift(...discarded); // 弃到牌堆底部
                const drawn = engine._draw(discarded.length);
                player.hand.push(...drawn);
                engine.turn.powerUsed = true;
                engine._startPresentation(player, 'magicianSwap', { discardedCount: discarded.length, drawnCount: drawn.length });
                return engine._success(`魔术师弃掉 ${discarded.length} 张手牌并摸回 ${drawn.length} 张`);
            }
            if (action.kind === 'collectIncome') {
                if (engine.turn.incomeCollected) return { success: false, message: '本回合已经领取过角色收入', state: engine.getPlayerState(playerId) };
                const income = engine._collectIncome(player, engine.turn.roleId);
                if (engine.turn.incomeTaken) engine._collectMerchantBonus(player);
                engine.turn.incomeCollected = true;
                engine._startPresentation(player, 'incomeCollected', { role: engine._publicRole(role.id), amount: income, color: role.color });
                return engine._success(`${role.name} 领取角色收入 +${income} 金`);
            }
            if (action.kind === 'takeGold') {
                if (engine.turn.incomeTaken) return { success: false, message: '本回合已经选择过资源', state: engine.getPlayerState(playerId) };
                player.gold += 2;
                engine.turn.incomeTaken = true;
                const merchantBonus = engine._collectMerchantBonus(player);
                const architectCards = engine._collectArchitectBonus(player);
                engine._startPresentation(player, 'takeGold', { amount: 2, merchantBonus, architectCards });
                return engine._success('获得 2 枚金币');
            }
            if (action.kind === 'drawDistrict') {
                if (engine.turn.incomeTaken || engine.drawOptions[playerId]) return { success: false, message: '当前不能再摸牌', state: engine.getPlayerState(playerId) };
                const plan = engine._drawKeepCount(player);
                const cards = engine._draw(plan.draw);
                engine.turn.incomeTaken = true;
                const merchantBonus = engine._collectMerchantBonus(player);
                const architectCards = engine._collectArchitectBonus(player);
                if (!cards.length) {
                    engine._startPresentation(player, 'drawDistrict', { count: 0, keepCount: 0, merchantBonus, architectCards });
                    return engine._success('城区牌堆已空，本回合没有可摸的牌');
                }
                engine.drawOptions[playerId] = cards;
                engine.drawKeepCount[playerId] = Math.min(plan.keep, cards.length);
                engine._startPresentation(player, 'drawDistrict', { count: cards.length, keepCount: engine.drawKeepCount[playerId], merchantBonus, architectCards });
                return engine._success(`摸到 ${cards.length} 张城区牌，保留 ${engine.drawKeepCount[playerId]} 张`);
            }
            if (action.kind === 'keepDistrict') {
                const options = engine.drawOptions[playerId] || [];
                const keepCount = engine.drawKeepCount[playerId] || 1;
                const cardIds = Array.isArray(action.cardIds) ? action.cardIds : (action.cardId ? [action.cardId] : []);
                if (cardIds.length !== keepCount || !cardIds.every(id => options.some(card => card.id === id)) || new Set(cardIds).size !== cardIds.length) {
                    return { success: false, message: `请选择保留 ${keepCount} 张城区牌`, state: engine.getPlayerState(playerId) };
                }
                const kept = options.filter(card => cardIds.includes(card.id));
                const discarded = options.filter(card => !cardIds.includes(card.id));
                player.hand.push(...kept);
                engine.drawPile.unshift(...discarded);
                delete engine.drawOptions[playerId];
                delete engine.drawKeepCount[playerId];
                engine._startPresentation(player, 'keepDistrict', { keptCount: kept.length, returnedCount: discarded.length });
                return engine._success(`保留了 ${kept.map(card => card.name).join('、')}`);
            }
            if (action.kind === 'buildDistrict') {
                if (!engine.turn.incomeTaken || engine.drawOptions[playerId] || engine.turn.buildPhaseClosed) return { success: false, message: '请先完成回合开始时的资源选择，且建造阶段尚未结束', state: engine.getPlayerState(playerId) };
                const limit = role.id === 'architect' ? 3 : 1;
                if (engine.turn.built >= limit) return { success: false, message: `本回合最多建造 ${limit} 座城区`, state: engine.getPlayerState(playerId) };
                const card = player.hand.find(item => item.id === action.cardId);
                if (!card || player.gold < card.cost || player.city.some(item => item.name === card.name)) return { success: false, message: '金币不足、没有这张牌，或城市中已有同名城区', state: engine.getPlayerState(playerId) };
                player.gold -= card.cost;
                player.hand = player.hand.filter(item => item.id !== card.id);
                const builtCard = { ...card, builtRound: engine.round };
                player.city.push(builtCard);
                engine.turn.built += 1;
                engine._startPresentation(player, 'buildDistrict', { card: engine._publicCard(builtCard), cost: card.cost, cityCount: player.city.length });
                if (player.city.length >= 8 && !engine.endRoundRequested) {
                    engine.endRoundRequested = true;
                    engine.finalRound = engine.round;
                    engine.firstFinisherId = player.id;
                    engine.actionLog.push(`${player.name} 建成了第 8 座城区，本轮结束后游戏结束`);
                    engine._appendPresentationEvent(player, 'finalRoundTriggered', { round: engine.round, cityCount: player.city.length, card: engine._publicCard(builtCard) });
                }
                return engine._success(`${player.name} 建造了${card.name}`);
            }
            if (action.kind === 'closeBuild') {
                if (role.id !== 'warlord' || !engine.turn.incomeTaken || engine.drawOptions[playerId] || engine.turn.buildPhaseClosed) {
                    return { success: false, message: '当前不能结束建造阶段', state: engine.getPlayerState(playerId) };
                }
                engine.turn.buildPhaseClosed = true;
                engine._startPresentation(player, 'buildPhaseClosed', { role: engine._publicRole(role.id) });
                return engine._success('军阀结束建造阶段，可以选择摧毁城区');
            }
            if (action.kind === 'laboratory') {
                const hasLab = player.city.some(card => card.effect === 'laboratory');
                if (!hasLab || engine.turn.laboratoryUsed) return { success: false, message: '本回合已使用过实验室，或城市中没有实验室', state: engine.getPlayerState(playerId) };
                const card = player.hand.find(item => item.id === action.cardId);
                if (!card) return { success: false, message: '请选择要弃掉的手牌', state: engine.getPlayerState(playerId) };
                player.hand = player.hand.filter(item => item.id !== card.id);
                player.gold += 1;
                engine.turn.laboratoryUsed = true;
                engine._startPresentation(player, 'laboratory', { card: engine._publicCard(card), gold: 1 });
                return engine._success(`实验室：弃掉${card.name}，获得 1 枚金币`);
            }
            if (action.kind === 'smithy') {
                const hasSmithy = player.city.some(card => card.effect === 'smithy');
                if (!hasSmithy || engine.turn.smithyUsed) return { success: false, message: '本回合已使用过铁匠铺，或城市中没有铁匠铺', state: engine.getPlayerState(playerId) };
                if (player.gold < 3) return { success: false, message: '金币不足，铁匠铺需要 3 金', state: engine.getPlayerState(playerId) };
                player.gold -= 3;
                const drawn = engine._draw(2);
                player.hand.push(...drawn);
                engine.turn.smithyUsed = true;
                engine._startPresentation(player, 'smithy', { cost: 3, drawnCount: drawn.length });
                return engine._success(`铁匠铺：支付 3 金，摸 ${drawn.length} 张城区牌`);
            }
            if (action.kind === 'destroyDistrict') {
                if (role.id !== 'warlord' || engine.turn.powerUsed || !engine.turn.incomeTaken || !engine.turn.buildPhaseClosed) return { success: false, message: '军阀只能在结束建造阶段后（回合末）摧毁城区', state: engine.getPlayerState(playerId) };
                const target = engine._player(action.targetId);
                const card = target?.city.find(item => item.id === action.cardId);
                if (!target || !card) return { success: false, message: '请选择要摧毁的城区', state: engine.getPlayerState(playerId) };
                if (target.city.length >= 8) return { success: false, message: '不能攻击已经建成 8 座城区的城市', state: engine.getPlayerState(playerId) };
                if (card.effect === 'keep') return { success: false, message: '堡垒不能被军阀摧毁', state: engine.getPlayerState(playerId) };
                // 2–3 人局一名玩家可能同时持有两个角色；只有本轮未被刺杀的主教
                // 才能保护城市，不能用玩家级 murdered 标记误伤另一角色。
                if (target.roles.some(item => item.id === 'bishop') && engine.killedRole !== 'bishop') return { success: false, message: '主教的城市受保护，军阀不能攻击', state: engine.getPlayerState(playerId) };
                // 长城只增加“其他城区”的摧毁成本；摧毁长城本身不应自我加价。
                const greatWall = target.city.some(item => item.effect === 'greatWall' && item.id !== card.id);
                const cost = Math.max(0, card.cost - 1) + (greatWall ? 1 : 0);
                if (player.gold < cost) return { success: false, message: `摧毁${card.name}需要 ${cost} 枚金币`, state: engine.getPlayerState(playerId) };
                player.gold -= cost;
                target.city = target.city.filter(item => item.id !== card.id);
                engine.turn.powerUsed = true;
                engine.actionLog.push(`军阀摧毁了 ${target.name} 的${card.name}`);
                const canRecover = target.id !== player.id && card.effect !== 'graveyard' && target.city.some(item => item.effect === 'graveyard');
                engine._startPresentation(player, 'destroyDistrict', {
                    targetPlayerId: target.id,
                    targetPlayerName: target.name,
                    card: engine._publicCard(card),
                    cost,
                    graveyardPending: canRecover,
                });
                if (canRecover) {
                    engine.pendingGraveyard = { ownerId: target.id, attackerId: player.id, card, cost };
                    return engine._success(`军阀摧毁了${card.name}，${target.name} 可以支付 1 金用墓地回收`);
                }
                return engine._success(`军阀摧毁了 ${target.name} 的${card.name}`);
            }
    return null;
}

module.exports = { handleRoleAction };

