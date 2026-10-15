"""Dynamic schema declarations: a field describes one key of the dynamic data of events or entities."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, JsonValue

from sky_core.models.enums import DependencyOperator, FieldScope, FieldType


class FieldConstraint(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    name: str = Field(description="Name of the rule, for example min, max, pattern or min_length")
    value: JsonValue = Field(default=None, description="Value the rule compares against")
    message: str | None = Field(default=None, description="Message shown when the rule is violated")


class FieldDependency(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    field: str = Field(description="Key of the field this one depends on, of the same form or of its event")
    operator: DependencyOperator = Field(
        default=DependencyOperator.HAS_VALUE, description="How the value of the other field is tested"
    )
    values: list[JsonValue] = Field(
        default_factory=list,
        description="Values the other field is compared against by the equals and one of operators",
    )


class FieldMetadata(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    allowed_file_types: list[str] = Field(default_factory=list, description="Suffixes accepted by a file field")
    name_he: str | None = Field(default=None, description="Label shown for the field on a Hebrew page")
    options: list[str] = Field(default_factory=list, description="Allowed values of an enum field")
    unit: str | None = Field(default=None, description="Physical unit appended to a numeric value")
    description: str | None = Field(default=None, description="Helper text shown next to the input")
    placeholder: str | None = Field(default=None, description="Placeholder shown while the input is empty")
    group: str | None = Field(default=None, description="Section the field is grouped under in the create wizard")


class FieldBase(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    name: str = Field(description="Label shown to the user for the field")
    key: str = Field(description="Machine key the value is stored under")
    type: FieldType = Field(default=FieldType.STRING, description="Primitive type the field holds")
    array: bool = Field(default=False, description="Whether the field holds a list of values")
    default: JsonValue = Field(default=None, description="Value used when the user leaves the field empty")
    required: bool = Field(default=False, description="Whether a value has to be supplied")
    scope: FieldScope = Field(default=FieldScope.EVENT, description="Whether the field belongs to events or entities")
    industry: str | None = Field(
        default=None, description="Industry key owning the field, empty when the field is shared"
    )
    entity_type: str | None = Field(default=None, description="Entity type key the field is limited to")
    additional: bool = Field(default=False, description="Whether the field belongs to the additional data block")
    metadata: FieldMetadata = Field(default_factory=FieldMetadata, description="Rendering descriptors of the field")
    constraints: list[FieldConstraint] = Field(default_factory=list, description="Validation rules of the field")
    depends_on: list[FieldDependency] = Field(
        default_factory=list, description="Conditions on other fields that all have to hold before this field applies"
    )
    filterable: bool = Field(default=True, description="Whether the generated grid column offers a filter")
    sortable: bool = Field(default=True, description="Whether the generated grid column can be sorted")
    editable: bool = Field(default=True, description="Whether the value may be changed after creation")
    visible: bool = Field(default=True, description="Whether the generated grid column is shown by default")
    order: int = Field(default=100, description="Relative position of the generated grid column")


class FieldCreateRequest(FieldBase):
    pass


class FieldUpdateRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    key: str | None = Field(default=None, description="New machine key, carried through every value stored under it")
    name: str | None = Field(default=None, description="New label of the field")
    type: FieldType | None = Field(default=None, description="New primitive type of the field")
    array: bool | None = Field(default=None, description="New multiplicity of the field")
    default: JsonValue = Field(default=None, description="New fallback value of the field")
    required: bool | None = Field(default=None, description="New requiredness of the field")
    additional: bool | None = Field(default=None, description="New half of the form the field belongs to")
    metadata: FieldMetadata | None = Field(default=None, description="New rendering descriptors of the field")
    constraints: list[FieldConstraint] | None = Field(default=None, description="New validation rules of the field")
    depends_on: list[FieldDependency] | None = Field(default=None, description="New conditions on other fields")
    filterable: bool | None = Field(default=None, description="New filtering behaviour of the column")
    sortable: bool | None = Field(default=None, description="New sorting behaviour of the column")
    editable: bool | None = Field(default=None, description="New editability of the value")
    visible: bool | None = Field(default=None, description="New default visibility of the column")
    order: int | None = Field(default=None, description="New relative position of the column")


class FieldResponse(FieldBase):
    id: str = Field(description="Identifier of the field definition")
    discovered: bool = Field(
        default=False, description="Whether the definition was inferred from the stored documents rather than declared"
    )
    created_at: datetime = Field(description="UTC moment the field was declared")
    updated_at: datetime | None = Field(default=None, description="UTC moment the field last changed")
    created_by: str | None = Field(default=None, description="User that declared the field")
