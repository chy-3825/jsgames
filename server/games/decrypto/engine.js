const WORD_BANK = ['灯塔', '雨伞', '火车', '月亮', '蜂蜜', '钥匙', '钟表', '沙漠', '剧院', '面包', '雪山', '电话', '森林', '河流', '镜子', '邮票', '鲸鱼', '花园', '纸船', '风筝', '帽子', '咖啡', '城堡', '火柴', '地图', '鼓手', '海鸥', '电梯', '口袋', '相机', '蜡烛', '医院', '隧道', '苹果', '雨衣', '棋盘', '火山', '书店', '橡树', '船票', '望远镜', '丝带', '机场', '烟火', '冰箱', '画廊', '风暴', '邮轮', '手套', '钟声', '剧本', '雪橇', '沙漏', '贝壳', '桥梁', '果园', '信封', '罗盘', '台灯', '面具', '乐队', '鲸歌', '糖果', '药箱', '木琴', '树屋', '车站', '雨声', '云朵', '香料', '胶片', '水井', '钢琴', '鞋带', '船锚', '画笔', '火炉', '石桥', '风车', '纸箱', '木偶', '钟塔', '竹林', '雪花', '书签', '茶壶', '沙滩', '皮箱', '围巾', '唱片', '花瓶', '指南针', '木桥', '油灯', '口琴', '帆船', '灯笼', '陀螺', '信号'];

function shuffle(values, random = Math.random) { const result = values.slice(); for (let index = result.length - 1; index > 0; index -= 1) { const other = Math.floor(random() * (index + 1)); [result[index], result[other]] = [result[other], result[index]]; } return result; }
function buildCodeDeck() { const deck = []; for (let first = 1; first <= 4; first += 1) for (let second = 1; second <= 4; second += 1) for (let third = 1; third <= 4; third += 1) if (new Set([first, second, third]).size === 3) deck.push([first, second, third]); return deck; }

class DecryptoEngine {
    constructor(roomId, players, random = Math.random, options = {}) {
        this.roomId = roomId; this.random = random;
        this.encryptorMode = ['fixed_vote', 'rotation', 'random'].includes(options.encryptorMode) ? options.encryptorMode : 'rotation';
        const input = Array.isArray(players) ? players : [];
        this.isThreePlayer = input.length === 3;
        this.players = input.map((player, index) => ({ id: player.id, name: player.name, seat: index + 1, team: this.isThreePlayer ? (index < 2 ? 0 : 1) : index % 2, isOnline: true }));
        this.playerMap = Object.fromEntries(this.players.map(player => [player.id, player]));
        this.teams = [{ id: 0, name: '红队', members: [], keywords: [], encryptorIndex: 0, miscommunications: 0, interceptions: 0 }, { id: 1, name: '蓝队', members: [], keywords: [], encryptorIndex: 0, miscommunications: 0, interceptions: 0 }];
        this.status = 'waiting'; this.phase = 'waiting'; this.round = 0; this.activeTeam = 0; this.currentTurn = null; this.roundTurns = [null, null]; this.history = []; this.lastResult = null; this.actionLog = []; this.winner = null; this.tiebreakGuesses = {}; this.codeDecks = [[], []]; this.usedClues = new Set(); this.keyConfirmed = {}; this.encryptorVotes = {}; this.fixedEncryptors = [null, null]; this.previousEncryptors = [null, null];
    }

