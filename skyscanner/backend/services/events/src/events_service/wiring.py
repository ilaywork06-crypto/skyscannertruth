"""Dependency wiring, in one place. A `Container` is built per request around the process-wide Mongo provider;
services and repositories are created lazily, at most once per request."""

from functools import cached_property
from typing import Annotated

from fastapi import Depends, Request
from sky_core.mongo import MongoProvider
from sky_core.settings import get_auth_settings, get_service_settings
from sky_grid.introspection import SchemaIntrospector

from events_service.repositories.base import NOT_DELETED
from events_service.repositories.declarations import (
    FieldRepository,
    IndustryRepository,
    PlatformRepository,
    TypeRepository,
)
from events_service.repositories.events import EventRepository
from events_service.repositories.records import (
    CounterRepository,
    OutboxRepository,
    RevisionRepository,
    SubscriptionRepository,
    TemplateRepository,
)
from events_service.repositories.renames import RenameStore
from events_service.services.bundles import BundleService
from events_service.services.entities import EntityService
from events_service.services.events import EventService
from events_service.services.exports import ExportService
from events_service.services.fields import FieldService
from events_service.services.grid import GridService
from events_service.services.industries import IndustryService
from events_service.services.outbox import Publisher
from events_service.services.platforms import PlatformService
from events_service.services.renames import RenameService
from events_service.services.revisions import RevisionService
from events_service.services.storage_client import StorageClient
from events_service.services.subscriptions import SubscriptionService
from events_service.services.templates import TemplateService
from events_service.services.types import TypeService


class Container:
    def __init__(self, provider: MongoProvider, storage: StorageClient) -> None:
        self.provider = provider
        self._storage = storage

    # ----- repositories ----- #

    @cached_property
    def event_repository(self) -> EventRepository:
        return EventRepository(self.provider)

    @cached_property
    def field_repository(self) -> FieldRepository:
        return FieldRepository(self.provider)

    @cached_property
    def type_repository(self) -> TypeRepository:
        return TypeRepository(self.provider)

    @cached_property
    def platform_repository(self) -> PlatformRepository:
        return PlatformRepository(self.provider)

    @cached_property
    def industry_repository(self) -> IndustryRepository:
        return IndustryRepository(self.provider)

    @cached_property
    def counters(self) -> CounterRepository:
        return CounterRepository(self.provider)

    # ----- services ----- #

    @cached_property
    def renames(self) -> RenameService:
        return RenameService(RenameStore(self.provider))

    @cached_property
    def revisions(self) -> RevisionService:
        return RevisionService(RevisionRepository(self.provider))

    @cached_property
    def publisher(self) -> Publisher:
        return Publisher(OutboxRepository(self.provider))

    @cached_property
    def fields(self) -> FieldService:
        return FieldService(self.field_repository, self.renames)

    @cached_property
    def types(self) -> TypeService:
        return TypeService(self.type_repository, self.renames)

    @cached_property
    def platforms(self) -> PlatformService:
        return PlatformService(self.platform_repository, self.renames)

    @cached_property
    def industries(self) -> IndustryService:
        return IndustryService(self.industry_repository, self.event_repository)

    @cached_property
    def entities(self) -> EntityService:
        return EntityService(
            self.event_repository, self.publisher, self.types, self.fields, self.revisions, self.industries
        )

    @cached_property
    def events(self) -> EventService:
        return EventService(
            self.event_repository,
            self.counters,
            self.publisher,
            self.types,
            self.platforms,
            self.fields,
            self.entities,
            self.revisions,
        )

    @cached_property
    def grid(self) -> GridService:
        introspector = SchemaIntrospector(self.event_repository.collection, base_filter=dict(NOT_DELETED))
        return GridService(
            self.event_repository,
            self.fields,
            introspector,
            self.type_repository,
            self.platform_repository,
            self.industry_repository,
        )

    @cached_property
    def templates(self) -> TemplateService:
        return TemplateService(TemplateRepository(self.provider))

    @cached_property
    def subscriptions(self) -> SubscriptionService:
        return SubscriptionService(SubscriptionRepository(self.provider))

    @cached_property
    def exports(self) -> ExportService:
        return ExportService(self.event_repository)

    @cached_property
    def bundles(self) -> BundleService:
        return BundleService(
            self.event_repository,
            self.industry_repository,
            self.type_repository,
            self.platform_repository,
            self.field_repository,
            self.counters,
            self._storage,
        )


def default_storage_client() -> StorageClient:
    return StorageClient(get_service_settings(), get_auth_settings())


def get_container(request: Request) -> Container:
    state = request.app.state
    return Container(state.mongo, state.storage_client)


Services = Annotated[Container, Depends(get_container)]
