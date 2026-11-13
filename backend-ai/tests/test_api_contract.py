import json

from tests.conftest import CID, EXPERT, OFFICER, make_record

PNG = b"\x89PNG\r\n\x1a\n" + b"0" * 64


def test_health(client):
    r = client.get("/api/v1/health")
    assert r.status_code == 200 and r.json()["status"] == "ok"


def test_capabilities_reports_unconfigured_and_leaks_no_secrets(client):
    body = client.get("/api/v1/capabilities").json()
    assert body["nexus_configured"] == {"vision": False, "speech_to_text": False, "llm": False, "text_to_speech": False}
    assert body["supported_languages"] is None
    assert "key" not in json.dumps(body).lower()


def test_unknown_route_uses_error_format_with_correlation_id(client):
    r = client.get("/api/v1/nope", headers={"X-Correlation-ID": "abcdef123456"})
    assert r.status_code == 404
    assert set(r.json()) == {"code", "message", "correlation_id", "details"}
    assert r.json()["correlation_id"] == "abcdef123456" == r.headers["X-Correlation-ID"]


def test_unsafe_correlation_id_is_replaced(client):
    r = client.get("/api/v1/health", headers={"X-Correlation-ID": "x\r\ny"})
    assert r.headers["X-Correlation-ID"] != "x\r\ny"


def test_default_auth_rejects_protected_calls(anon_client):
    r = anon_client.get(f"/api/v1/cases/{CID}")
    assert r.status_code == 401 and r.json()["code"] == "AUTH_NOT_CONFIGURED"


def test_get_case_404(client):
    r = client.get("/api/v1/cases/case_ffffffffffff", headers=OFFICER)
    assert r.status_code == 404 and r.json()["code"] == "CASE_NOT_FOUND"


def test_get_case_ok(client):
    r = client.get(f"/api/v1/cases/{CID}", headers=EXPERT)
    assert r.status_code == 200 and r.json()["status"] == "PENDING_REVIEW"


def _analyze(client, payload=None, image=PNG, audio=None, ctype="image/png"):
    payload = payload if payload is not None else json.dumps(
        {"farm": {"farmer_id": "f_001", "crop": "tomato"}, "client_request_id": "req-12345678"})
    files = {"image": ("leaf.png", image, ctype)}
    if audio:
        files["audio"] = ("v.wav", audio[0], audio[1])
    return client.post("/api/v1/cases/analyze", data={"payload": payload}, files=files, headers=OFFICER)


def test_analyze_valid_inputs_return_honest_501(client):
    r = _analyze(client)
    assert r.status_code == 501 and r.json()["code"] == "ANALYSIS_NOT_IMPLEMENTED"


def test_analyze_rejects_non_image_despite_claimed_type(client):
    r = _analyze(client, image=b"MZ not an image", ctype="image/png")
    assert r.status_code == 415


def test_analyze_rejects_oversize_image(client):
    r = _analyze(client, image=b"\x89PNG\r\n\x1a\n" + b"0" * (9 * 1024 * 1024))
    assert r.status_code == 413


def test_analyze_rejects_bad_audio_type(client):
    assert _analyze(client, audio=(b"abc", "application/x-sh")).status_code == 415


def test_analyze_rejects_extra_payload_fields_and_bad_ids(client):
    bad = json.dumps({"farm": {"farmer_id": "../etc", "crop": "tomato"}, "client_request_id": "req-12345678"})
    assert _analyze(client, payload=bad).status_code == 422
    extra = json.dumps({"farm": {"farmer_id": "f1", "crop": "t"}, "client_request_id": "req-12345678", "approved": True})
    assert _analyze(client, payload=extra).status_code == 422


def test_validation_errors_do_not_echo_submitted_values(client):
    r = client.post(f"/api/v1/cases/{CID}/approve", json={"advisory_version": "SECRET-VALUE"}, headers=OFFICER)
    assert r.status_code == 422 and "SECRET-VALUE" not in r.text