    start() {
        if (this.status !== 'waiting') return { success: false, message: '谍报风云已经开始或已经结束' };
        if (this.players.length < 3 || this.players.length > 8) return { success: false, message: '谍报风云需要 3–8 名玩家' };
        if (this.players.some(player => !player.id) || new Set(this.players.map(player => player.id)).size !== this.players.length) return { success: false, message: '玩家身份必须唯一且有效' };
        const words = shuffle(WORD_BANK, this.random);
        this.teams.forEach(team => { team.members = this.players.filter(player => player.team === team.id).map(player => player.id); team.keywords = words.splice(0, 4); team.encryptorIndex = 0; team.miscommunications = 0; team.interceptions = 0; });
        this.players.forEach(player => { player.isOnline = true; });
        this.status = 'playing'; this.phase = 'keycheck'; this.round = 1; this.activeTeam = 0; this.currentTurn = null; this.roundTurns = [null, null]; this.history = []; this.lastResult = null; this.winner = null; this.tiebreakGuesses = {}; this.codeDecks = [buildCodeDeck(), buildCodeDeck()]; this.usedClues = new Set(); this.keyConfirmed = {}; this.encryptorVotes = {}; this.fixedEncryptors = [null, null]; this.previousEncryptors = [null, null]; this.actionLog = ['两队密钥已经下发，等待所有成员完成核对'];
        return this._success('请查看并核对本队四个关键词');
    }

    // The physical game returns each used code card to its deck at the end of
    // the round, so a code may appear again immediately. Pick from the full
    // 24-card permutation deck rather than consuming a one-shot 24-card list.
    _drawCode() { const deck = buildCodeDeck(); const roll = Number(this.random()); const index = Math.min(deck.length - 1, Math.max(0, Math.floor((Number.isFinite(roll) ? roll : 0) * deck.length))); return deck[index].slice(); }
    _encryptingTeamIds() { return this.isThreePlayer ? [0] : [0, 1]; }
    _onlineTeamMembers(teamId) {
        return this.teams[teamId]?.members.filter(id => this.playerMap[id]?.isOnline) || [];
    }
    _teamRepresentative(teamId) {
        return this._onlineTeamMembers(teamId)[0] || this.teams[teamId]?.members[0] || null;
    }
    _selectEncryptor(team, teamId) {
        const members = this._onlineTeamMembers(teamId);
        if (!members.length) return team.members[0] || null;
        if (this.encryptorMode === 'fixed_vote') return (this.fixedEncryptors[teamId] && members.includes(this.fixedEncryptors[teamId])) ? this.fixedEncryptors[teamId] : members[0];
        if (this.encryptorMode === 'random') {
            const pool = members.length > 1 ? members.filter(id => id !== this.previousEncryptors[teamId]) : members;
            const roll = Number(this.random());
            const chosen = pool[Math.min(pool.length - 1, Math.max(0, Math.floor((Number.isFinite(roll) ? roll : 0) * pool.length)))];
            this.previousEncryptors[teamId] = chosen;
            return chosen;
        }
        return members[team.encryptorIndex % members.length];
    }
    _beginEncryptorVote() {
        this.phase = 'encryptor_vote'; this.encryptorVotes = {};
        this._encryptingTeamIds().forEach(teamId => {
            const replacement = this._teamRepresentative(teamId);
            this.teams[teamId].members.filter(id => !this.playerMap[id]?.isOnline).forEach(id => { this.encryptorVotes[id] = replacement || id; });
        });
        this._log('各队开始投票选出本局固定加密员');
    }
    _voteEncryptor(player, action) {
        if (action.kind !== 'voteEncryptor') return { success: false, message: '请选择本队的固定加密员', state: this.getPlayerState(player.id) };
        if (!this._encryptingTeamIds().includes(player.team)) return { success: false, message: '你无需参与加密员投票', state: this.getPlayerState(player.id) };
        if (this.encryptorVotes[player.id]) return { success: false, message: '你已经投过票', state: this.getPlayerState(player.id) };
        const candidateId = String(action.playerId || '');
        if (!this.teams[player.team].members.includes(candidateId)) return { success: false, message: '只能投给本队成员', state: this.getPlayerState(player.id) };
        this.encryptorVotes[player.id] = candidateId;
        return this._resolveEncryptorVote(player.id);
    }
    _resolveEncryptorVote(playerId = null) {
        const voters = this._encryptingTeamIds().flatMap(teamId => this.teams[teamId].members);
        if (voters.some(id => !this.encryptorVotes[id])) return playerId && this.playerMap[playerId]?.isOnline ? this._privateSuccess(playerId, '选票已封存，等待其他成员') : this._success('选票继续等待在线成员');
        for (const teamId of this._encryptingTeamIds()) {
            const team = this.teams[teamId];
            const candidates = this._onlineTeamMembers(teamId);
            const counts = Object.fromEntries(team.members.map(id => [id, 0]));
            team.members.forEach(id => { counts[this.encryptorVotes[id]] += 1; });
            this.fixedEncryptors[teamId] = candidates.slice().sort((a, b) => counts[b] - counts[a] || this.playerMap[a].seat - this.playerMap[b].seat)[0] || team.members[0];
            this._log(`${team.name}选出 ${this.playerMap[this.fixedEncryptors[teamId]]?.name || '在线代表'} 担任本局固定加密员`);
        }
        this._beginClue();
        return this._success('固定加密员已确定，第一轮通信开始');
    }
    _beginClue() {
        if (!this.isThreePlayer) return this._beginRound();
        const team = this.teams[0];
        this.phase = 'clue';
        this.currentTurn = { team: 0, encryptorId: this._selectEncryptor(team, 0), code: this._drawCode(), clues: null, ownGuess: null, interceptGuess: null };
        this.roundTurns = [this.currentTurn, null];
        this.activeTeam = 0;
        if (!this.playerMap[this.currentTurn.encryptorId]?.isOnline) return this._fallbackClues(0);
        this._log(`${team.name} 的加密员 ${this.playerMap[this.currentTurn.encryptorId]?.name || '在线代表'} 准备密码`);
    }
    _beginRound() {
        this.roundTurns = this.teams.map((team, teamId) => ({ team: teamId, encryptorId: this._selectEncryptor(team, teamId), code: this._drawCode(), clues: null, ownGuess: null, interceptGuess: null }));
        this.activeTeam = 0;
        this.currentTurn = this.roundTurns[0];
        this.phase = 'clue';
        if (!this.playerMap[this.currentTurn.encryptorId]?.isOnline) return this._fallbackClues(0);
        this._log(`第${this.round}轮两队加密员已抽取密码，等待双方提交线索`);
    }

