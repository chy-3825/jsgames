'use strict';

/**
 * Official CMYK-edition board, scoring and racer data.  Keeping the physical
 * component data separate from the state machine makes rule revisions local.
 */
const RACES = 4;
// The CMYK board has a 30-space lane (the Start space is position 0 and the
// finish line is reached at 30+).  The earlier 20-space approximation made
// every race and every wild-track location materially too short.
const TRACK_LENGTH = 30;
// Chip values: race 1..4, 1st / 2nd place (later races worth more points).
const GOLD_POINTS = [2, 4, 6, 8];
const SILVER_POINTS = [1, 2, 3, 4];
// Blimp (kept as the legacy `airship` id): strictly before the second corner
// +3; on/after that corner -1.  The +3 is the value printed on the official
// CMYK card (the old implementation accidentally used +2).
// The 30-space board is laid out as 0–9 (top), 10–14 (right turn),
// 15–24 (bottom), 25–29 (left turn), finish at 30.  The second corner is
// therefore the 15-space transition into the bottom straight.
const SECOND_CORNER = 15;
// Track special spaces. Mild Mile (Pépère) has none in the official layout used
// here; Wild Wilds (Galère) has stars, arrows and a trip (rock) space.
const TRACK_SPECIALS = {
    mild: {},
    // CMYK Wild Wilds board (30 spaces): three trip spaces, two stars and
    // five forced arrows.  Values/directions mirror the printed track.
    wild: {
        1: 'star',
        5: 'trip',
        7: 'arrow+3',
        11: 'arrow+1',
        13: 'star',
        15: 'arrow-4',
        16: 'trip',
        22: 'arrow+2',
        23: 'arrow-2',
        25: 'trip',
    },
};

const COLORS = ['#dc6256', '#4c83ad', '#c18c3a', '#6d966a', '#80699b', '#9d6b76'];

