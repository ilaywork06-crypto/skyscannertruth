"""Key renames carried through stored documents (pure rewrites; the repository applies them).

Each function takes a raw stored document and returns the `$set` it needs, or `{}` when nothing changes.

Saved views (templates) store `key` in `filters`, `sort` and `columns`. The original cascade looked for `field` and
`col_id` and so never rewrote anything; here views are really rewritten (deliberate fix):
- a filter on one of the renamed columns gets the old value replaced by the new one (`value` and `values`);
- for a field rename, the column key becomes the new key in filters, sort and columns, with the prefixes that address
  that field in the view: `old`/`data.old` in a view of the field's own scope, `objects.old`/`objects.data.old` for an
  entity field in an events view (entity conditions).
"""

from typing import Any

Raw = dict[str, Any]
_OWN_PREFIXES = ("", "data.")
_ENTITY_PREFIXES = ("objects.", "objects.data.")


def replace_in_list(values: list[Any], old: Any, new: Any) -> list[Any]:
    return [new if value == old else value for value in values]


def renamed_attributes(attributes: list[Any], old: str, new: str) -> list[Any]:
    return [{**item, "key": new} if isinstance(item, dict) and item.get("key") == old else item for item in attributes]


def renamed_values(values: Raw, old: str, new: str) -> Raw:
    """Moves `old` to `new` (placed last); an existing `new` value is overwritten."""
    if old not in values:
        return values
    moved = dict(values)
    moved[new] = moved.pop(old)
    return moved


def rewrite_event_type_key(event: Raw, old: str, new: str) -> Raw:
    """Only the denormalised keys move: references and names are labels, matched by id."""
    return {"event_type_keys": replace_in_list(event.get("event_type_keys") or [], old, new)}


def rewrite_platform_key(event: Raw, old: str, new: str) -> Raw:
    return {"platforms": replace_in_list(event.get("platforms") or [], old, new)}


def rewrite_entity_type_key(event: Raw, old: str, new: str) -> Raw:
    """Every entity (deleted ones too) of the type moves; its count moves (overwriting a count under `new`)."""
    entities = [
        {**entity, "object_type_key": new} if entity.get("object_type_key") == old else entity
        for entity in event.get("objects") or []
    ]
    counts = dict(event.get("entity_counts") or {})
    if old in counts:
        counts[new] = counts.pop(old)
    return {"objects": entities, "entity_counts": counts}


def rewrite_event_field(event: Raw, old: str, new: str) -> Raw:
    return {
        "metadata": renamed_attributes(event.get("metadata") or [], old, new),
        "data": renamed_values(event.get("data") or {}, old, new),
    }


def rewrite_entity_field(event: Raw, old: str, new: str) -> Raw:
    entities = [
        {
            **entity,
            "metadata": renamed_attributes(entity.get("metadata") or [], old, new),
            "data": renamed_values(entity.get("data") or {}, old, new),
        }
        for entity in event.get("objects") or []
    ]
    return {"objects": entities}


def relabel_event_type(event: Raw, type_id: str, name: str) -> Raw:
    references = [
        {**reference, "name": name} if reference.get("id") == type_id else reference
        for reference in event.get("event_type") or []
    ]
    return {"event_type": references, "event_type_names": [reference.get("name", "") for reference in references]}


def relabel_entity_type(event: Raw, type_id: str, name: str) -> Raw:
    def relabelled(entity: Raw) -> Raw:
        reference = entity.get("object_type") or {}
        if reference.get("id") != type_id:
            return entity
        return {**entity, "object_type": {**reference, "name": name}, "object_type_name": name}

    return {"objects": [relabelled(entity) for entity in event.get("objects") or []]}


def rewrite_template_values(template: Raw, columns: frozenset[str], old: str, new: str) -> Raw:
    """Replaces the value `old` by `new` in the filters on `columns` (a type or platform key was renamed)."""
    filters = [
        _with_value(condition, old, new) if _key_of(condition) in columns else condition
        for condition in template.get("filters") or []
    ]
    return _changes(template, filters=filters)


def field_key_prefixes(field_scope: str, template_scope: str) -> tuple[str, ...]:
    """How a view of `template_scope` addresses a field of `field_scope`."""
    if field_scope == template_scope:
        return _OWN_PREFIXES
    if field_scope == "entity" and template_scope == "event":
        return _ENTITY_PREFIXES
    return ()


def rewrite_template_key(template: Raw, old: str, new: str, field_scope: str) -> Raw:
    """Renames the column `old` (a field key) wherever the view names it."""
    prefixes = field_key_prefixes(field_scope, str(template.get("scope") or "event"))
    renames = {f"{prefix}{old}": f"{prefix}{new}" for prefix in prefixes}
    return _changes(
        template,
        filters=[_with_key(item, renames) for item in template.get("filters") or []],
        sort=[_with_key(item, renames) for item in template.get("sort") or []],
        columns=[_with_key(item, renames) for item in template.get("columns") or []],
    )


def _key_of(item: Any) -> Any:
    return item.get("key") if isinstance(item, dict) else None


def _with_key(item: Any, renames: dict[str, str]) -> Any:
    key = _key_of(item)
    return {**item, "key": renames[key]} if isinstance(key, str) and key in renames else item


def _with_value(condition: Raw, old: str, new: str) -> Raw:
    rewritten = dict(condition)
    if rewritten.get("value") == old:
        rewritten["value"] = new
    if isinstance(rewritten.get("values"), list):
        rewritten["values"] = replace_in_list(rewritten["values"], old, new)
    return rewritten


def _changes(template: Raw, **parts: list[Any]) -> Raw:
    return {name: value for name, value in parts.items() if value != (template.get(name) or [])}
