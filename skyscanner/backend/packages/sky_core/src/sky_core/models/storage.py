"""Storage service wire models: uploads (form and browser-driven multipart), links, metadata and archives."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from sky_core.models.common import Artifact
from sky_core.models.enums import ArtifactKind


class ArtifactUploadResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    artifacts: list[Artifact] = Field(default_factory=list, description="Artifacts that were written to the bucket")


class DownloadLinkResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    url: str = Field(description="Presigned link the browser may follow")
    name: str = Field(description="Original file name of the artifact")
    content_type: str = Field(default="application/octet-stream", description="MIME type of the stored file")
    expires_at: datetime = Field(description="UTC moment the link stops working")


class ArchiveEntry(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    path: str = Field(description="Key the file is stored under in the bucket")
    entry: str = Field(description="Path the file takes inside the archive, folders included")


class ArchiveDocument(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    entry: str = Field(description="Path the document takes inside the archive, folders included")
    content: str = Field(description="What the document holds, as text")


class ArchiveRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    entries: list[ArchiveEntry] = Field(default_factory=list, description="Files the archive is built from")
    documents: list[ArchiveDocument] = Field(
        default_factory=list,
        description="Files the caller wrote itself, placed into the archive beside the stored ones",
    )
    archive_name: str = Field(default="skyscanner-files.zip", description="Name the archive is offered under")


class StorageObjectResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    path: str = Field(description="Key the object is stored under")
    size_bytes: int = Field(default=0, ge=0, description="Size of the object in bytes")
    content_type: str = Field(default="application/octet-stream", description="MIME type of the object")
    checksum: str | None = Field(default=None, description="Checksum reported by the bucket")
    last_modified: datetime | None = Field(default=None, description="UTC moment the object last changed")


class UploadDescriptor(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    file_name: str = Field(description="Name the file was picked under, which it is stored and offered as")
    content_type: str = Field(default="application/octet-stream", description="MIME type the browser claimed")
    owner_kind: str = Field(default="events", description="Top level folder of the key, telling owners apart")
    owner_id: str | None = Field(default=None, description="Identifier of the owner, when it is known already")
    kind: ArtifactKind = Field(default=ArtifactKind.ADDITIONAL, description="Role the file plays for its owner")
    folder: str | None = Field(default=None, description="Virtual folder the file is grouped under")
    descriptor: str = Field(default="", description="Free text describing what the file holds")


class UploadBeginRequest(UploadDescriptor):
    size_bytes: int = Field(default=0, ge=0, description="How large the file is, as the browser measured it")


class UploadBeginResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    upload_id: str = Field(description="Identifier of the opened upload, quoted on every further request")
    path: str = Field(description="Key the finished file will be stored under")
    part_size: int = Field(gt=0, description="How many bytes of the file one part carries")
    max_parts: int = Field(gt=0, description="Most parts one upload may be split into")


class UploadPart(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    number: int = Field(ge=1, description="One based position of the part inside the file")
    etag: str = Field(description="Checksum the bucket recorded for the part")
    size_bytes: int = Field(default=0, ge=0, description="How many bytes the part carries")


class UploadStatusResponse(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    upload_id: str = Field(description="Identifier of the opened upload")
    path: str = Field(description="Key the finished file will be stored under")
    parts: list[UploadPart] = Field(default_factory=list, description="Every part the bucket already holds")


class UploadCompleteRequest(UploadDescriptor):
    path: str = Field(description="Key the file is being stored under, as the opening answer named it")
    parts: list[UploadPart] = Field(description="Every part of the file, which the bucket checks against its own")
