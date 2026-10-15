"""Key renames of event types, entity types, platforms and fields, carried through every stored document that names
the key, and label renames of types carried into the events' denormalised copies.

A rename returns a tally `{collection: count}`; with `apply=False` it is a dry run that only counts (the UI shows
"saving rewrites N events, M templates" before the key is changed).
"""

from sky_core.models.enums import FieldScope

from events_service.constants import (
    EVENTS_COLLECTION,
    FIELDS_COLLECTION,
    SUBSCRIPTIONS_COLLECTION,
    TEMPLATES_COLLECTION,
    TYPES_COLLECTION,
)
from events_service.domain import renames as rules
from events_service.repositories.renames import RenameStore

Tally = dict[str, int]
EVENT_TYPE_COLUMNS = frozenset({"event_type_keys", "event_type_names"})
PLATFORM_COLUMNS = frozenset({"platforms"})
ENTITY_TYPE_COLUMNS = frozenset({"object_type_key", "objects.object_type_key"})


class RenameService:
    def __init__(self, store: RenameStore) -> None:
        self._store = store

    async def rename_event_type(self, old: str, new: str, apply: bool = True) -> Tally:
        return {
            EVENTS_COLLECTION: await self._store.events(
                {"event_type_keys": old}, lambda event: rules.rewrite_event_type_key(event, old, new), apply
            ),
            SUBSCRIPTIONS_COLLECTION: await self._store.subscriptions_following(old, new, apply),
            TEMPLATES_COLLECTION: await self._template_values(EVENT_TYPE_COLUMNS, old, new, apply),
        }

    async def rename_platform(self, old: str, new: str, apply: bool = True) -> Tally:
        return {
            EVENTS_COLLECTION: await self._store.events(
                {"platforms": old}, lambda event: rules.rewrite_platform_key(event, old, new), apply
            ),
            TEMPLATES_COLLECTION: await self._template_values(PLATFORM_COLUMNS, old, new, apply),
        }

    async def rename_entity_type(self, old: str, new: str, apply: bool = True) -> Tally:
        query = {"$or": [{"objects.object_type_key": old}, {f"entity_counts.{old}": {"$exists": True}}]}
        return {
            EVENTS_COLLECTION: await self._store.events(
                query, lambda event: rules.rewrite_entity_type_key(event, old, new), apply
            ),
            FIELDS_COLLECTION: await self._store.fields_of_entity_type(old, new, apply),
            TEMPLATES_COLLECTION: await self._template_values(ENTITY_TYPE_COLUMNS, old, new, apply),
        }

    async def rename_field(self, old: str, new: str, scope: FieldScope, apply: bool = True) -> Tally:
        """Every value under the key in that scope moves, whatever the declaration's industry or entity type."""
        if scope is FieldScope.EVENT:
            query = {"$or": [{"metadata.key": old}, {f"data.{old}": {"$exists": True}}]}
            events = await self._store.events(query, lambda event: rules.rewrite_event_field(event, old, new), apply)
        else:
            query = {"$or": [{"objects.metadata.key": old}, {f"objects.data.{old}": {"$exists": True}}]}
            events = await self._store.events(query, lambda event: rules.rewrite_entity_field(event, old, new), apply)
        tally = {
            EVENTS_COLLECTION: events,
            TEMPLATES_COLLECTION: await self._store.templates(
                lambda template: rules.rewrite_template_key(template, old, new, scope.value), apply
            ),
        }
        if scope is FieldScope.EVENT:
            tally[TYPES_COLLECTION] = await self._store.type_custom_fields(old, new, apply)
        return tally

    async def relabel_type(self, type_id: str, name: str, entity: bool) -> int:
        """Matched by the type id (labels are copies), in every event including deleted ones."""
        if entity:
            return await self._store.events(
                {"objects.object_type.id": type_id},
                lambda event: rules.relabel_entity_type(event, type_id, name),
                apply=True,
            )
        return await self._store.events(
            {"event_type.id": type_id}, lambda event: rules.relabel_event_type(event, type_id, name), apply=True
        )

    async def _template_values(self, columns: frozenset[str], old: str, new: str, apply: bool) -> int:
        return await self._store.templates(
            lambda template: rules.rewrite_template_values(template, columns, old, new), apply
        )
