"""Unit tests for offline evaluation helpers."""

import pandas as pd
import pytest

from anomaly_detector.evaluate import scores


def test_scores_perfect():
    y_true = pd.Series([1, 1, 0, 0])
    y_pred = pd.Series([1, 1, 0, 0])
    result = scores(y_true, y_pred)
    assert result == {
        "tp": 2,
        "fp": 0,
        "fn": 0,
        "precision": 1.0,
        "recall": 1.0,
        "f1": 1.0,
    }


def test_scores_handles_zeros():
    y_true = pd.Series([0, 0, 0])
    y_pred = pd.Series([0, 0, 0])
    result = scores(y_true, y_pred)
    assert result["tp"] == 0
    assert result["precision"] == 0.0
    assert result["recall"] == 0.0
    assert result["f1"] == 0.0


def test_scores_partial():
    y_true = pd.Series([1, 1, 1, 0])
    y_pred = pd.Series([1, 0, 0, 1])
    result = scores(y_true, y_pred)
    assert result["tp"] == 1
    assert result["fp"] == 1
    assert result["fn"] == 2
    assert result["precision"] == pytest.approx(0.5)
    assert result["recall"] == pytest.approx(1 / 3)
