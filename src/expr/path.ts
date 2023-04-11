export type Key = number | string

export const UpPath: unique symbol = Symbol('..')
export const CurrentPath: unique symbol = Symbol('.')
export type Path = typeof UpPath | typeof CurrentPath | Key
