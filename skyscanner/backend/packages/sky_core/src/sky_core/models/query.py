"""The inventory query: free text, industry narrowing, structured filter conditions, sort and page."""

from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field, JsonValue

from sky_core.models.enums import ParseState, SortDirection


class FilterOperator(StrEnum):
    EQUALS = "equals"
    NOT_EQUALS = "not_equals"
    CONTAINS = "contains"
    NOT_CONTAINS = "not_contains"
    STARTS_WITH = "starts_with"
    ENDS_WITH = "ends_with"
    GREATER_THAN = "greater_than"
    GREATER_OR_EQUAL = "greater_or_equal"
    LESS_THAN = "less_than"
    LESS_OR_EQUAL = "less_or_equal"
    IN = "in"
    NOT_IN = "not_in"
    BETWEEN = "between"
    IS_EMPTY = "is_empty"
    IS_NOT_EMPTY = "is_not_empty"


class FilterCondition(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    key: str = Field(description="Key of the field the condition applies to")
    operator: FilterOperator = Field(default=FilterOperator.EQUALS, description="Comparison to apply")
    value: JsonValue = Field(default=None, description="Value compared against the field")
    values: list[JsonValue] = Field(default_factory=list, description="Values used by the in and between operators")


class SortSpecification(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    key: str = Field(description="Key of the field to order by")
    direction: SortDirection = Field(default=SortDirection.DESC, description="Direction of the ordering")


class SearchQuery(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    search: str | None = Field(default=None, description="Free text matched against the indexed event fields")
    industry: str | None = Field(default=None, description="Industry key the results are restricted to")
    industries: list[str] = Field(
        default_factory=list,
        description="Industry keys the results are restricted to, any of them matching; empty for every industry",
    )
    parse_state: ParseState = Field(default=ParseState.ALL, description="Parsed or not parsed restriction")
    filters: list[FilterCondition] = Field(default_factory=list, description="Structured field level restrictions")
    sort: list[SortSpecification] = Field(default_factory=list, description="Ordering applied to the results")
    page: int = Field(default=1, ge=1, description="One based index of the requested page")
    page_size: int = Field(default=50, ge=1, le=500, description="Amount of documents to return for the page")
