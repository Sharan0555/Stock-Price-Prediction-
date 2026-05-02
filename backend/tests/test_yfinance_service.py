from app.services.yfinance_service import YFinanceService


def test_get_multiple_quotes_passes_keyword_only_is_inr(monkeypatch) -> None:
    service = YFinanceService()

    def fake_get_quote_sync_cached(self, symbol: str, *, is_inr: bool = False) -> dict:
        return {"c": 100.0, "dp": 1.5 if is_inr else 0.5}

    monkeypatch.setattr(
        YFinanceService,
        "_get_quote_sync_cached",
        fake_get_quote_sync_cached,
    )

    result = service.get_multiple_quotes(["AAPL", "TCS.NSE"], is_inr=True)

    assert result["AAPL"]["c"] == 100.0
    assert result["TCS.NSE"]["dp"] == 1.5


def test_get_multiple_quotes_async_passes_keyword_only_is_inr(monkeypatch) -> None:
    import asyncio

    service = YFinanceService()

    def fake_get_quote_sync_cached(self, symbol: str, *, is_inr: bool = False) -> dict:
        return {"c": 200.0, "dp": 2.5 if is_inr else 0.5}

    monkeypatch.setattr(
        YFinanceService,
        "_get_quote_sync_cached",
        fake_get_quote_sync_cached,
    )

    result = asyncio.run(service.get_multiple_quotes_async(["AAPL", "TCS.NSE"], is_inr=True))

    assert result["AAPL"]["c"] == 200.0
    assert result["TCS.NSE"]["dp"] == 2.5
