"""Platform request/response models. Events store platform keys only."""

from pydantic import BaseModel, ConfigDict, Field


class PlatformResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: str = Field(description="Identifier of the platform")
    key: str = Field(description="Machine key of the platform")
    name: str = Field(description="Label shown for the platform")
    name_he: str = Field(default="", description="Label shown for the platform on a Hebrew page")
    description: str = Field(default="", description="Explanation of what the platform covers")
    industries: list[str] = Field(
        default_factory=list, description="Industries the platform belongs to, empty when every industry may name it"
    )


class PlatformCreateRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    key: str = Field(description="Machine key of the platform")
    name: str = Field(description="Label shown for the platform")
    name_he: str = Field(default="", description="Label shown for the platform on a Hebrew page")
    description: str = Field(default="", description="Explanation of what the platform covers")
    industries: list[str] = Field(
        default_factory=list, description="Industries the platform belongs to, empty when every industry may name it"
    )
    order: int = Field(default=100, description="Relative position of the platform in the selectors")


class PlatformUpdateRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    key: str | None = Field(default=None, description="New machine key, carried through every document naming it")
    name: str | None = Field(default=None, description="New label of the platform")
    name_he: str | None = Field(default=None, description="New Hebrew label of the platform")
    description: str | None = Field(default=None, description="New explanation of what the platform covers")
    industries: list[str] | None = Field(default=None, description="New industries the platform belongs to")
    order: int | None = Field(default=None, description="New relative position of the platform")