    handleAction(playerId, action = {}) {
        if (this.status !== 'playing') return { success: false, message: '游戏尚未开始或已经结束', state: this.getPlayerState(playerId) };
        const player = this.playerMap[playerId];
        if (!player || !player.isOnline) return { success: false, message: '玩家不存在或已经离开', state: this.getPlayerState(playerId) };
        if (this.phase === 'keycheck') return this._confirmKey(player, action);
        if (this.phase === 'encryptor_vote') return this._voteEncryptor(player, action);
        if (this.phase === 'clue') return this._submitClue(player, action);
        if (this.phase === 'guessing') {
            if (action.kind === 'submitOwnGuess') return this._submitOwnGuess(player, action);
            if (action.kind === 'submitIntercept') return this._submitIntercept(player, action);
            return { success: false, message: '请先在线下讨论，再封存本队的最终答案', state: this.getPlayerState(player.id) };
        }
        if (this.phase === 'tiebreak') return this._submitTiebreak(player, action);
        return { success: false, message: '当前阶段不能操作', state: this.getPlayerState(playerId) };
    }

    _confirmKey(player, action) {
        if (action.kind !== 'confirmKey') return { success: false, message: '请先查看并核对本队密钥', state: this.getPlayerState(player.id) };
        if (this.keyConfirmed[player.id]) return { success: false, message: '你已经完成密钥核对', state: this.getPlayerState(player.id) };
        this.keyConfirmed[player.id] = true;
        return this._resolveKeycheck(player.id);
    }
    _resolveKeycheck(playerId = null) {
        const confirmed = Object.keys(this.keyConfirmed).length;
        if (confirmed < this.players.length) {
            const remaining = this.players.length - confirmed;
            return playerId && this.playerMap[playerId]?.isOnline ? this._privateSuccess(playerId, `密钥已核对，还有 ${remaining} 名成员未确认`) : this._success(`密钥核对继续等待，还有 ${remaining} 名成员`);
        }
        if (this.encryptorMode === 'fixed_vote') {
            this._beginEncryptorVote();
            return this._success('密钥核对完成，请各队选出本局固定加密员');
        }
        this._log('所有成员已完成密钥核对，第1轮加密频道建立');
        this._beginClue();
        return this._success('密钥核对完成，第一轮通信开始');
    }

