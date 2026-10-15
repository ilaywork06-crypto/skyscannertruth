/**
 * Assumption-level rules that are not about the table.
 */

const NAME_LENGTH = 80

/**
 * The API still requires a `name`; the client derives it from the first line of the assumption text,
 * capped at 80 characters.
 */
const deriveName = (text: string): string => {
  const firstLine = text.trim().split(/\r?\n/)[0]?.trim() ?? ''

  return firstLine.length <= NAME_LENGTH ? firstLine : `${firstLine.slice(0, NAME_LENGTH - 1).trimEnd()}…`
}

export { deriveName }
