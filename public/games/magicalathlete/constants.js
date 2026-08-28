import { escapeHtml } from '../common/html.js';

export { escapeHtml };
export const ATHLETE_ART_ORDER = Object.freeze(['alchemist', 'airship', 'baba', 'banana', 'centaur', 'cheerleader', 'coach', 'copycat', 'dicemonger', 'duelist', 'egg', 'flopflop', 'genius', 'gunk', 'hare', 'hugebaby', 'hyena', 'hypnotist', 'inchworm', 'lackey', 'leaptoad', 'legs', 'lovableloser', 'mouth', 'magician', 'mastermind', 'partyanimal', 'rocketscientist', 'romantic', 'scoocher', 'sisyphus', 'skipper', 'stickler', 'suckerfish', 'thirdwheel', 'twin']);
export const ATHLETE_ART_INDEX = Object.freeze(Object.fromEntries(ATHLETE_ART_ORDER.map((id, index) => [id, index])));
export const BEFORE_RACE_ATHLETES = new Set(['egg', 'twin', 'sisyphus']);
export const DECISION_ATHLETES = new Set(['alchemist', 'cheerleader', 'copycat', 'duelist', 'flopflop', 'genius', 'hypnotist', 'legs', 'magician', 'mastermind', 'rocketscientist', 'suckerfish', 'thirdwheel']);

export function athleteArt(athlete) { const index = ATHLETE_ART_INDEX[athlete?.id] ?? 0; return `--ma-art-x:${(index % 6) * 20}%;--ma-art-y:${Math.floor(index / 6) * 20}%`; }
export function abilityType(athlete) { if (BEFORE_RACE_ATHLETES.has(athlete?.id)) return { key: 'before', label: '赛前能力', hint: '上场时触发' }; if (DECISION_ATHLETES.has(athlete?.id)) return { key: 'decision', label: '主动能力', hint: '由你决定使用' }; return { key: 'track', label: '赛道能力', hint: '满足条件触发' }; }
export function athleteCard(athlete, { compact = false, note = '' } = {}) { if (!athlete) return ''; const ability = abilityType(athlete); return `<div class="ma-card-face ${compact ? 'is-compact' : ''} ma-ability-${ability.key}"><div class="ma-card-top"><span>运动员牌</span><b>${ability.label}</b></div><div class="ma-card-art" aria-hidden="true"><span class="ma-athlete-sprite" style="${athleteArt(athlete)}"></span><i></i></div><strong class="ma-card-name">${escapeHtml(athlete.name)}</strong><small class="ma-card-tagline">${ability.hint}</small>${compact ? '' : `<p>${escapeHtml(athlete.description || '')}</p>`}${note ? `<em class="ma-card-note">${escapeHtml(note)}</em>` : ''}</div>`; }
