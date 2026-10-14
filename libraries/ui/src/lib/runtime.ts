/**
 * The methods the code calls that old browsers lack. The bundler rewrites syntax for the build target but
 * says nothing about a missing method, which then fails as a click that does nothing. Each is installed only
 * where it is missing, and never enumerable. Call before the application is created.
 */
type Fn = (...args: never[]) => unknown

function define(target: object, name: string, fn: Fn): void {
  if (name in target) return
  Object.defineProperty(target, name, { value: fn, writable: true, configurable: true, enumerable: false })
}

const index = (len: number, i: number) => {
  const n = Math.trunc(i) || 0
  return n < 0 ? len + n : n
}

export function installRuntimeShims(): void {
  const A = Array.prototype as unknown as Record<string, unknown>
  define(A, 'findLast', function (this: unknown[], pred: (v: unknown, i: number, a: unknown[]) => boolean, thisArg?: unknown) {
    for (let i = this.length - 1; i >= 0; i--) if (pred.call(thisArg, this[i], i, this)) return this[i]
    return undefined
  } as Fn)
  define(A, 'findLastIndex', function (this: unknown[], pred: (v: unknown, i: number, a: unknown[]) => boolean, thisArg?: unknown) {
    for (let i = this.length - 1; i >= 0; i--) if (pred.call(thisArg, this[i], i, this)) return i
    return -1
  } as Fn)
  define(A, 'at', function (this: unknown[], i: number) {
    return this[index(this.length, i)]
  } as Fn)
  define(String.prototype, 'at', function (this: string, i: number) {
    const k = index(this.length, i)
    return k < 0 || k >= this.length ? undefined : this.charAt(k)
  } as Fn)
  define(A, 'toSorted', function (this: unknown[], cmp?: (a: unknown, b: unknown) => number) {
    return [...this].sort(cmp)
  } as Fn)
  define(A, 'toReversed', function (this: unknown[]) {
    return [...this].reverse()
  } as Fn)
  define(A, 'toSpliced', function (this: unknown[], start: number, deleteCount?: number, ...items: unknown[]) {
    const copy = [...this]
    if (deleteCount === undefined) copy.splice(start)
    else copy.splice(start, deleteCount, ...items)
    return copy
  } as Fn)
  define(A, 'with', function (this: unknown[], i: number, value: unknown) {
    const copy = [...this]
    copy[i < 0 ? copy.length + i : i] = value
    return copy
  } as Fn)
  define(Object, 'hasOwn', ((target: object, key: PropertyKey) => Object.prototype.hasOwnProperty.call(target, key)) as Fn)
  define(globalThis, 'structuredClone', ((v: unknown) => (v === undefined ? v : JSON.parse(JSON.stringify(v)))) as Fn)
}

/**
 * An identifier for something kept in this browser. `crypto.randomUUID` exists only in a secure context, and
 * this system is opened as `http://<machine>:8080` from other desks - which is not one.
 */
export function newLocalId(): string {
  const c = globalThis.crypto as Crypto | undefined
  if (c && typeof c.randomUUID === 'function') return c.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}
