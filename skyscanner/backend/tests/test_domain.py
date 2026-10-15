"""Pure business rules: dynamic values, briefs, entity status, artifact uniqueness, change tracking."""

from datetime import UTC, datetime, timedelta, timezone
from typing import Any

import pytest

from events_service.documents import EntityDocument, FieldDocument
from events_service.domain.artifacts import require_unique_artifacts
from events_service.domain.brief import build_event_brief, fit_event_brief
from events_service.domain.changes import build_changes, flatten_entity
from events_service.domain.status import resolve_status
from events_service.domain.values import ValueRequest, build_values, dependencies_hold
from sky_core.errors import ValidationError
from sky_core.models.common import Artifact, MetadataAttribute, ObjectTypeReference
from sky_core.models.enums import EntityStatus, FieldScope, UploadSource
from sky_core.models.field import FieldDependency


def declare(key: str, **values: Any) -> FieldDocument:
    return FieldDocument(key=key, name=values.pop("name", key.title()), **values)


def supplied(**values: Any) -> list[MetadataAttribute]:
    return [MetadataAttribute(key=key, value=value) for key, value in values.items()]


def run(declarations: list[FieldDocument], **request: Any) -> tuple[list[MetadataAttribute], dict[str, Any]]:
    return build_values(declarations, ValueRequest(scope=FieldScope.EVENT, **request))


def test_declared_values_are_coerced_and_stored_twice() -> None:
    declarations = [
        declare("count", type="integer"),
        declare("ratio", type="number"),
        declare("flag", type="boolean"),
        declare("when", type="date"),
        declare("where", type="coordinate"),
        declare("tags", type="string", array=True),
    ]
    metadata, data = run(
        declarations,
        supplied=supplied(count="+12", ratio="2.5", flag="Yes", when="2026-09-08T10:00:00Z", where=[1, 2], tags="a"),
    )
    assert data == {
        "count": 12,
        "ratio": 2.5,
        "flag": True,
        "when": datetime(2026, 9, 8, 10, tzinfo=UTC),
        "where": {"lon": 1.0, "lat": 2.0, "alt": None},
        "tags": ["a"],
    }
    assert [item.key for item in metadata] == ["count", "ratio", "flag", "when", "where", "tags"]
    assert metadata[3].value == "2026-09-08T10:00:00+00:00"


@pytest.mark.parametrize(
    ("field_type", "value"),
    [("integer", 1.5), ("number", True), ("number", "nan"), ("boolean", "maybe"), ("date", "soon"), ("coordinate", 3)],
)
def test_invalid_values_are_refused(field_type: str, value: Any) -> None:
    with pytest.raises(ValidationError, match="is not a valid"):
        run([declare("v", type=field_type)], supplied=supplied(v=value))


def test_required_and_default_apply_only_on_the_form() -> None:
    declarations = [declare("a", required=True), declare("b", default="fallback")]
    with pytest.raises(ValidationError, match="The field A is required"):
        run(declarations, supplied=[])
    _, data = run(declarations, supplied=[], asked={"b"})
    assert data == {"b": "fallback"}
    _, data = run(declarations, supplied=supplied(a="given"), asked=set())
    assert data == {"a": "given"}


def test_undeclared_keys_are_refused_unless_carried() -> None:
    with pytest.raises(ValidationError) as refused:
        run([], supplied=supplied(z="1", y="2", empty=""))
    assert refused.value.details == {"keys": "y, z", "scope": "event"}
    metadata, data = run([declare("a")], supplied=supplied(legacy=5, a="x"), carried={"legacy"})
    assert data == {"a": "x", "legacy": 5}
    assert [item.key for item in metadata] == ["a", "legacy"]


def test_constraints_and_options() -> None:
    rules = [
        declare("n", type="number", constraints=[{"name": "min", "value": 1}, {"name": "max", "value": 3}]),
        declare("s", constraints=[{"name": "pattern", "value": "[a-z]+", "message": "Lowercase only"}]),
        declare("e", type="enum", array=True, metadata={"options": ["x", "y"]}),
        declare("l", constraints=[{"name": "max_length", "value": 2}]),
    ]
    run(rules, supplied=supplied(n=2, s="abc", e=["x", "y"], l="ab"))
    with pytest.raises(ValidationError, match="breaks the rule max"):
        run(rules, supplied=supplied(n=4))
    with pytest.raises(ValidationError, match="Lowercase only"):
        run(rules, supplied=supplied(s="ABC"))
    with pytest.raises(ValidationError, match="not one of the allowed options"):
        run(rules, supplied=supplied(e=["z"]))
    with pytest.raises(ValidationError, match="max_length"):
        run(rules, supplied=supplied(l="abc"))
    _, data = run(rules, supplied=supplied(l="abc"), previous={"l": "abc"})
    assert data["l"] == "abc"


