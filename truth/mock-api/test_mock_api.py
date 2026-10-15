"""Exercises the stand-in over real HTTP. Standard library only:

    python -m unittest discover -s truth/mock-api -p "test_*.py"
"""

from __future__ import annotations

import json
import sys
import threading
import unittest
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any
from urllib.parse import quote

sys.path.insert(0, str(Path(__file__).resolve().parent))

from mock_api import make_server  # noqa: E402


class MockApiTest(unittest.TestCase):
    def setUp(self) -> None:
        self.server = make_server("127.0.0.1", 0)
        self.base = f"http://127.0.0.1:{self.server.server_address[1]}"
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def tearDown(self) -> None:
        self.server.shutdown()
        self.server.server_close()

    def call(self, method: str, path: str, body: Any = None) -> tuple[int, Any, dict[str, str]]:
        data = None if body is None else json.dumps(body).encode()
        req = urllib.request.Request(self.base + path, data=data, method=method,
                                     headers={"Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req) as res:
                return res.status, json.loads(res.read()), dict(res.headers)
        except urllib.error.HTTPError as e:
            return e.code, json.loads(e.read()), dict(e.headers)

    def test_listings_are_bare_windows(self) -> None:
        status, industries, headers = self.call("GET", "/industry?offset=0&limit=100")
        self.assertEqual(status, 200)
        self.assertEqual([i["name"] for i in industries], ["Telemetry", "Aviation", "Maritime", "Energy", "Logistics"])
        self.assertEqual(headers["Content-Type"], "application/json")
        self.assertNotIn("Access-Control-Allow-Origin", headers)
        _, page, _ = self.call("GET", "/assumption?offset=30&limit=10")
        self.assertEqual(len(page), 7)
        self.assertEqual(page[0]["name"], "Assumption 31")
        _, first, _ = self.call("GET", "/assumption?limit=2")
        self.assertEqual(len(first), 2)
        self.assertNotIn("values", first[0])
        self.assertNotIn("industries", first[0])
        self.assertIn("scheme", first[0]["schemas"][0])  # the listing's schemas are full dicts
        _, schemas, _ = self.call("GET", "/schema")
        self.assertEqual(set(schemas[0]), {"id", "name", "revision", "creator", "created_at"})

    def test_items_by_id_or_name(self) -> None:
        _, schemas, _ = self.call("GET", "/schema")
        sid = schemas[0]["id"]
        for path in (f"/schema/{sid}", f"/schema/{sid}/latest", f"/schema/name/{quote('Flight Performance')}"):
            status, schema, _ = self.call("GET", path)
            self.assertEqual(status, 200, path)
            self.assertEqual(schema["id"], sid)
            self.assertEqual(len(schema["scheme"]["constraints"]), 2)
        _, assumptions, _ = self.call("GET", "/assumption")
        _, detail, _ = self.call("GET", f"/assumption/{assumptions[0]['id']}/latest")
        self.assertEqual(detail["values"]["cruise_speed"], 430)
        self.assertEqual([i["name"] for i in detail["industries"]], ["Telemetry", "Maritime"])
        self.assertEqual(self.call("GET", "/industry/nope")[:2], (404, {"detail": "No such industry"}))
        self.assertEqual(self.call("GET", "/elsewhere")[:2], (404, {"detail": "Not found"}))

    def test_create_and_quirks(self) -> None:
        status, created, _ = self.call("POST", "/industry", {"name": "Space", "description": "x", "creator": "me"})
        self.assertEqual(status, 201)
        _, industry, _ = self.call("GET", f"/industry/{created['id']}")
        self.assertEqual(industry, {"id": created["id"], "name": "Space"})

        _, schema_ref, _ = self.call("POST", "/schema", {
            "name": "Orbit", "description": "", "type": 0, "creator": "me", "industries": ["Space"], "global": False,
            "scheme": {"fields": [{"key": "apogee", "display_name": "Apogee", "type": "confined_number",
                                   "required": True, "array": False}], "constraints": []}})
        _, schema, _ = self.call("GET", f"/schema/{schema_ref['id']}/latest")
        self.assertEqual([i["name"] for i in schema["industries"]], ["Space"])
        self.assertFalse(schema["global"])

        _, a_ref, _ = self.call("POST", "/assumption", {
            "name": "Orbit holds", "assumption_text": "Orbit holds", "proposing_party": "Ops",
            "schemas": [schema_ref["id"]], "values": {"apogee": 400}, "tags": [], "validation_responsible_parties": [],
            "creator": "me", "industries": ["Space"], "special_fields": {}})
        _, listing, _ = self.call("GET", "/assumption?offset=0&limit=1")
        self.assertEqual(listing[0]["id"], a_ref["id"])  # inserted first
        _, a, _ = self.call("GET", f"/assumption/{a_ref['id']}/latest")
        self.assertEqual(a["revision_reason"], "created")
        self.assertEqual(a["aggregated_scheme"][0]["key"], "apogee")

        # A revision is accepted and ignored.
        status, _, _ = self.call("POST", f"/schema/{schema_ref['id']}/revisions",
                                 {"creator": "me", "revision_reason": "r", "scheme": {"fields": []}})
        self.assertEqual(status, 201)
        _, again, _ = self.call("GET", f"/schema/{schema_ref['id']}/latest")
        self.assertEqual(len(again["scheme"]["fields"]), 1)

        status, error, _ = self.call("POST", "/industry", {})
        self.assertEqual(status, 500)
        self.assertIn("name", error["detail"])


if __name__ == "__main__":
    unittest.main()