    _normaliseCode(code) { if (!Array.isArray(code) || code.length !== 3 || !code.every(value => Number.isInteger(Number(value)) && Number(value) >= 1 && Number(value) <= 4)) return null; const result = code.map(Number); return new Set(result).size === 3 ? result : null; }
    _normaliseClues(clues) { if (!Array.isArray(clues) || clues.length !== 3 || clues.some(clue => typeof clue !== 'string' || !clue.trim())) return null; const result = clues.map(clue => clue.trim()); return new Set(result.map(clue => clue.toLocaleLowerCase())).size === 3 ? result : null; }
    _submitClue(player, action) {
        if (player.id !== this.currentTurn.encryptorId) return { success: false, message: '只有本队加密员可以提交线索', state: this.getPlayerState(player.id) };
        const clues = this._normaliseClues(action.clues);
        if (!clues) return { success: false, message: '请输入三条不重复的线索', state: this.getPlayerState(player.id) };
        const keywords = this.teams.flatMap(team => team.keywords).map(word => word.toLocaleLowerCase());
        const normalised = clues.map(clue => clue.toLocaleLowerCase());
        if (normalised.some(clue => this.usedClues.has(clue))) return { success: false, message: '同一条线索不能在本局重复使用', state: this.getPlayerState(player.id) };
        if (normalised.some(clue => keywords.includes(clue))) return { success: false, message: '线索不能直接使用关键词', state: this.getPlayerState(player.id) };
        normalised.forEach(clue => this.usedClues.add(clue)); this.currentTurn.clues = clues;
        this._log(`${this.teams[player.team].name} 提交了三条新线索`);
        return this._advanceAfterClue();
    }
    _advanceAfterClue() {
        if (this.isThreePlayer) {
            // The official 3-player variant has no second encryptor: the
            // lone interceptor never draws a code or gives clues.
            this.phase = 'guessing';
            const automatic = this._autoResolveUnavailableGuess();
            if (automatic) return automatic;
            return this._success('线索已公开，请在线下讨论并封存答案');
        }
        const otherTeam = 1 - this.currentTurn.team;
        if (!this.roundTurns[otherTeam].clues) {
            this.currentTurn = this.roundTurns[otherTeam];
            this.phase = 'clue';
            if (!this.playerMap[this.currentTurn.encryptorId]?.isOnline) return this._fallbackClues(otherTeam);
            return this._success('本队线索已记录，等待另一队加密员提交线索');
        }
        // Both encryptors must have committed their clues before either
        // team hears them, matching the simultaneous physical setup.
        this.currentTurn = this.roundTurns[0];
        this.activeTeam = 0;
        this.phase = 'guessing';
        const automatic = this._autoResolveUnavailableGuess();
        if (automatic) return automatic;
        return this._success('双方电报已封存，红队公开频道接入');
    }

    _submitOwnGuess(player, action) {
        if (player.team !== this.activeTeam || player.id === this.currentTurn.encryptorId) return { success: false, message: '等待本队其他成员猜码', state: this.getPlayerState(player.id) };
        if (this.currentTurn.ownGuess) return { success: false, message: '本队已经提交过猜码', state: this.getPlayerState(player.id) };
        const guess = this._normaliseCode(action.code); if (!guess) return { success: false, message: '请输入三个1到4的猜测数字', state: this.getPlayerState(player.id) };
        this.currentTurn.ownGuess = { by: player.id, code: guess };
        this._log(`${this.teams[this.activeTeam].name} 的解码答案已封存`);
        return this._resolveGuessingIfReady(player.id);
    }

