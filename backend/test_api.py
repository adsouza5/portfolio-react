"""
API endpoint tests — uses FastAPI TestClient with all GCP services mocked.
No network calls, no credentials required.
"""
import pytest
from unittest.mock import MagicMock, patch, AsyncMock
from fastapi.testclient import TestClient

# Patch GCP clients before importing the app so module-level singletons
# never attempt real connections.
_bq_mock    = MagicMock()
_fs_mock    = MagicMock()
_pub_mock   = MagicMock()
_secret_mock = MagicMock()
_secret_mock.access_secret_version.return_value.payload.data = b"fake-td-key"

with (
    patch("google.cloud.bigquery.Client",         return_value=_bq_mock),
    patch("google.cloud.firestore.Client",        return_value=_fs_mock),
    patch("google.cloud.pubsub_v1.PublisherClient", return_value=_pub_mock),
    patch("google.cloud.secretmanager.SecretManagerServiceClient",
          return_value=_secret_mock),
):
    from main import app

client = TestClient(app, raise_server_exceptions=False)


# ── /health ───────────────────────────────────────────────────────────────────

def test_health_returns_200():
    r = client.get("/health")
    assert r.status_code == 200


def test_health_body():
    r = client.get("/health")
    body = r.json()
    assert body["status"] == "ok"
    assert "project" in body
    assert "version" in body


# ── /model-info ───────────────────────────────────────────────────────────────

def test_model_info_no_model_returns_unavailable():
    with patch("main.get_model", return_value=None):
        r = client.get("/model-info")
    assert r.status_code == 200
    assert r.json()["available"] is False


def _fake_artifact():
    from sklearn.linear_model import LogisticRegression
    from sklearn.preprocessing import StandardScaler
    from sklearn.pipeline import Pipeline
    import numpy as np
    model = Pipeline([("scaler", StandardScaler()), ("clf", LogisticRegression())])
    X = np.random.rand(50, 8)
    y = (X[:, 0] > 0.5).astype(int)
    model.fit(X, y)
    return {
        "model":             model,
        "features":          ["rsi","macd_bull","above_ma50","above_ma200",
                              "bb_pos","volatility","ret5","vol_delta"],
        "cv_accuracy":       0.512,
        "cv_std":            0.058,
        "baseline_accuracy": 0.547,
        "n_samples":         408,
        "tickers":           ["AAPL","MSFT"],
        "validation_method": "TimeSeriesSplit(n_splits=5)",
        "feature_importance": [{"name": "rsi", "coefficient": -0.26}],
    }


def test_model_info_with_model_returns_correct_fields():
    with patch("main.get_model", return_value=_fake_artifact()):
        r = client.get("/model-info")
    assert r.status_code == 200
    body = r.json()
    assert body["available"] is True
    assert body["model_type"] == "LogisticRegression"
    assert body["n_features"] == 8
    assert "cv_accuracy" in body
    assert "feature_importance" in body
    assert body["validation_method"] == "TimeSeriesSplit(n_splits=5)"


def test_model_info_pipeline_steps():
    with patch("main.get_model", return_value=_fake_artifact()):
        r = client.get("/model-info")
    steps = r.json()["pipeline_steps"]
    assert steps == ["StandardScaler", "LogisticRegression"]


def test_model_info_computes_fi_when_missing():
    artifact = _fake_artifact()
    del artifact["feature_importance"]
    with patch("main.get_model", return_value=artifact):
        r = client.get("/model-info")
    fi = r.json()["feature_importance"]
    assert len(fi) == 8
    assert all("name" in f and "coefficient" in f for f in fi)


# ── /results/{session_id} ─────────────────────────────────────────────────────

def test_results_empty_session():
    with patch("main.session_get", return_value=[]):
        r = client.get("/results/test-session-123")
    assert r.status_code == 200
    body = r.json()
    assert body["results"] == []
    assert body["count"] == 0


def test_results_with_data():
    fake = [{"ticker": "AAPL", "prediction": "BULLISH", "confidence": 0.72}]
    with patch("main.session_get", return_value=fake):
        r = client.get("/results/abc")
    body = r.json()
    assert body["count"] == 1
    assert body["results"][0]["ticker"] == "AAPL"


# ── /analytics ────────────────────────────────────────────────────────────────

