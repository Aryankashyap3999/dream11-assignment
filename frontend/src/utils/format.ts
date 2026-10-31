export const oversFromBalls = (balls: number) => `${Math.floor(balls / 6)}.${balls % 6}`

export const orDash = (v: number | null | undefined) => (v ?? '—')
