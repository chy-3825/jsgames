const COLORS = ['brown', 'lightblue', 'pink', 'orange', 'red', 'yellow', 'green', 'blue', 'railroad', 'utility'];
const COLOR_LABELS = { brown: '棕色', lightblue: '浅蓝', pink: '粉色', orange: '橙色', red: '红色', yellow: '黄色', green: '绿色', blue: '深蓝', railroad: '铁路', utility: '公用事业' };
const COLOR_SIZE = { brown: 2, lightblue: 3, pink: 3, orange: 3, red: 3, yellow: 3, green: 3, blue: 2, railroad: 4, utility: 2 };
const RENT_TABLE = {
    brown: [1, 2],
    lightblue: [1, 2, 3],
    pink: [1, 2, 4],
    orange: [1, 3, 5],
    red: [2, 3, 6],
    yellow: [2, 4, 6],
    green: [2, 4, 7],
    blue: [3, 8],
    railroad: [1, 2, 3, 4],
    utility: [1, 2],
};
const PROPERTY_NAMES = {
    brown: ['地中海大道', '波罗的海大道'],
    lightblue: ['东方大道', '佛蒙特大道', '康涅狄格大道'],
    pink: ['圣查尔斯广场', '州际大道', '弗吉尼亚大道'],
    orange: ['圣詹姆斯广场', '田纳西大道', '纽约大道'],
    red: ['肯塔基大道', '印第安纳大道', '伊利诺伊大道'],
    yellow: ['大西洋大道', '文特诺大道', '马文花园'],
    green: ['太平洋大道', '北卡罗来纳大道', '宾夕法尼亚大道'],
    blue: ['公园广场', '木板路'],
    railroad: ['雷丁铁路', '宾州铁路', 'B&O 铁路', '短线铁路'],
    utility: ['电力公司', '自来水厂'],
};
const PROPERTY_VALUES = { brown: 1, lightblue: 1, pink: 2, orange: 2, red: 3, yellow: 3, green: 4, blue: 4, railroad: 2, utility: 2 };
const ACTION_NAMES = {
    dealBreaker: '物业接管',
    justSayNo: '做出反对',
    passGo: '通行证',
    doubleRent: '双倍租金',
    debtCollector: '收取债务',
    birthday: '我的生日',
    slyDeal: '盗取',
    forcedDeal: '强制交易',
    house: '房子',
    hotel: '酒店',
};

function buildDeck() {
    const deck = [];
    let id = 1;
    for (const color of COLORS) {
        PROPERTY_NAMES[color].forEach(name => deck.push({ id: `p${id++}`, kind: 'property', color, value: PROPERTY_VALUES[color], name, rent: RENT_TABLE[color].slice(), setSize: COLOR_SIZE[color] }));
    }
    const wilds = [
        { colors: ['brown', 'lightblue'], value: 1 },
        { colors: ['lightblue', 'railroad'], value: 4 },
        { colors: ['pink', 'orange'], value: 2 },
        { colors: ['pink', 'orange'], value: 2 },
        { colors: ['red', 'yellow'], value: 3 },
        { colors: ['red', 'yellow'], value: 3 },
        { colors: ['blue', 'green'], value: 4 },
        { colors: ['green', 'railroad'], value: 4 },
        { colors: ['railroad', 'utility'], value: 2 },
        { colors: COLORS, value: 0, allColor: true },
        { colors: COLORS, value: 0, allColor: true },
    ];
    wilds.forEach(wild => deck.push({ id: `w${id++}`, kind: 'property_wild', colors: wild.colors.slice(), color: null, value: wild.value, allColor: Boolean(wild.allColor), name: wild.allColor ? '十色地产万能牌' : `${wild.colors.map(color => COLOR_LABELS[color]).join('/')}万能地产` }));
    [1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 10].forEach(value => deck.push({ id: `m${id++}`, kind: 'money', value, name: `${value}M 现金` }));
    [['lightblue', 'brown'], ['pink', 'orange'], ['red', 'yellow'], ['blue', 'green'], ['railroad', 'utility']].forEach(colors => {
        for (let i = 0; i < 2; i++) deck.push({ id: `r${id++}`, kind: 'rent', colors: colors.slice(), value: 1, name: `${colors.map(color => COLOR_LABELS[color]).join('/')}租金` });
    });
    for (let i = 0; i < 3; i++) deck.push({ id: `r${id++}`, kind: 'rent', colors: [], value: 3, name: '任何租金' });
    const addAction = (action, count, value, name) => {
        for (let i = 0; i < count; i++) deck.push({ id: `a${id++}`, kind: 'action', action, value, name });
    };
    addAction('dealBreaker', 2, 5, ACTION_NAMES.dealBreaker);
    addAction('justSayNo', 3, 4, ACTION_NAMES.justSayNo);
    addAction('passGo', 10, 1, ACTION_NAMES.passGo);
    addAction('doubleRent', 2, 1, ACTION_NAMES.doubleRent);
    addAction('debtCollector', 3, 3, ACTION_NAMES.debtCollector);
    addAction('birthday', 3, 2, ACTION_NAMES.birthday);
    addAction('slyDeal', 3, 3, ACTION_NAMES.slyDeal);
    addAction('forcedDeal', 3, 3, ACTION_NAMES.forcedDeal);
    addAction('house', 3, 3, ACTION_NAMES.house);
    addAction('hotel', 2, 4, ACTION_NAMES.hotel);
    for (let i = 0; i < 4; i++) deck.push({ id: `q${id++}`, kind: 'rules', value: 0, name: '规则卡' });
    return deck;
}

module.exports = { buildDeck, COLORS, COLOR_LABELS, COLOR_SIZE, RENT_TABLE, ACTION_NAMES };
