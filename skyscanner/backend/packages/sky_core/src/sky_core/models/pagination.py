"""Page envelope shared by the list endpoints that page by number."""

from typing import Generic, TypeVar

from pydantic import BaseModel, ConfigDict, Field

DEFAULT_PAGE_SIZE: int = 50
MAX_PAGE_SIZE: int = 500
ItemT = TypeVar("ItemT")


class PageRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    page: int = Field(default=1, ge=1, description="One based index of the requested page")
    page_size: int = Field(
        default=DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE, description="Amount of documents to return for the page"
    )

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size


class Page(BaseModel, Generic[ItemT]):
    model_config = ConfigDict(populate_by_name=True)
    items: list[ItemT] = Field(default_factory=list, description="Documents contained in the page")
    total: int = Field(default=0, ge=0, description="Total amount of documents matching the query")
    page: int = Field(default=1, ge=1, description="One based index of the returned page")
    page_size: int = Field(default=DEFAULT_PAGE_SIZE, ge=1, description="Amount of documents requested per page")
    pages: int = Field(default=0, ge=0, description="Total amount of pages available for the query")
