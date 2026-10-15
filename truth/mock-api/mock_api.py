"""An in-memory stand-in for the external assumptions API, for working on the Truth client without the service.

It answers exactly the endpoints the real API offers, in exactly its shapes and with the original mock's quirks:

* every listing takes ``offset``/``limit`` (parsed with ``(\\w+)=([^&]*)``, not URL-decoded; defaults 0/100) and
  answers a bare array with no total;
* ``GET /assumption`` lists summaries whose ``schemas`` are the *full* schema dicts, and carries neither values
  nor industries - only ``/assumption/{id}/latest`` does;
* ``/{kind}/{key}``, ``/{kind}/{key}/latest`` and ``/{kind}/name/{key}`` all match ``id == key or name == key``
  (the key is percent-decoded) and answer the same whole object; no match is 404 ``{"detail": "No such <kind>"}``;
* POST lists of industries/schemas accept uuids or names; a new assumption is inserted *first*;
* any other POST path - ``/schema/{id}/revisions`` included - does nothing and still answers 201 ``{"id": ...}``;
* no CORS headers and no OPTIONS: use it same-origin, through the dev server's or nginx's ``/api`` proxy.

Deliberate difference: a POST body missing a required key answers 500 ``{"detail": ...}`` instead of dropping
the connection. Requests are served on threads (the client reads six assumptions at a time).

    python3 truth/mock-api/mock_api.py      # MOCK_API_HOST (127.0.0.1) / MOCK_API_PORT (8000)

Python standard library only. The data lives in memory; a restart puts the register back the way it started.
"""

from __future__ import annotations

import json
import os
import re
import uuid
from datetime import UTC, datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any
from urllib.parse import unquote

Json = dict[str, Any]

ITEM_PATH = re.compile(r"^/(industry|schema|assumption)/(?:name/)?([^/]+)(?:/latest)?$")
QUERY_PARAM = re.compile(r"(\w+)=([^&]*)")
ASSUMPTION_SUMMARY_KEYS = (
    "id", "name", "assumption_text", "proposing_party", "tags", "validation_responsible_parties", "revision",
    "creator", "created_at", "schemas",
)
SCHEMA_SUMMARY_KEYS = ("id", "name", "revision", "creator", "created_at")


def now() -> str:
    return datetime.now(UTC).isoformat()


def new_id() -> str:
    return str(uuid.uuid4())


def named(pool: list[Json], wanted: list[str]) -> list[Json]:
    """The members of a pool a payload asked for, each named by its uuid or by its name, in pool order."""
    return [item for item in pool if item["id"] in wanted or item.get("name") in wanted]


def scheme(fields: list[Json], constraints: list[Json] | None = None) -> Json:
    return {"fields": fields, "constraints": constraints or []}


