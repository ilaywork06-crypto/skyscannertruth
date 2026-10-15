"""Database preparation at startup: migrations, legacy index removal, indexes, then the dynamic value indexes.

Fields declared while the service runs are indexed at the next start.
"""

from events_service.repositories.declarations import (
    FieldRepository,
    IndustryRepository,
    PlatformRepository,
    TypeRepository,
)
from events_service.repositories.events import EventRepository
from events_service.repositories.migrations import migrate_documents
from events_service.repositories.records import (
    OutboxRepository,
    RevisionRepository,
    SubscriptionRepository,
    TemplateRepository,
)
from sky_core.models.enums import FieldScope
from sky_core.mongo import MongoProvider


async def prepare_database(provider: MongoProvider) -> None:
    await migrate_documents(provider)
    events = EventRepository(provider)
    fields = FieldRepository(provider)
    subscriptions = SubscriptionRepository(provider)
    await subscriptions.drop_legacy_indexes()
    await events.drop_legacy_indexes()
    for repository in (
        events,
        fields,
        TypeRepository(provider),
        PlatformRepository(provider),
        IndustryRepository(provider),
        TemplateRepository(provider),
        subscriptions,
        OutboxRepository(provider),
        RevisionRepository(provider),
    ):
        await repository.ensure_indexes()
    declared = await fields.list_for_scope(scope=FieldScope.EVENT, include_shared=False)
    await events.ensure_dynamic_indexes([field.key for field in declared if field.sortable or field.filterable])
