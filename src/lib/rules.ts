export type Corner = 'RED' | 'BLUE'
export const CORNERS: Corner[] = ['RED', 'BLUE']
export const other = (c: Corner): Corner => (c === 'RED' ? 'BLUE' : 'RED')

export type LadderStep = {
  at: number
  effect: 'minus' | 'advantage' | 'points' | 'dq'
  value?: number
}

export type Ruleset = {
  id: string
  name: string
  group: string
  mode: 'judges' | 'operator'
  board: 'split' | 'rows'
  rounds: number
  roundSeconds: number
  restSeconds: number
  pointButtons: number[]
  advantages: boolean
  penalties: boolean
  warnings: boolean
  minusPoints: boolean
  knockdowns: boolean
  exits: boolean
  minusValue: number
  knockdownValue: number
  warningLadder: LadderStep[]
  penaltyLadder: LadderStep[]
  leadLimit: number | null
  winMethods: string[]
}

const KICK_METHODS = [
  'Puntos',
  'KO',
  'TKO / RSC',
  'Abandono',
  'Descalificación',
  'Decisión médica',
  'No presentación (WO)',
]

const GRAPPLING_METHODS = [
  'Finalización',
  'Puntos',
  'Ventajas',
  'Decisión arbitral',
  'Descalificación',
  'Lesión',
  'No presentación (WO)',
]

const WARNING_LADDER: LadderStep[] = [
  { at: 2, effect: 'minus' },
  { at: 3, effect: 'minus' },
  { at: 4, effect: 'dq' },
]

export const RULESETS: Ruleset[] = [
  {
    id: 'kick-ring',
    name: 'Kickboxing ring (Full Contact, Low Kick, K-1)',
    group: 'Kickboxing',
    mode: 'judges',
    board: 'split',
    rounds: 3,
    roundSeconds: 120,
    restSeconds: 60,
    pointButtons: [],
    advantages: false,
    penalties: false,
    warnings: true,
    minusPoints: true,
    knockdowns: true,
    exits: false,
    minusValue: 3,
    knockdownValue: 1,
    warningLadder: WARNING_LADDER,
    penaltyLadder: [],
    leadLimit: null,
    winMethods: KICK_METHODS,
  },
  {
    id: 'kick-light',
    name: 'Light Contact / Kick Light',
    group: 'Kickboxing',
    mode: 'judges',
    board: 'split',
    rounds: 3,
    roundSeconds: 120,
    restSeconds: 60,
    pointButtons: [],
    advantages: false,
    penalties: false,
    warnings: true,
    minusPoints: true,
    knockdowns: false,
    exits: true,
    minusValue: 3,
    knockdownValue: 0,
    warningLadder: WARNING_LADDER,
    penaltyLadder: [],
    leadLimit: null,
    winMethods: KICK_METHODS,
  },
  {
    id: 'point-fighting',
    name: 'Point Fighting',
    group: 'Kickboxing',
    mode: 'operator',
    board: 'split',
    rounds: 3,
    roundSeconds: 120,
    restSeconds: 60,
    pointButtons: [1, 2, 3],
    advantages: false,
    penalties: false,
    warnings: true,
    minusPoints: true,
    knockdowns: false,
    exits: true,
    minusValue: 1,
    knockdownValue: 0,
    warningLadder: WARNING_LADDER,
    penaltyLadder: [],
    leadLimit: 10,
    winMethods: KICK_METHODS,
  },
  {
    id: 'bjj',
    name: 'Jiu-Jitsu por puntos (Gi / No-Gi)',
    group: 'Grappling',
    mode: 'operator',
    board: 'rows',
    rounds: 1,
    roundSeconds: 300,
    restSeconds: 0,
    pointButtons: [2, 3, 4],
    advantages: true,
    penalties: true,
    warnings: false,
    minusPoints: false,
    knockdowns: false,
    exits: false,
    minusValue: 0,
    knockdownValue: 0,
    warningLadder: [],
    penaltyLadder: [
      { at: 2, effect: 'advantage', value: 1 },
      { at: 3, effect: 'points', value: 2 },
      { at: 4, effect: 'dq' },
    ],
    leadLimit: null,
    winMethods: GRAPPLING_METHODS,
  },
  {
    id: 'sub-only',
    name: 'Grappling solo finalización',
    group: 'Grappling',
    mode: 'operator',
    board: 'rows',
    rounds: 1,
    roundSeconds: 360,
    restSeconds: 0,
    pointButtons: [],
    advantages: false,
    penalties: true,
    warnings: false,
    minusPoints: false,
    knockdowns: false,
    exits: false,
    minusValue: 0,
    knockdownValue: 0,
    warningLadder: [],
    penaltyLadder: [{ at: 4, effect: 'dq' }],
    leadLimit: null,
    winMethods: GRAPPLING_METHODS,
  },
  {
    id: 'generic',
    name: 'Genérico por puntos',
    group: 'Otros',
    mode: 'operator',
    board: 'rows',
    rounds: 1,
    roundSeconds: 180,
    restSeconds: 0,
    pointButtons: [1, 2, 3],
    advantages: false,
    penalties: false,
    warnings: true,
    minusPoints: true,
    knockdowns: false,
    exits: false,
    minusValue: 1,
    knockdownValue: 0,
    warningLadder: [],
    penaltyLadder: [],
    leadLimit: null,
    winMethods: ['Puntos', 'Decisión arbitral', 'Descalificación', 'Abandono', 'No presentación (WO)'],
  },
]