    _submitIntercept(player, action) {
        if (this.round <= 1) return { success: false, message: '第一轮不进行截获', state: this.getPlayerState(player.id) };
        if (player.team === this.activeTeam || player.id === this.currentTurn.encryptorId) return { success: false, message: '只有对手队伍可以截获密码', state: this.getPlayerState(player.id) };
        if (this.currentTurn.interceptGuess) return { success: false, message: '对手队伍已经提交过截获猜测', state: this.getPlayerState(player.id) };
        const guess = this._normaliseCode(action.code); if (!guess) return { success: false, message: '请输入三个1到4的截获数字', state: this.getPlayerState(player.id) };
        this.currentTurn.interceptGuess = { by: player.id, code: guess };
        this._log(`${this.teams[player.team].name} 的截获方案已封存`);
        return this._resolveGuessingIfReady(player.id);
    }

    _resolveGuessingIfReady(playerId) {
        const needsIntercept = this.round > 1;
        if (!this.currentTurn.ownGuess || (needsIntercept && !this.currentTurn.interceptGuess)) {
            const waitingFor = !this.currentTurn.ownGuess ? '本队解码答案' : '对方截获方案';
            return this._privateSuccess(playerId, `答案已封存，等待${waitingFor}`);
        }
        const turn = this.currentTurn;
        turn.ownGuess.correct = turn.ownGuess.code.every((value, index) => value === turn.code[index]);
        if (turn.interceptGuess) turn.interceptGuess.correct = turn.interceptGuess.code.every((value, index) => value === turn.code[index]);
        if (!turn.ownGuess.correct) {
            if (this.isThreePlayer) this.teams[1].interceptions += 1;
            else this.teams[this.activeTeam].miscommunications += 1;
        }
        if (turn.interceptGuess?.correct) this.teams[1 - this.activeTeam].interceptions += 1;
        this._log(`${this.teams[this.activeTeam].name} 密码已揭晓：本队${turn.ownGuess.correct ? '解码成功' : '出现沟通失误'}${turn.interceptGuess ? `，对方${turn.interceptGuess.correct ? '截获成功' : '未能截获'}` : ''}`);
        return this._completeTeamTurn();
    }

    _completeTeamTurn() {
        const turn = this.currentTurn;
        this.history.push({ round: this.round, team: this.activeTeam, teamName: this.teams[this.activeTeam].name, clues: turn.clues.slice(), code: turn.code.slice(), ownGuess: { ...turn.ownGuess }, intercept: turn.interceptGuess ? { by: turn.interceptGuess.by, correct: turn.interceptGuess.correct } : null });
        if (this.isThreePlayer) {
            const roundResult = this._checkRoundEnd();
            if (roundResult) return roundResult;
            if (this.encryptorMode === 'rotation') this.teams[0].encryptorIndex = (this.teams[0].encryptorIndex + 1) % this.teams[0].members.length;
            this.round += 1;
            this._beginClue();
            return this._success('第 ' + this.round + ' 轮开始');
        }
        if (this.activeTeam === 0) {
            this.activeTeam = 1; this.currentTurn = this.roundTurns[1]; this.phase = 'guessing';
            const automatic = this._autoResolveUnavailableGuess();
            if (automatic) return automatic;
            return this._success('红队电报已归档，蓝队公开频道接入');
        }
        const roundResult = this._checkRoundEnd();
        if (roundResult) return roundResult;
        if (this.encryptorMode === 'rotation') {
            this.teams[0].encryptorIndex = (this.teams[0].encryptorIndex + 1) % this.teams[0].members.length;
            this.teams[1].encryptorIndex = (this.teams[1].encryptorIndex + 1) % this.teams[1].members.length;
        }
        this.activeTeam = 0; this.round += 1; this._beginClue(); return this._success('第 ' + this.round + ' 轮开始');
    }

