import unittest
from unittest.mock import patch

from runtime_manager import (
    GPUInfo,
    deployment_config,
    redact_config,
    recommend_plan,
    start_tunnel,
)


T4_A = GPUInfo(0, "GPU-t4-a", "Tesla T4", 15360, 7.5)
T4_B = GPUInfo(1, "GPU-t4-b", "Tesla T4", 15360, 7.5)
A100 = GPUInfo(0, "GPU-a100", "A100", 40960, 8.0)
A100_SECOND = GPUInfo(1, "GPU-a100-b", "A100", 40960, 8.0)


class RuntimePlannerTests(unittest.TestCase):
    @patch("runtime_manager.detect_runtime", return_value="kaggle")
    def test_dual_t4_recommends_full_modular_plan(self, _runtime):
        plan = recommend_plan([T4_A, T4_B])

        self.assertEqual(plan.role, "full")
        self.assertEqual(plan.llm_model, "qwen3.5:9b")
        self.assertEqual(plan.embeddings_model, "qwen3-embedding:0.6b")
        self.assertEqual(plan.ocr_engine, "tesseract")
        self.assertNotEqual(plan.ocr_gpu_uuid, plan.ai_gpu_uuid)

    @patch("runtime_manager.detect_runtime", return_value="colab")
    def test_single_t4_avoids_combined_ocr_by_default(self, _runtime):
        plan = recommend_plan([T4_A])

        self.assertEqual(plan.role, "ai")
        self.assertIsNone(plan.ocr_engine)
        self.assertEqual(plan.llm_model, "qwen3.5:9b")
        self.assertTrue(any("separate runtime for OCR" in warning for warning in plan.warnings))

    @patch("runtime_manager.detect_runtime", return_value="kaggle")
    def test_single_t4_rejects_manual_full_role(self, _runtime):
        with self.assertRaisesRegex(RuntimeError, "Full mode requires two GPUs"):
            recommend_plan([T4_A], requested_role="full")

    @patch("runtime_manager.detect_runtime", return_value="jupyter")
    def test_ampere_ocr_uses_unlimited_ocr(self, _runtime):
        plan = recommend_plan([A100], requested_role="ocr")

        self.assertEqual(plan.ocr_engine, "unlimited-ocr")
        self.assertEqual(plan.ocr_gpu_uuid, A100.uuid)
        self.assertIsNone(plan.llm_model)

    @patch("runtime_manager.detect_runtime", return_value="jupyter")
    def test_large_ampere_still_rejects_single_gpu_full_role(self, _runtime):
        with self.assertRaisesRegex(RuntimeError, "Full mode requires two GPUs"):
            recommend_plan([A100], requested_role="full")

    @patch("runtime_manager.detect_runtime", return_value="jupyter")
    def test_heterogeneous_full_plan_allocates_bf16_gpu_to_ocr(self, _runtime):
        plan = recommend_plan([T4_A, A100_SECOND], requested_role="full")

        self.assertEqual(plan.ocr_engine, "unlimited-ocr")
        self.assertEqual(plan.ocr_gpu_uuid, A100_SECOND.uuid)
        self.assertEqual(plan.ai_gpu_uuid, T4_A.uuid)

    @patch("runtime_manager.detect_runtime", return_value="kaggle")
    def test_cpu_runtime_uses_tesseract(self, _runtime):
        plan = recommend_plan([], requested_role="ocr")

        self.assertEqual(plan.ocr_engine, "tesseract")
        self.assertIsNone(plan.ai_gpu_uuid)

    @patch("runtime_manager.detect_runtime", return_value="kaggle")
    def test_cpu_runtime_rejects_ai_roles(self, _runtime):
        with self.assertRaisesRegex(RuntimeError, "requires an NVIDIA GPU"):
            recommend_plan([], requested_role="ai")

    def test_redaction_handles_keys_with_json_characters(self):
        config = {
            "worker": {"apiKey": 'odd"key'},
            "fallbackLlm": {"llmApiKey": 'odd"key'},
            "fallbackEmbeddings": {"embeddingsApiKey": 'odd"key'},
        }

        redacted = redact_config(config)

        self.assertEqual(redacted["worker"]["apiKey"], "<WORKER_API_KEY>")
        self.assertEqual(redacted["fallbackLlm"]["llmApiKey"], "<WORKER_API_KEY>")
        self.assertEqual(
            redacted["fallbackEmbeddings"]["embeddingsApiKey"],
            "<WORKER_API_KEY>",
        )

    @patch("runtime_manager.detect_runtime", return_value="colab")
    def test_colab_rejects_public_tunnels(self, _runtime):
        with self.assertRaisesRegex(RuntimeError, "disabled on managed Colab"):
            start_tunnel("ngrok")

    @patch("runtime_manager.detect_runtime", return_value="jupyter")
    def test_remote_ai_config_requires_public_url(self, _runtime):
        plan = recommend_plan([T4_A], requested_role="ai")
        with self.assertRaisesRegex(RuntimeError, "public HTTPS URL"):
            deployment_config(None, plan)


if __name__ == "__main__":
    unittest.main()