export function getRuleset(id: string): Ruleset {
  return RULESETS.find((r) => r.id === id) ?? RULESETS[RULESETS.length - 1]
}

export type Sanctions = {
  dqAt: number | null
  minusMode: string | null
  minusValue: number | null
}

export type ScoreOptions = {
  autoLadder: boolean
  dqAt: number | null
  minusEnabled: boolean
  minusToRival: boolean
  minusValue: number
}

export const MINUS_MODES = ['SUBTRACT', 'RIVAL']

export function readSanctions(input: { dqAt?: unknown; minusMode?: unknown; minusValue?: unknown }): Sanctions {
  const whole = (raw: unknown, min: number, max: number) => {
    if (raw == null || raw === '') return null
    const n = Math.round(Number(raw))
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : null
  }
  const mode = String(input.minusMode ?? '')
  return {
    dqAt: whole(input.dqAt, 0, 20),
    minusMode: MINUS_MODES.includes(mode) ? mode : null,
    minusValue: whole(input.minusValue, 1, 10),
  }
}

export function scoreOptions(
  rules: Ruleset,
  category: Sanctions & { autoLadder: boolean },
  match?: Sanctions & { customRules: boolean },
): ScoreOptions {
  const source = match?.customRules ? match : category
  const mode = MINUS_MODES.includes(source.minusMode ?? '') ? source.minusMode : null
  return {
    autoLadder: category.autoLadder,
    dqAt: source.dqAt,
    minusEnabled: rules.minusPoints || mode != null,
    minusToRival: mode === 'RIVAL',
    minusValue: source.minusValue ?? (rules.minusValue || 1),
  }
}

export function dqLimit(rules: Ruleset, options: ScoreOptions) {
  if (options.dqAt != null) return options.dqAt
  if (!options.autoLadder) return 0
  const step = [...rules.warningLadder, ...rules.penaltyLadder].find((s) => s.effect === 'dq')
  return step?.at ?? 0
}

export function sanctionsSummary(
  rules: { mode: Ruleset['mode']; warnings: boolean },
  s: { dqAt: number; minusEnabled: boolean; minusToRival: boolean; minusValue: number },
) {
  const [one, many] = rules.warnings ? ['advertencia', 'advertencias'] : ['penalización', 'penalizaciones']
  const parts = [
    s.dqAt <= 0
      ? 'Sin descalificación automática'
      : s.dqAt === 1
        ? `Descalificación a la primera ${one}`
        : `Descalificación a las ${s.dqAt} ${many}`,
  ]
  if (s.minusEnabled) {
    const each = rules.mode === 'judges' ? ' por juez' : ''
    parts.push(
      s.minusToRival
        ? `Punto negativo: suma ${s.minusValue} al rival${each}`
        : `Punto negativo: resta ${s.minusValue}${each}`,
    )
  }
  return parts.join(' · ')
}

export type EventRow = {
  type: string
  corner: string
  value: number
  judge: number | null
  round: number
}

export type SideTotals = {
  points: number
  adv: number
  pen: number
  warn: number
  minus: number
  kd: number
  exits: number
  score: number
  advTotal: number
  minusTotal: number
  dq: boolean
}

export type JudgeTotals = {
  seat: number
  red: number
  blue: number
  lastRed: number
  lastBlue: number
  decision: Corner | null
  favor: Corner | null
}

export type ScoreResult = {
  sides: Record<Corner, SideTotals>
  judges: JudgeTotals[]
  favor: Record<Corner, number>
  suggestion: { winner: Corner | null; reason: string }
  pendingDecisions: number[]
  leadReached: boolean
}

function ladderSum(steps: LadderStep[], count: number, effect: LadderStep['effect']) {
  return steps
    .filter((s) => s.effect === effect && count >= s.at)
    .reduce((acc, s) => acc + (s.value ?? 1), 0)
}

function emptySide(): SideTotals {
  return {
    points: 0,
    adv: 0,
    pen: 0,
    warn: 0,
    minus: 0,
    kd: 0,
    exits: 0,
    score: 0,
    advTotal: 0,
    minusTotal: 0,
    dq: false,
  }
}

const COUNTER_BY_TYPE: Record<string, keyof SideTotals> = {
  POINT: 'points',
  ADV: 'adv',
  PEN: 'pen',
  WARN: 'warn',
  MINUS: 'minus',
  KD: 'kd',
  EXIT: 'exits',
}

