"""Event and event-type request/response models. The brief (name) is capped at 50 characters."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from sky_core.models.common import Artifact, MetadataAttribute, ObjectTypeReference
from sky_core.models.entity import EntityCreateRequest, EntityResponse
from sky_core.models.enums import EventStatus, ExperimentResult, OptionalEventField, UploadSource

BRIEF_MAX_LENGTH: int = 50


class EventTypeResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: str = Field(description="Identifier of the event type")
    key: str = Field(description="Machine key of the event type")
    name: str = Field(description="Label shown for the event type")
    name_he: str = Field(default="", description="Label shown for the event type on a Hebrew page")
    description: str = Field(default="", description="Explanation of what the event type covers")
    industries: list[str] = Field(
        default_factory=list, description="Industries the type belongs to, empty when the type is shared by all of them"
    )
    fields: list[OptionalEventField] = Field(
        default_factory=list,
        description="Built in event fields this type asks for on top of the ones every event carries",
    )
    custom_fields: list[str] = Field(
        default_factory=list,
        description="Keys of the declared event fields this type asks for on top of the built in ones",
    )


class EventTypeCreateRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    key: str = Field(description="Machine key of the event type")
    name: str = Field(description="Label shown for the event type")
    name_he: str = Field(default="", description="Label shown for the event type on a Hebrew page")
    description: str = Field(default="", description="Explanation of what the event type covers")
    industries: list[str] = Field(
        default_factory=list, description="Industries the type belongs to, empty when the type is shared by all of them"
    )
    fields: list[OptionalEventField] = Field(
        default_factory=list,
        description="Built in event fields this type asks for on top of the ones every event carries",
    )
    custom_fields: list[str] = Field(
        default_factory=list,
        description="Keys of the declared event fields this type asks for on top of the built in ones",
    )
    order: int = Field(default=100, description="Relative position of the type in the selectors")


class EventTypeUpdateRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    key: str | None = Field(default=None, description="New machine key, carried through every document naming it")
    name: str | None = Field(default=None, description="New label of the event type")
    name_he: str | None = Field(default=None, description="New Hebrew label of the event type")
    description: str | None = Field(default=None, description="New explanation of what the type covers")
    industries: list[str] | None = Field(default=None, description="New industries the type belongs to")
    fields: list[OptionalEventField] | None = Field(default=None, description="New built in fields the type asks for")
    custom_fields: list[str] | None = Field(default=None, description="New declared event fields the type asks for")
    order: int | None = Field(default=None, description="New relative position of the type")


class EventCreateRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    name: str | None = Field(
        default=None,
        max_length=BRIEF_MAX_LENGTH,
        description="Brief of the event, at most 50 characters; required for a manual upload",
    )
    event_type_keys: list[str] = Field(default_factory=list, description="Keys of the event types the event matches")
    industry: str = Field(description="Industry key the event belongs to")
    platforms: list[str] = Field(default_factory=list, description="Keys of the platforms the event was produced on")
    status: EventStatus = Field(default=EventStatus.DRAFT, description="Initial state of the event")
    experiment_result: ExperimentResult | None = Field(default=None, description="How the activity itself turned out")
    event_date: datetime | None = Field(default=None, description="UTC moment the activity itself happened")
    notes: str = Field(default="", description="Free text information supplied by the user")
    upload_source: UploadSource = Field(default=UploadSource.MANUAL, description="How the event reached the system")
    additional_files: list[Artifact] = Field(default_factory=list, description="Files attached to the event itself")
    metadata: list[MetadataAttribute] = Field(
        default_factory=list, description="Free values written onto the event, which only an automated caller supplies"
    )
    entities: list[EntityCreateRequest] = Field(default_factory=list, description="Entities created with the event")


class EventUpdateRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    reason: str = Field(min_length=1, description="Why the change is being made, kept in the edit history")
    name: str | None = Field(
        default=None,
        max_length=BRIEF_MAX_LENGTH,
        description="New brief of the event, at most 50 characters and never empty",
    )
    event_type_keys: list[str] | None = Field(default=None, description="Replacement list of event type keys")
    industry: str | None = Field(default=None, description="New industry key of the event")
    platforms: list[str] | None = Field(default=None, description="Replacement list of platform keys")
    status: EventStatus | None = Field(default=None, description="New life cycle state of the event")
    experiment_result: ExperimentResult | None = Field(default=None, description="New outcome of the activity")
    event_date: datetime | None = Field(default=None, description="New UTC moment the activity happened")
    notes: str | None = Field(default=None, description="New free text information of the event")
    additional_files: list[Artifact] | None = Field(default=None, description="Replacement list of attached files")
    metadata: list[MetadataAttribute] | None = Field(default=None, description="Replacement dynamic field values")


class EventSummaryResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: str = Field(description="Identifier of the event")
    event_id: int = Field(description="Running number of the event inside the system")
    name: str = Field(description="Name of the event")
    event_type: list[ObjectTypeReference] = Field(default_factory=list, description="Types the event matches")
    industry: str = Field(description="Industry key the event belongs to")
    platforms: list[str] = Field(default_factory=list, description="Keys of the platforms the event was produced on")
    status: EventStatus = Field(default=EventStatus.DRAFT, description="Initial state of the event")
    experiment_result: ExperimentResult | None = Field(default=None, description="How the activity itself turned out")
    event_date: datetime | None = Field(default=None, description="UTC moment the activity itself happened")
    created_at: datetime = Field(description="UTC moment the event was uploaded")
    updated_at: datetime | None = Field(default=None, description="UTC moment the event last changed")
    notes: str = Field(default="", description="Free text information supplied by the user")
    additional_files: list[Artifact] = Field(default_factory=list, description="Files attached to the event itself")
    metadata: list[MetadataAttribute] = Field(default_factory=list, description="Values of the dynamic event fields")
    entity_counts: dict[str, int] = Field(default_factory=dict, description="Amount of entities per entity type key")
    created_by: str | None = Field(default=None, description="User that uploaded the event")
    updated_by: str | None = Field(default=None, description="User that last changed the event")


class EventResponse(EventSummaryResponse):
    objects: list[EntityResponse] = Field(default_factory=list, description="Entities nested inside the event")
    upload_source: UploadSource = Field(default=UploadSource.MANUAL, description="How the event reached the system")
