import ast
import base64
import hashlib
import json
import unittest
from pathlib import Path


WORKER_ROOT = Path(__file__).resolve().parent
NOTEBOOK_PATH = WORKER_ROOT / "notehut_colab.ipynb"
BUNDLE_NAMES = {"ocr_worker.py", "runtime_manager.py", "requirements.txt"}


class NotebookBundleContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        notebook = json.loads(NOTEBOOK_PATH.read_text(encoding="utf-8"))
        bootstrap_source = next(
            "".join(cell["source"])
            for cell in notebook["cells"]
            if cell.get("cell_type") == "code"
            and "EXPECTED_HASHES" in "".join(cell.get("source", []))
        )

        assignments = {}
        for node in ast.parse(bootstrap_source).body:
            if (
                isinstance(node, ast.Assign)
                and len(node.targets) == 1
                and isinstance(node.targets[0], ast.Name)
                and node.targets[0].id in {"BUNDLE", "EXPECTED_HASHES"}
            ):
                assignments[node.targets[0].id] = ast.literal_eval(node.value)

        cls.bundle = assignments["BUNDLE"]
        cls.expected_hashes = assignments["EXPECTED_HASHES"]

    def test_embedded_files_match_reviewed_worker_sources(self):
        self.assertEqual(set(self.bundle), BUNDLE_NAMES)
        self.assertEqual(set(self.expected_hashes), BUNDLE_NAMES)

        for name in sorted(BUNDLE_NAMES):
            embedded = base64.b64decode(self.bundle[name], validate=True)
            source = (WORKER_ROOT / name).read_bytes().replace(b"\r\n", b"\n")
            self.assertEqual(embedded, source, name)
            self.assertEqual(
                hashlib.sha256(embedded).hexdigest(),
                self.expected_hashes[name],
                name,
            )

    def test_embedded_worker_matches_database_queue_contract(self):
        schema = (WORKER_ROOT.parent / "supabase" / "schema.sql").read_text(
            encoding="utf-8"
        )
        worker = base64.b64decode(self.bundle["ocr_worker.py"]).decode("utf-8")
        runtime_manager = base64.b64decode(
            self.bundle["runtime_manager.py"]
        ).decode("utf-8")

        self.assertIn("claim_token uuid", schema)
        self.assertIn('"claim_token"', worker)
        for status in ("pending", "processing", "completed", "embedded", "failed"):
            self.assertIn(f"'{status}'", schema)
        self.assertIn("vector(1024)", schema)
        self.assertIn("dimension != 1024", runtime_manager)


if __name__ == "__main__":
    unittest.main()