    _checkRoundEnd() {
        if (this.isThreePlayer) {
            if (this.teams[1].interceptions >= 2) return this._finish(1, '截获者获得两枚截获标记');
            if (this.round >= 5) return this._finish(0, '五轮内密码队守住了密码');
            return null;
        }
        const interceptionWinners = this.teams.filter(team => team.interceptions >= 2);
        const miscommunicationLosers = this.teams.filter(team => team.miscommunications >= 2);
        if (interceptionWinners.length || miscommunicationLosers.length || this.round >= 8) {
            const onlyNormalWin = interceptionWinners.length === 1 && !miscommunicationLosers.length;
            const onlyNormalLoss = miscommunicationLosers.length === 1 && !interceptionWinners.length;
            if (onlyNormalWin) return this._finish(interceptionWinners[0].id, `${interceptionWinners[0].name} 两次截获密码`);
            if (onlyNormalLoss) return this._finish(1 - miscommunicationLosers[0].id, `${miscommunicationLosers[0].name} 两次沟通失误`);
            return this._beginTiebreak();
        }
        return null;
    }

    _beginTiebreak() {
        this.phase = 'tiebreak'; this.tiebreakGuesses = {};
        this.teams.forEach((team, teamId) => { if (!this._onlineTeamMembers(teamId).length) this.tiebreakGuesses[team.id] = []; });
        this._log('进入终局平局判定：双方猜测对方四张关键词');
        if (this.tiebreakGuesses[0] && this.tiebreakGuesses[1]) return this._resolveTiebreak();
        return this._success('进入终局平局判定');
    }

    _autoResolveUnavailableGuess() {
        if (this.phase !== 'guessing' || !this.currentTurn) return null;
        const activeMembers = this._onlineTeamMembers(this.activeTeam).filter(id => id !== this.currentTurn.encryptorId);
        const opposingMembers = this._onlineTeamMembers(1 - this.activeTeam).filter(id => id !== this.currentTurn.encryptorId);
        let changed = false;
        if (!this.currentTurn.ownGuess && !activeMembers.length) {
            this.currentTurn.ownGuess = { by: this.currentTurn.encryptorId || 'system', code: this._fallbackCode(this.currentTurn.code) };
            changed = true;
        }
        if (this.round > 1 && !this.currentTurn.interceptGuess && !opposingMembers.length) {
            this.currentTurn.interceptGuess = { by: this.currentTurn.encryptorId || 'system', code: this._fallbackCode(this.currentTurn.code) };
            changed = true;
        }
        return changed ? this._resolveGuessingIfReady() : null;
    }

    _submitTiebreak(player, action) {
        const team = this.teams[player.team];
        if (player.id !== this._teamRepresentative(player.team)) return { success: false, message: '由本队在线代表提交终局猜词', state: this.getPlayerState(player.id) };
        if (this.tiebreakGuesses[player.team]) return { success: false, message: '本队已经提交终局猜词', state: this.getPlayerState(player.id) };
        if (!Array.isArray(action.keywords) || action.keywords.length !== 4 || action.keywords.some(word => typeof word !== 'string' || !word.trim())) return { success: false, message: '请提交对方四张关键词的猜测', state: this.getPlayerState(player.id) };
        this.tiebreakGuesses[player.team] = action.keywords.map(word => word.trim());
        return this._resolveTiebreak();
    }
    _resolveTiebreak() {
        if (!this.tiebreakGuesses[0] || !this.tiebreakGuesses[1]) return this._success('本队终局猜词已记录');
        const scores = this.teams.map((team, index) => {
            const target = this.teams[1 - index].keywords;
            return [...new Set(this.tiebreakGuesses[index])].filter(word => target.includes(word)).length;
        });
        if (scores[0] === scores[1]) { this.status = 'ended'; this.phase = 'ended'; this.winner = { teamId: null, teamName: '平局（双方共享胜利）' }; this._log('终局猜词仍然平局，双方共享胜利'); return this._success('终局平局'); }
        return this._finish(scores[0] > scores[1] ? 0 : 1, `终局猜词 ${scores[0]} 比 ${scores[1]}`);
    }