const ATHLETES = [
    ['alchemist', '炼金术师', 'ALCHEMIST', 'TRANSMUTE \'N\' SCOOT', '当我主移动掷出 1 或 2 时，可以改为前进 4 格。'],
    ['airship', '飞艇', 'AIRSHIP', 'BLOW IT', '回合开始时若在第二个弯道之前，主移动 +3；在弯道上或之后，主移动 -1。'],
    ['baba', '巴巴雅嘎', 'BABA YAGA', 'LEG IT', '任何停在我所在格的运动员会摔倒；当我停在对方所在格时，我也会摔倒。'],
    ['banana', '香蕉', 'BANANA', 'THE SLIP', '任何超过我的运动员都会摔倒。'],
    ['centaur', '半人马', 'CENTAUR', 'HOOFWHACK', '当我超过一名运动员时，对方后退 2 格（不能超过起点）。'],
    ['cheerleader', '拉拉队长', 'CHEERLEADER', 'RAH RAH', '回合开始时，可选择让末位运动员前进 2 格；若使用，我前进 1 格。'],
    ['coach', '教练', 'COACH', 'GOOD HUSTLE', '我所在格的所有运动员（包括我）主移动 +1。'],
    ['copycat', '模仿者', 'COPYCAT', 'COPY THAT', '我拥有当前领跑运动员的能力；并列时由我选择。'],
    ['dicemonger', '掷骰商贩', 'DICEMONGER', 'DICEY DEALS', '每名运动员每回合可重掷一次主移动；当其他运动员重掷时，我前进 1 格。'],
    ['duelist', '决斗家', 'DUELIST', 'DUEL!', '每当有运动员与我同格，我可提出决斗：双方掷骰，点数高者前进 2 格，平局我赢。'],
    ['egg', '蛋', 'EGG', 'SCRAMBLE', '赛前从牌库抽 3 张新运动员并选 1 张，我拥有其能力。'],
    ['flopflop', '通通', 'FLIP FLOP', 'FLOP FLIP', '我可以不掷骰，改为与任意一名运动员交换位置（传送）。'],
    ['genius', '天才', 'GENIUS', 'THINK GOOD', '我可以预测主移动掷出的点数；猜中则本回合结束后再行动一次。'],
    ['gunk', '史莱姆', 'GUNK', 'GOOP \'EM', '所有其他运动员主移动 -1。'],
    ['hare', '快兔', 'HARE', 'HUBRIS', '主移动 +2；当我独自领跑时，跳过主移动并获得 1 枚铜星。'],
    ['hugebaby', '大宝宝', 'HUGE BABY', 'REALLY HUGE', '除起点外，任何人不能与我同格；若会发生，把对方放在我身后一格。'],
    ['hyena', '鬣狗', 'HYENA', 'SCHADENFREUDE', '当任一运动员回合结束时距其出发点不超过 1 格，我前进 2 格。'],
    ['hypnotist', '催眠师', 'HYPNOTIST', 'HSSSSST', '主移动前，可选择把一名运动员传送到我所在格。'],
    ['inchworm', '尺蠖', 'INCHWORM', 'WRIGGLE', '当其他运动员主移动掷出 1 时，对方跳过该移动，我前进 1 格。'],
    ['lackey', '管家', 'LACKEY', 'VERY GOOD SIRE', '当其他运动员主移动掷出 6 时，我在对方移动前前进 2 格。'],
    ['leaptoad', '蛙跳', 'LEAPTOAD', 'JUMPFROG', '移动时跳过有其他运动员占据的格子。'],
    ['legs', '盖伊·博尔斯', 'LEGS', 'JOG', '我可以不掷骰，主移动改为前进 5 格。'],
    ['lovableloser', '瞌睡虫', 'LOVABLE LOSER', 'D\'AWW', '主移动前，若我独居末位，获得 1 枚铜星。'],
    ['mouth', '大嘴', 'M.O.U.T.H.', 'CHOMP', '当我停在恰有一名其他运动员的格子时，对方被淘汰出本场。'],
    ['magician', '魔法师', 'MAGICIAN', 'FLOP POOF FLIP', '我的主移动最多可重掷两次。'],
    ['mastermind', '预言家', 'MASTERMIND', 'KNOW-IT-ALL', '我第一个回合开始时预测本场冠军；猜中则本场立即结束，我获得第二名。'],
    ['partyanimal', '派对熊', 'PARTY ANIMAL', 'ANIMAL MAGNETISM', '主移动前，所有运动员向我靠近 1 格；我所在格的每名其他运动员给我主移动 +1。'],
    ['rocketscientist', '火箭医生', 'ROCKET SCIENTIST', 'KABLOOEY', '我掷出主移动后可选择翻倍；若翻倍，移动结束后摔倒。'],
    ['romantic', '浪漫家', 'ROMANTIC', 'AH, LOVE!', '当任何人停在恰有一名其他运动员的格子时，我前进 2 格。'],
    ['scoocher', '跳蚤', 'SCOOCHER', 'SCOOCH SCOOCH', '每当其他运动员的能力触发，我前进 1 格。'],
    ['sisyphus', '西西弗斯', 'SISYPHUS', 'KEEP ROLLIN\'', '赛前获得 4 枚铜星；当我主移动掷出 6 时，改为传送到起点并失去 1 枚铜星。'],
    ['skipper', '队长直通', 'SKIPPER', 'SALTY DOG', '当任何运动员主移动掷出 1 时，下一个轮到我行动。'],
    ['stickler', '挑剔鬼', 'STICKLER', 'ACTUALLY...', '其他运动员只能以恰好所需步数越过终点；多走则不动。'],
    ['suckerfish', '吸盘鱼', 'SUCKERFISH', 'SUCKER!', '当我所在格的运动员移动时，我可以跟随到对方的新位置。'],
    ['thirdwheel', '第五轮', 'THIRD WHEEL', 'ROLL THROUGH', '主移动前，我可以传送到恰有两名运动员的格子。'],
    ['twin', '双胞胎', 'TWIN', 'DOUBLE DIP', '赛前可选择一名上一场获胜的运动员，本场使用其能力。'],
].map(([id, name, en, tagline, description]) => ({ id, name, en, tagline, emoji: '🏃', description }));

module.exports = {
    RACES,
    TRACK_LENGTH,
    GOLD_POINTS,
    SILVER_POINTS,
    SECOND_CORNER,
    TRACK_SPECIALS,
    ATHLETES,
    COLORS,
};