def _bq_row(prediction, count, avg_conf, avg_rsi, unique):
    row = MagicMock()
    row.__getitem__ = lambda s, k: {
        "prediction": prediction, "count": count,
        "avg_confidence": avg_conf, "avg_rsi": avg_rsi,
        "unique_tickers": unique,
    }[k]
    return row


def _acc_row(prediction, total, correct, accuracy, avg_conf, avg_ret):
    row = MagicMock()
    row.__getitem__ = lambda s, k: {
        "prediction": prediction, "total": total, "correct": correct,
        "accuracy": accuracy, "avg_confidence": avg_conf, "avg_return_pct": avg_ret,
    }[k]
    return row


def test_analytics_returns_total_predictions():
    breakdown_rows = [_bq_row("BULLISH", 10, 0.75, 42.0, 3)]
    acc_rows       = [_acc_row("BULLISH", 8, 6, 0.75, 0.75, 2.1)]

    mock_bq = MagicMock()
    q1, q2 = MagicMock(), MagicMock()
    q1.result.return_value = iter(breakdown_rows)
    q2.result.return_value = iter(acc_rows)
    mock_bq.query.side_effect = [q1, q2]

    with patch("main.get_bq_client", return_value=mock_bq):
        r = client.get("/analytics")

    assert r.status_code == 200
    body = r.json()
    assert body["total_predictions"] == 10
    assert len(body["breakdown"]) == 1
    assert body["breakdown"][0]["prediction"] == "BULLISH"


def test_analytics_overall_accuracy_computed():
    breakdown_rows = [_bq_row("BULLISH", 5, 0.7, 40.0, 2)]
    acc_rows       = [_acc_row("BULLISH", 10, 7, 0.70, 0.72, 3.0)]

    mock_bq = MagicMock()
    q1, q2 = MagicMock(), MagicMock()
    q1.result.return_value = iter(breakdown_rows)
    q2.result.return_value = iter(acc_rows)
    mock_bq.query.side_effect = [q1, q2]

    with patch("main.get_bq_client", return_value=mock_bq):
        r = client.get("/analytics")

    body = r.json()
    assert body["total_resolved"] == 10
    assert body["overall_accuracy"] == pytest.approx(0.70, abs=0.01)


def test_analytics_handles_bq_failure_gracefully():
    mock_bq = MagicMock()
    mock_bq.query.side_effect = Exception("bq down")
    with patch("main.get_bq_client", return_value=mock_bq):
        r = client.get("/analytics")
    assert r.status_code == 200
    assert r.json()["total_predictions"] == 0


# ── /predict ──────────────────────────────────────────────────────────────────

FAKE_SCORE = {
    "AAPL": {
        "ticker": "AAPL", "price": 210.5, "prediction": "BULLISH",
        "confidence": 0.72, "rsi": 42.0, "macd_bull": True,
        "above_ma50": True, "above_ma200": True, "bb_pos": 55.0,
        "volatility": 0.018, "ret5": 2.1, "vol_delta": 5.0,
        "atr": 3.2, "volume": 14000000, "sentiment": 13,
    }
}


def test_predict_returns_signals():
    with (
        patch("main.fetch_and_score", new=AsyncMock(return_value=FAKE_SCORE)),
        patch("main.write_to_bq"),
        patch("main.get_publisher"),
    ):
        r = client.post("/predict", json={"tickers": ["AAPL"]})
    assert r.status_code == 200
    body = r.json()
    assert "results" in body
    assert body["results"][0]["ticker"] == "AAPL"
    assert body["results"][0]["prediction"] == "BULLISH"


def test_predict_rejects_too_many_tickers():
    with (
        patch("main.fetch_and_score", new=AsyncMock(return_value={})),
        patch("main.write_to_bq"),
        patch("main.get_publisher"),
    ):
        r = client.post("/predict", json={"tickers": ["A"] * 20})
    assert r.status_code == 400


def test_predict_empty_tickers_rejected():
    r = client.post("/predict", json={"tickers": []})
    assert r.status_code == 400


# ── ensure_outcomes_table idempotency ─────────────────────────────────────────

def test_ensure_outcomes_table_only_calls_create_once():
    import main
    main._outcomes_table_ensured = False  # reset flag

    mock_bq = MagicMock()
    with patch("main.get_bq_client", return_value=mock_bq):
        from main import ensure_outcomes_table
        ensure_outcomes_table()
        ensure_outcomes_table()
        ensure_outcomes_table()

    assert mock_bq.create_table.call_count == 1
    main._outcomes_table_ensured = False  # restore for other tests