export function computeScore(
  rules: Ruleset,
  events: EventRow[],
  judgeCount: number,
  lastRound: number,
  options: ScoreOptions,
): ScoreResult {
  const { autoLadder, minusValue } = options
  const limit = dqLimit(rules, options)
  const sides: Record<Corner, SideTotals> = { RED: emptySide(), BLUE: emptySide() }
  const clicks = new Map<number, { red: number; blue: number; lastRed: number; lastBlue: number }>()
  const decisions = new Map<number, Corner>()

  for (const e of events) {
    const corner = e.corner === 'BLUE' ? 'BLUE' : 'RED'
    if (e.type === 'JUDGE' && e.judge != null) {
      const row = clicks.get(e.judge) ?? { red: 0, blue: 0, lastRed: 0, lastBlue: 0 }
      if (corner === 'RED') {
        row.red += e.value
        if (e.round === lastRound) row.lastRed += e.value
      } else {
        row.blue += e.value
        if (e.round === lastRound) row.lastBlue += e.value
      }
      clicks.set(e.judge, row)
    } else if (e.type === 'DECISION' && e.judge != null) {
      decisions.set(e.judge, corner)
    } else {
      const key = COUNTER_BY_TYPE[e.type]
      if (key) (sides[corner][key] as number) += e.value
    }
  }

  for (const c of CORNERS) {
    const s = sides[c]
    s.minusTotal = options.minusEnabled
      ? s.minus + (autoLadder ? ladderSum(rules.warningLadder, s.warn, 'minus') : 0)
      : 0
    s.dq = limit > 0 && ((rules.warnings && s.warn >= limit) || (rules.penalties && s.pen >= limit))
  }
  const minusEffect = (c: Corner) =>
    options.minusToRival ? minusValue * sides[other(c)].minusTotal : -minusValue * sides[c].minusTotal
  for (const c of CORNERS) {
    const s = sides[c]
    const rival = sides[other(c)]
    s.score =
      s.points +
      minusEffect(c) +
      (autoLadder ? ladderSum(rules.penaltyLadder, rival.pen, 'points') : 0)
    s.advTotal = s.adv + (autoLadder ? ladderSum(rules.penaltyLadder, rival.pen, 'advantage') : 0)
  }

  const judges: JudgeTotals[] = []
  const favor: Record<Corner, number> = { RED: 0, BLUE: 0 }
  const pendingDecisions: number[] = []

  if (rules.mode === 'judges') {
    for (let seat = 1; seat <= judgeCount; seat++) {
      const row = clicks.get(seat) ?? { red: 0, blue: 0, lastRed: 0, lastBlue: 0 }
      const red = row.red + rules.knockdownValue * sides.RED.kd + minusEffect('RED')
      const blue = row.blue + rules.knockdownValue * sides.BLUE.kd + minusEffect('BLUE')
      const decision = decisions.get(seat) ?? null
      let fav: Corner | null = null
      if (red !== blue) fav = red > blue ? 'RED' : 'BLUE'
      else if (row.lastRed !== row.lastBlue) fav = row.lastRed > row.lastBlue ? 'RED' : 'BLUE'
      else fav = decision
      if (fav) favor[fav] += 1
      else pendingDecisions.push(seat)
      judges.push({ seat, red, blue, lastRed: row.lastRed, lastBlue: row.lastBlue, decision, favor: fav })
    }
  }

  let suggestion: ScoreResult['suggestion'] = { winner: null, reason: 'Empate' }
  if (sides.RED.dq !== sides.BLUE.dq) {
    suggestion = { winner: sides.RED.dq ? 'BLUE' : 'RED', reason: 'Descalificación' }
  } else if (rules.mode === 'judges') {
    if (pendingDecisions.length > 0) {
      suggestion = { winner: null, reason: 'Faltan decisiones de jueces' }
    } else if (favor.RED !== favor.BLUE) {
      const winner: Corner = favor.RED > favor.BLUE ? 'RED' : 'BLUE'
      suggestion = {
        winner,
        reason: `Puntos ${Math.max(favor.RED, favor.BLUE)}-${Math.min(favor.RED, favor.BLUE)}`,
      }
    }
  } else if (sides.RED.score !== sides.BLUE.score) {
    suggestion = { winner: sides.RED.score > sides.BLUE.score ? 'RED' : 'BLUE', reason: 'Puntos' }
  } else if (rules.advantages && sides.RED.advTotal !== sides.BLUE.advTotal) {
    suggestion = { winner: sides.RED.advTotal > sides.BLUE.advTotal ? 'RED' : 'BLUE', reason: 'Ventajas' }
  } else if (rules.penalties && sides.RED.pen !== sides.BLUE.pen) {
    suggestion = { winner: sides.RED.pen < sides.BLUE.pen ? 'RED' : 'BLUE', reason: 'Menos penalizaciones' }
  }

  const leadReached =
    rules.mode === 'operator' &&
    rules.leadLimit != null &&
    Math.abs(sides.RED.score - sides.BLUE.score) >= rules.leadLimit

  return { sides, judges, favor, suggestion, pendingDecisions, leadReached }
}

export function formatClock(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}
