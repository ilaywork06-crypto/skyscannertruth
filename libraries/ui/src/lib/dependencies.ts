/** Whether a field applies, given the values of the fields it depends on. */
export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }
export type DependencyOperator = 'has_value' | 'is_empty' | 'equals' | 'one_of' | 'not_equals'

export interface FieldDependency {
  field: string
  operator: DependencyOperator
  values: JsonValue[]
}

export function isFilled(value: unknown): boolean {
  if (value === null || value === undefined || value === '') return false
  return !(Array.isArray(value) && value.length === 0)
}

/** The form's own value wins, even when empty; otherwise the event's (the context) is read. */
function resolveValue(key: string, values: Record<string, unknown>, context?: Record<string, unknown>): unknown {
  return key in values ? values[key] : context?.[key]
}

export function dependencyHolds(dep: FieldDependency, values: Record<string, unknown>, context?: Record<string, unknown>): boolean {
  const other = resolveValue(dep.field, values, context)
  switch (dep.operator) {
    case 'has_value':
      return isFilled(other)
    case 'is_empty':
      return !isFilled(other)
    case 'not_equals':
      return !dep.values.includes((other ?? null) as JsonValue)
    default:
      return dep.values.includes((other ?? null) as JsonValue)
  }
}

export function dependenciesHold(deps: FieldDependency[], values: Record<string, unknown>, context?: Record<string, unknown>): boolean {
  return deps.every((d) => dependencyHolds(d, values, context))
}

export function applicableFields<F extends { depends_on?: FieldDependency[] }>(
  fields: F[],
  values: Record<string, unknown>,
  context?: Record<string, unknown>,
): F[] {
  return fields.filter((f) => dependenciesHold(f.depends_on ?? [], values, context))
}