def test_dependencies_read_the_form_then_the_context() -> None:
    dependent = declare("detail", required=True, depends_on=[{"field": "kind", "operator": "equals", "values": ["x"]}])
    _, data = run([declare("kind"), dependent], supplied=supplied(kind="y"))
    assert data == {"kind": "y"}
    with pytest.raises(ValidationError, match="required"):
        run([dependent], supplied=[], context={"kind": "x"})
    rules = [FieldDependency(field="f", operator="has_value")]
    assert dependencies_hold(rules, {}, {"f": 1})
    assert not dependencies_hold(rules, {"f": ""}, {"f": 1})
    assert dependencies_hold([FieldDependency(field="f", operator="is_empty")], {}, None)
    assert dependencies_hold([FieldDependency(field="f", operator="not_equals", values=[1])], {"f": 2}, None)
    assert dependencies_hold([FieldDependency(field="f", operator="one_of", values=[1, 2])], {"f": 2}, None)


def test_brief_generation() -> None:
    moment = datetime(2026, 8, 27, tzinfo=UTC)
    full = build_event_brief(["Experiment"], ["falcon"], "aviation", moment, 7, UploadSource.WATCHDOG)
    assert full == "Experiment · falcon · aviation · 27 Aug 2026 · via watchdog · #7"
    assert build_event_brief([], ["a", "b", "c", "d", "e"], "", moment, 1) == "Event · a + b + c +2 · 27 Aug 2026 · #1"
    fitted = fit_event_brief(["A very long experiment type name"], ["p"], "aviation", moment, 7, 50, UploadSource.SCRIPT)
    assert fitted == "A very long exper… · 27 Aug 2026 · via script · #7"
    assert len(fitted) <= 50
    assert fit_event_brief(["X"], [], "", moment, 123, 10) == "026 · #123"


def test_status_follows_parsed_files() -> None:
    parsed = [Artifact(id="1", name="p.csv", path="p")]
    assert resolve_status(EntityStatus.RAW, None, parsed, {}) is EntityStatus.PARSED
    assert resolve_status(EntityStatus.PARTIALLY_PARSED, None, parsed, {}) is EntityStatus.PARTIALLY_PARSED
    with pytest.raises(ValidationError, match="cannot be marked as parsed"):
        resolve_status(EntityStatus.PARSED, None, [], {"id": "e"})
    assert resolve_status(None, EntityStatus.PARSED, [], {}) is EntityStatus.RAW
    assert resolve_status(None, EntityStatus.FAILED, [], {}) is EntityStatus.FAILED


def test_artifacts_are_unique_by_folder_and_name() -> None:
    first = Artifact(id="1", name="a.txt", path="x")
    require_unique_artifacts([first, first.model_copy(update={"folder": "other"})], "the event")
    with pytest.raises(ValidationError) as refused:
        require_unique_artifacts([first, first.model_copy(update={"path": "y"})], "the event")
    assert refused.value.details == {"files": "a.txt", "attached_to": "the event"}


def test_changes_compare_file_names_only() -> None:
    entity = EntityDocument(
        object_type=ObjectTypeReference(id="t", name="T"),
        name="one",
        raw_files=[Artifact(id="1", name="a", path="p1", size_bytes=1)],
        requested_at=datetime(2026, 1, 1, tzinfo=timezone(timedelta(hours=2))),
        data={"k": 1},
    )
    moved = entity.model_copy(update={"raw_files": [Artifact(id="2", name="a", path="p2", size_bytes=9)]})
    assert build_changes(flatten_entity(entity), flatten_entity(moved)) == []
    changes = build_changes(flatten_entity(entity), {**flatten_entity(entity), "data.k": 2})
    assert [(c.key, c.label, c.before, c.after) for c in changes] == [("data.k", "K", 1, 2)]