class Register:
    """The seeded register: 5 industries, 3 schemas, 37 assumptions (the same seed as the original mock)."""

    def __init__(self) -> None:
        self.industries: list[Json] = [
            {"id": new_id(), "name": n} for n in ["Telemetry", "Aviation", "Maritime", "Energy", "Logistics"]
        ]
        ind = self.industries
        self.schemas: list[Json] = [
            {"id": new_id(), "name": "Flight Performance", "revision": 2, "creator": "dana", "created_at": now(),
             "description": "Attributes of a flight performance assumption.",
             "revision_reason": "added cruise altitude", "latest_revision": True, "archived": False,
             "deleted": False, "industries": [ind[1]], "global": False,
             "scheme": scheme([
                 {"key": "cruise_speed", "label": "Cruise speed", "type": "number", "unit": "kn", "required": True},
                 {"key": "cruise_altitude", "label": "Cruise altitude", "type": "integer", "unit": "ft"},
                 {"key": "fuel_burn", "label": "Fuel burn", "type": "number", "unit": "kg/h"},
                 {"key": "confidence", "label": "Confidence", "type": "enum",
                  "options": ["High", "Medium", "Low"], "required": True},
                 {"key": "verified", "label": "Verified", "type": "boolean"},
                 {"key": "sources", "label": "Sources", "type": "list[str]"},
             ], [{"field": "cruise_speed", "rule": "min", "value": 0, "message": "Cruise speed cannot be negative"},
                 {"field": "confidence", "rule": "one_of", "value": ["High", "Medium", "Low"]}])},
            {"id": new_id(), "name": "Sensor Baseline", "revision": 1, "creator": "yossi", "created_at": now(),
             "description": "What a telemetry sensor is assumed to report.", "revision_reason": "",
             "latest_revision": True, "archived": False, "deleted": False, "industries": [ind[0]], "global": False,
             "scheme": scheme([
                 {"key": "sample_rate", "label": "Sample rate", "type": "number", "unit": "Hz", "required": True},
                 {"key": "drift", "label": "Drift", "type": "number", "unit": "%/h"},
                 {"key": "sensor_class", "label": "Sensor class", "type": "enum", "options": ["A", "B", "C"]},
                 {"key": "commissioned", "label": "Commissioned", "type": "date"},
             ])},
            # A schema written by hand in the shortest way anybody would - one entry per field.
            {"id": new_id(), "name": "Port Throughput", "revision": 1, "creator": "script", "created_at": now(),
             "description": "", "revision_reason": "", "latest_revision": True, "archived": False, "deleted": False,
             "industries": [], "global": True,
             "scheme": scheme([{"berth_count": "int"}, {"tonnes_per_day": "float"}, {"operator": "string"}])},
        ]
        parties = ["Engineering", "Operations", "Finance", "Safety"]
        self.assumptions: list[Json] = []
        for i in range(37):
            s = self.schemas[i % 3]
            if s["name"] == "Flight Performance":
                values: Json = {"cruise_speed": 430 + i, "cruise_altitude": 35000, "fuel_burn": 2400.5,
                                "confidence": ["High", "Medium", "Low"][i % 3], "verified": i % 2 == 0,
                                "sources": ["manual", "flight-test"]}
            elif s["name"] == "Sensor Baseline":
                values = {"sample_rate": 50 + i, "drift": 0.02, "sensor_class": "ABC"[i % 3],
                          "commissioned": "2024-03-11"}
            else:
                values = {"berth_count": 4 + (i % 3), "tonnes_per_day": 18000.0, "operator": "Harbour Co"}
            self.assumptions.append({
                "id": new_id(), "name": f"Assumption {i + 1}",
                "assumption_text": f"The system is planned on the basis that condition {i + 1} holds throughout.",
                "proposing_party": parties[i % 4], "tags": [["baseline", "draft", "reviewed"][i % 3]],
                "validation_responsible_parties": [parties[(i + 1) % 4]], "revision": 1 + (i % 3),
                "creator": ["dana", "yossi", "amit"][i % 3], "created_at": now(),
                "schemas": [s], "values": values, "revision_reason": "initial",
                "aggregated_scheme": s["scheme"]["fields"], "archived": False, "deleted": False,
                "industries": [ind[i % 5]] + ([ind[(i + 2) % 5]] if i % 4 == 0 else []),
            })

    # GET -------------------------------------------------------------------------------------------------
    def get(self, raw_path: str) -> tuple[int, Any]:
        path = raw_path.split("?")[0]
        query = dict(QUERY_PARAM.findall(raw_path.split("?", 1)[1] if "?" in raw_path else ""))
        offset, limit = int(query.get("offset", 0)), int(query.get("limit", 100))
        if path == "/industry":
            return 200, self.industries[offset:offset + limit]
        if path == "/schema":
            return 200, [{k: s[k] for k in SCHEMA_SUMMARY_KEYS} for s in self.schemas][offset:offset + limit]
        if path == "/assumption":
            return 200, [{k: a[k] for k in ASSUMPTION_SUMMARY_KEYS} for a in self.assumptions][offset:offset + limit]
        m = ITEM_PATH.match(path)
        if m:
            kind, key = m.group(1), unquote(m.group(2))
            pool = {"industry": self.industries, "schema": self.schemas, "assumption": self.assumptions}[kind]
            for item in pool:
                if item["id"] == key or item.get("name") == key:
                    return 200, item
            return 404, {"detail": f"No such {kind}"}
        return 404, {"detail": "Not found"}

    # POST ------------------------------------------------------------------------------------------------
    def post(self, path: str, body: Json) -> tuple[int, Any]:
        created = new_id()
        if path == "/industry":
            self.industries.append({"id": created, "name": body["name"]})
        elif path == "/schema":
            self.schemas.append({
                "id": created, "name": body["name"], "revision": 1, "creator": body.get("creator", ""),
                "created_at": now(), "description": body.get("description", ""), "revision_reason": "",
                "latest_revision": True, "archived": False, "deleted": False,
                "global": bool(body.get("global", False)),
                "industries": [] if body.get("global") else named(self.industries, body.get("industries", [])),
                "scheme": {"fields": body["scheme"].get("fields", []),
                           "constraints": body["scheme"].get("constraints", [])},
            })
        elif path == "/assumption":
            picked = named(self.schemas, body.get("schemas", []))
            self.assumptions.insert(0, {
                "id": created, "name": body["name"], "assumption_text": body["assumption_text"],
                "proposing_party": body["proposing_party"], "tags": body.get("tags", []),
                "validation_responsible_parties": body.get("validation_responsible_parties", []),
                "revision": 1, "creator": body.get("creator", ""), "created_at": now(),
                "schemas": picked, "values": body.get("values", {}), "revision_reason": "created",
                "aggregated_scheme": [f for s in picked for f in s["scheme"]["fields"]],
                "archived": False, "deleted": False, "industries": named(self.industries, body.get("industries", [])),
            })
        # Any other path (revisions included) is accepted and ignored, like the original stand-in.
        return 201, {"id": created}


def make_handler(register: Register) -> type[BaseHTTPRequestHandler]:
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, format: str, *args: Any) -> None:  # noqa: A002 - request logging is off
            pass

        def _send(self, code: int, body: Any) -> None:
            raw = json.dumps(body).encode()
            self.send_response(code)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(raw)))
            self.end_headers()
            self.wfile.write(raw)

        def do_GET(self) -> None:  # noqa: N802
            try:
                self._send(*register.get(self.path))
            except ValueError as e:
                self._send(500, {"detail": f"Bad query: {e}"})

        def do_POST(self) -> None:  # noqa: N802
            try:
                length = int(self.headers.get("Content-Length", 0))
                body = json.loads(self.rfile.read(length) or b"{}")
                self._send(*register.post(self.path, body))
            except KeyError as e:
                self._send(500, {"detail": f"Missing field: {e.args[0]}"})
            except (ValueError, AttributeError, TypeError) as e:
                self._send(500, {"detail": f"Unreadable request: {e}"})

    return Handler


def make_server(host: str, port: int, register: Register | None = None) -> ThreadingHTTPServer:
    server = ThreadingHTTPServer((host, port), make_handler(register or Register()))
    server.daemon_threads = True
    return server


# Loopback by default: a mock listening on every interface is a service somebody can reach without meaning to.
# The image sets MOCK_API_HOST=0.0.0.0, since inside a container only its own network can reach it.
HOST = os.environ.get("MOCK_API_HOST", "127.0.0.1")
PORT = int(os.environ.get("MOCK_API_PORT", "8000"))

def main() -> None:
    print(f"The mock assumptions API is listening on http://{HOST}:{PORT}", flush=True)
    make_server(HOST, PORT).serve_forever()


if __name__ == "__main__":
    main()
