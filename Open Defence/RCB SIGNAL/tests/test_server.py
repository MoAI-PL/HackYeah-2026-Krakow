"""Testy serwera demonstracyjnego. Uruchomienie: python3 -m unittest discover tests"""

import http.client
import json
import os
import sys
import threading
import unittest
from http.server import ThreadingHTTPServer
from pathlib import Path

os.environ["SIGNAL_PROVIDER"] = "mock"
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import server  # noqa: E402


class ServerTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.httpd = ThreadingHTTPServer(("127.0.0.1", 0), server.Handler)
        cls.port = cls.httpd.server_address[1]
        threading.Thread(target=cls.httpd.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.httpd.shutdown()

    def request(self, method, path, body=None):
        conn = http.client.HTTPConnection("127.0.0.1", self.port, timeout=5)
        conn.request(method, path, body=body, headers={"Content-Type": "application/json"})
        res = conn.getresponse()
        return res.status, res.read()

    def test_index(self):
        status, body = self.request("GET", "/")
        self.assertEqual(status, 200)
        self.assertIn(b"RCB SIGNAL", body)

    def test_dataset(self):
        status, body = self.request("GET", "/data/demo-events.json")
        self.assertEqual(status, 200)
        self.assertTrue(json.loads(body)["meta"]["synthetic"])

    def test_health_reports_no_real_distribution(self):
        status, body = self.request("GET", "/api/health")
        payload = json.loads(body)
        self.assertEqual(status, 200)
        self.assertFalse(payload["realDistribution"])
        self.assertFalse(payload["llm"])

    def test_analyze_without_provider_falls_back(self):
        status, body = self.request("POST", "/api/analyze", json.dumps({"text": "Alert RCB: test"}))
        self.assertEqual(status, 503)
        self.assertEqual(json.loads(body)["fallback"], "rules")

    def test_path_traversal_blocked(self):
        for path in ("/data/../server.py", "/data/%2e%2e/server.py", "/../server.py"):
            status, body = self.request("GET", path)
            self.assertNotIn(b"ThreadingHTTPServer", body, path)


if __name__ == "__main__":
    unittest.main()
