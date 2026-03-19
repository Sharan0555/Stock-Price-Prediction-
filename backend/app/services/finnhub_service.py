from typing import Any, Dict, List, Union

import httpx
import asyncio

from app.core.config import settings


class FinnhubService:
    def __init__(self) -> None:
        self._base_url = settings.FINNHUB_BASE_URL
        self._api_key = settings.FINNHUB_API_KEY

    async def _get(
        self, path: str, params: Dict[str, Any] | None = None
    ) -> Union[Dict[str, Any], List[Dict[str, Any]]]:
        params = params or {}
        params["token"] = self._api_key
        async with httpx.AsyncClient(base_url=self._base_url, timeout=8.0) as client:
            response = await client.get(path, params=params)
            response.raise_for_status()
            return response.json()

    async def search_symbol(self, query: str) -> List[Dict[str, Any]]:
        data = await self._get("/search", {"q": query})
        return data.get("result", [])

    async def get_realtime_quote(self, symbol: str) -> Dict[str, Any]:
        return await self._get("/quote", {"symbol": symbol})

    async def get_candles(
        self,
        symbol: str,
        resolution: str,
        from_unix: int,
        to_unix: int,
    ) -> Dict[str, Any]:
        return await self._get(
            "/stock/candle",
            {
                "symbol": symbol,
                "resolution": resolution,
                "from": from_unix,
                "to": to_unix,
            },
        )

    async def list_symbols(self, exchange: str = "US") -> List[Dict[str, Any]]:
        data = await self._get("/stock/symbol", {"exchange": exchange})
        # Finnhub returns a JSON array for this endpoint
        return data if isinstance(data, list) else []
