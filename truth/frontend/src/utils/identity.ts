/**
 * Who the client says it is when it creates something.
 *
 * Every write of this API takes a creator and the service authenticates nobody, so the name has to come from
 * the client. There is no managing of users here: every deployment is built with the name it creates under,
 * and this is the one place that reads it - when the service starts reading an identity off its own headers,
 * this is the one function that stops being needed.
 */

/** What a creator is called when the deployment was built without one. */
const ANONYMOUS = 'unknown'

/**
 * Read who the client is creating things as.
 */
const readCreator = (): string => {
  const configured = (import.meta.env.VITE_DEFAULT_CREATOR ?? '').trim()

  return configured.length > 0 ? configured : ANONYMOUS
}

export { ANONYMOUS, readCreator }
