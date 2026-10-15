/**
 * Who the client creates things as. The service authenticates nobody, so each deployment is built with a
 * name (`VITE_DEFAULT_CREATOR`).
 */

const ANONYMOUS = 'unknown'

const currentCreator = (): string => (import.meta.env.VITE_DEFAULT_CREATOR ?? '').trim() || ANONYMOUS

export { currentCreator }