    _scoreWinner() { const points = this.teams.map(team => team.interceptions - team.miscommunications); return points[0] === points[1] ? null : (points[0] > points[1] ? 0 : 1); }
    _finish(teamId, message) { this.status = 'ended'; this.phase = 'ended'; this.winner = { teamId, teamName: this.teams[teamId].name }; this.lastResult = { teamId, message }; this._log(`${message}，${this.winner.teamName}获胜`); return this._success(message); }
    getPublicState() {
        const current = this.currentTurn;
        return {
            roomId: this.roomId,
            status: this.status,
            phase: this.phase,
            round: this.round,
            encryptorMode: this.encryptorMode,
            activeTeam: this.activeTeam,
            activeTeamName: this.teams[this.activeTeam]?.name || null,
            currentTeam: current?.team ?? null,
            currentTeamName: this.teams[current?.team]?.name || null,
            encryptorId: current?.encryptorId || null,
            encryptorName: this.playerMap[current?.encryptorId]?.name || null,
            currentClues: current?.clues || null,
            keyConfirmCount: Object.keys(this.keyConfirmed).length,
            encryptorVoteCount: Object.keys(this.encryptorVotes).length,
            ownGuessSubmitted: Boolean(current?.ownGuess),
            interceptSubmitted: Boolean(current?.interceptGuess),
            teams: this.teams.map(team => ({ id: team.id, name: team.name, members: team.members.map(id => ({ id, name: this.playerMap[id]?.name })), miscommunications: team.miscommunications, interceptions: team.interceptions })),
            players: this.players.map(player => ({ id: player.id, name: player.name, seat: player.seat, team: player.team, isOnline: player.isOnline, keyConfirmed: Boolean(this.keyConfirmed[player.id]) })),
            history: this.history.map(item => ({ ...item })),
            lastResult: this.lastResult,
            actionLog: this.actionLog.slice(-20),
            winner: this.winner,
        };
    }
    getPlayerState(playerId) {
        const state = this.getPublicState();
        const player = this.playerMap[playerId];
        const team = this.teams[player?.team];
        state.myId = playerId;
        state.myTeam = player ? player.team : null;
        state.myKeywords = team?.keywords?.slice() || [];
        state.myKeyConfirmed = Boolean(this.keyConfirmed[playerId]);
        state.currentCode = this.currentTurn?.encryptorId === playerId ? this.currentTurn.code?.slice() || null : null;
        state.encryptorCandidates = this.phase === 'encryptor_vote' && player && this._encryptingTeamIds().includes(player.team)
            ? this._onlineTeamMembers(player.team).map(id => ({ id, name: this.playerMap[id]?.name })) : [];
        state.myEncryptorVoteSubmitted = Boolean(this.encryptorVotes[playerId]);
        state.availableActions = {
            confirmKey: this.phase === 'keycheck' && !state.myKeyConfirmed,
            voteEncryptor: this.phase === 'encryptor_vote' && player && this._encryptingTeamIds().includes(player.team) && !state.myEncryptorVoteSubmitted,
            submitClue: this.phase === 'clue' && this.currentTurn?.encryptorId === playerId,
            submitOwnGuess: this.phase === 'guessing' && !this.currentTurn?.ownGuess && player?.team === this.activeTeam && playerId !== this.currentTurn?.encryptorId,
            submitIntercept: this.phase === 'guessing' && this.round > 1 && !this.currentTurn?.interceptGuess && player?.team !== this.activeTeam,
            tiebreakGuess: this.phase === 'tiebreak' && player && this._teamRepresentative(player.team) === playerId,
        };
        return state;
    }
    _fallbackCode(code) {
        return buildCodeDeck().find(candidate => !candidate.every((value, index) => value === code?.[index])) || [1, 2, 3];
    }
    _fallbackClues(teamId) {
        const words = ['空席', '缺席', '静默', '余波', '断联', '回声'];
        for (let index = 1; words.length < 3; index += 1) words.push(`离场线索${this.round}-${teamId}-${index}`);
        const keywords = this.teams.flatMap(team => team.keywords);
        const available = words.filter(clue => !this.usedClues.has(clue) && !keywords.includes(clue));
        while (available.length < 3) available.push(`离场线索${this.round}-${teamId}-${available.length + 1}-${this.usedClues.size}`);
        const clues = available.slice(0, 3);
        clues.forEach(clue => this.usedClues.add(clue));
        this.currentTurn.clues = clues;
        this._log(`${this.teams[teamId].name} 的加密员离开，系统封存了离场线索`);
        return this._advanceAfterClue();
    }
    handlePlayerLeave(playerId) {
        const player = this.playerMap[playerId];
        if (!player || !player.isOnline) return { success: false, message: '玩家不存在或已离线' };
        const leavingEncryptor = this.phase === 'clue' && this.currentTurn?.encryptorId === playerId;
        const leavingTiebreakRepresentative = this.phase === 'tiebreak' && this._teamRepresentative(player.team) === playerId;
        player.isOnline = false;
        this._log(`${player.name} 离开了通信站`);
        if (this.phase === 'keycheck') {
            this.keyConfirmed[playerId] = true;
            return this._resolveKeycheck();
        }
        if (this.phase === 'encryptor_vote' && this._encryptingTeamIds().includes(player.team)) {
            this.encryptorVotes[playerId] = this._teamRepresentative(player.team) || playerId;
            return this._resolveEncryptorVote();
        }
        if (leavingEncryptor) {
            const replacement = this._onlineTeamMembers(player.team)[0];
            if (replacement) {
                this.currentTurn.encryptorId = replacement;
                this._log(`${this.teams[player.team].name} 已改由在线成员继续出题`);
                return this._success(`${player.name} 离开，加密员已自动转交`);
            }
            return this._fallbackClues(player.team);
        }
        if (this.phase === 'guessing' && this.currentTurn) {
            const activeMembers = this._onlineTeamMembers(this.activeTeam).filter(id => id !== this.currentTurn.encryptorId);
            const opposingMembers = this._onlineTeamMembers(1 - this.activeTeam).filter(id => id !== this.currentTurn.encryptorId);
            if (!this.currentTurn.ownGuess && !activeMembers.length) this.currentTurn.ownGuess = { by: playerId, code: this._fallbackCode(this.currentTurn.code) };
            if (this.round > 1 && !this.currentTurn.interceptGuess && !opposingMembers.length) this.currentTurn.interceptGuess = { by: playerId, code: this._fallbackCode(this.currentTurn.code) };
            return this._resolveGuessingIfReady(playerId);
        }
        if (leavingTiebreakRepresentative) {
            this.tiebreakGuesses[player.team] = [];
            return this._resolveTiebreak();
        }
        return this._success(`${player.name} 已离开`);
    }
    _log(message) { this.actionLog.push(message); }
    _success(message) { return { success: true, message, state: this.getPublicState(), ended: this.status === 'ended', winner: this.winner }; }
    _privateSuccess(playerId, message) { return { ...this._success(message), privateFor: playerId, publicMessage: '' }; }
    getPlayerAction(action, playerId) {
        if (!action?.privateFor || action.privateFor === playerId) return action;
        const { privateFor, publicMessage, ...safe } = action;
        return { ...safe, message: publicMessage ?? '' };
    }
    getWinner() { return this.winner; }
}

module.exports = DecryptoEngine;
module.exports.WORD_BANK = WORD_BANK;
module.exports.buildCodeDeck = buildCodeDeck;
