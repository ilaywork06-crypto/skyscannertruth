"""Entity (an item nested inside an event) and entity-type request/response models."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from sky_core.models.common import Artifact, MetadataAttribute, ObjectTypeReference
from sky_core.models.enums import EntityStatus, UploadSource


class EntityTypeResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: str = Field(description="Identifier of the entity type")
    key: str = Field(description="Machine key of the entity type")
    name: str = Field(description="Label shown for the entity type")
    name_he: str = Field(default="", description="Label shown for the entity type on a Hebrew page")
    description: str = Field(default="", description="Explanation of what the entity type holds")
    icon: str | None = Field(default=None, description="Icon name rendered next to the entity type")
    industries: list[str] = Field(
        default_factory=list, description="Industries the type belongs to, empty when the type is shared by all of them"
    )


class EntityTypeCreateRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    key: str = Field(description="Machine key of the entity type")
    name: str = Field(description="Label shown for the entity type")
    name_he: str = Field(default="", description="Label shown for the entity type on a Hebrew page")
    description: str = Field(default="", description="Explanation of what the entity type holds")
    icon: str | None = Field(default=None, description="Icon name rendered next to the entity type")
    industries: list[str] = Field(
        default_factory=list, description="Industries the type belongs to, empty when the type is shared by all of them"
    )
    order: int = Field(default=100, description="Relative position of the type in the selectors")


class EntityTypeUpdateRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    key: str | None = Field(default=None, description="New machine key, carried through every document naming it")
    name: str | None = Field(default=None, description="New label of the entity type")
    name_he: str | None = Field(default=None, description="New Hebrew label of the entity type")
    description: str | None = Field(default=None, description="New explanation of what the type holds")
    icon: str | None = Field(default=None, description="New icon rendered next to the entity type")
    industries: list[str] | None = Field(default=None, description="New industries the type belongs to")
    order: int | None = Field(default=None, description="New relative position of the type")


class EntityCreateRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    name: str = Field(min_length=1, description="Name of the entity")
    entity_type_key: str = Field(description="Key of the entity type the entity is an instance of")
    module: str | None = Field(default=None, description="System or sensor module the entity came from")
    code_version: str | None = Field(default=None, description="Version of the code that produced the data")
    status: EntityStatus = Field(default=EntityStatus.RAW, description="Parsing state of the entity")
    notes: str = Field(default="", description="Free text information supplied by the user")
    upload_source: UploadSource = Field(default=UploadSource.MANUAL, description="How the entity reached the system")
    requested_at: datetime | None = Field(default=None, description="UTC moment the data was requested")
    received_at: datetime | None = Field(default=None, description="UTC moment the data was received")
    raw_files: list[Artifact] = Field(default_factory=list, description="Unparsed files of the entity")
    parsed_files: list[Artifact] = Field(default_factory=list, description="Parsed files of the entity")
    parsed_additional_files: list[Artifact] = Field(
        default_factory=list, description="Extra products of the parsing such as statistics or plots"
    )
    metadata: list[MetadataAttribute] = Field(default_factory=list, description="Values of the dynamic entity fields")


class EntityUpdateRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    reason: str = Field(min_length=1, description="Why the change is being made, kept in the edit history")
    name: str | None = Field(default=None, description="New name of the entity")
    module: str | None = Field(default=None, description="New system or sensor module the entity came from")
    code_version: str | None = Field(default=None, description="New version of the producing code")
    status: EntityStatus | None = Field(default=None, description="New parsing state of the entity")
    notes: str | None = Field(default=None, description="New free text information of the entity")
    requested_at: datetime | None = Field(default=None, description="New UTC moment the data was requested")
    received_at: datetime | None = Field(default=None, description="New UTC moment the data was received")
    raw_files: list[Artifact] | None = Field(default=None, description="Replacement list of unparsed files")
    parsed_files: list[Artifact] | None = Field(default=None, description="Replacement list of parsed files")
    parsed_additional_files: list[Artifact] | None = Field(
        default=None, description="Replacement list of extra parsing products"
    )
    metadata: list[MetadataAttribute] | None = Field(default=None, description="Replacement dynamic field values")


class EntityResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: str = Field(description="Identifier of the entity")
    object_id: int = Field(description="Running number of the entity inside its event")
    name: str = Field(description="Name of the entity")
    event_id: str = Field(description="Identifier of the event the entity belongs to")
    object_type: ObjectTypeReference = Field(description="Type definition the entity is an instance of")
    object_type_key: str = Field(default="", description="Key of the entity type, which selects the schema of the row")
    module: str | None = Field(default=None, description="System or sensor module the entity came from")
    code_version: str | None = Field(default=None, description="Version of the code that produced the data")
    status: EntityStatus = Field(default=EntityStatus.RAW, description="Parsing state of the entity")
    notes: str = Field(default="", description="Free text information supplied by the user")
    upload_source: UploadSource = Field(default=UploadSource.MANUAL, description="How the entity reached the system")
    requested_at: datetime | None = Field(default=None, description="UTC moment the data was requested")
    received_at: datetime | None = Field(default=None, description="UTC moment the data was received")
    raw_files: list[Artifact] = Field(default_factory=list, description="Unparsed files of the entity")
    parsed_files: list[Artifact] = Field(default_factory=list, description="Parsed files of the entity")
    parsed_additional_files: list[Artifact] = Field(
        default_factory=list, description="Extra products of the parsing such as statistics or plots"
    )
    metadata: list[MetadataAttribute] = Field(default_factory=list, description="Values of the dynamic entity fields")
    created_at: datetime = Field(description="UTC moment the entity was created")
    updated_at: datetime | None = Field(default=None, description="UTC moment the entity last changed")
    created_by: str | None = Field(default=None, description="User that created the entity")
    updated_by: str | None = Field(default=None, description="User that last changed the entity")
