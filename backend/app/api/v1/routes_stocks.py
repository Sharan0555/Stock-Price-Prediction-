from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pymongo import UpdateOne

from app.core.config import settings

from app.db.mongo import mongo_db

from app.services.finnhub_service import FinnhubService
from app.services.alpha_vantage_service import AlphaVantageService
from app.services.local_data_service import LocalDataService
from app.services.yfinance_service import YFinanceService

import time as _time
_cache: dict = {}

def _cache_get(key: str, ttl: int):
    entry = _cache.get(key)
    if entry and _time.time() < entry[1]:
        return entry[0]
    return None

def _cache_set(key: str, value, ttl: int):
    _cache[key] = (value, _time.time() + ttl)




router = APIRouter()
_finnhub_service = FinnhubService()
_alpha_service = AlphaVantageService()
_local_data_service = LocalDataService()
_yfinance_service = YFinanceService()

US_TOP_50 = [
    {
        "symbol": "AAPL",
        "description": "Apple",
        "type": "Technology (Consumer Electronics)",
        "currency": "USD",
    },
    {
        "symbol": "MSFT",
        "description": "Microsoft",
        "type": "Technology (Software / Cloud)",
        "currency": "USD",
    },
    {
        "symbol": "GOOGL",
        "description": "Alphabet (Google)",
        "type": "Technology (Internet Services)",
        "currency": "USD",
    },
    {
        "symbol": "AMZN",
        "description": "Amazon",
        "type": "Consumer Discretionary (E-commerce / Cloud)",
        "currency": "USD",
    },
    {
        "symbol": "NVDA",
        "description": "NVIDIA",
        "type": "Technology (Semiconductors / AI Chips)",
        "currency": "USD",
    },
    {
        "symbol": "META",
        "description": "Meta Platforms",
        "type": "Technology (Social Media)",
        "currency": "USD",
    },
    {
        "symbol": "TSLA",
        "description": "Tesla",
        "type": "Consumer Discretionary (Electric Vehicles)",
        "currency": "USD",
    },
    {
        "symbol": "BRK.B",
        "description": "Berkshire Hathaway",
        "type": "Financial (Investment / Insurance)",
        "currency": "USD",
    },
    {
        "symbol": "LLY",
        "description": "Eli Lilly",
        "type": "Healthcare (Pharmaceuticals)",
        "currency": "USD",
    },
    {
        "symbol": "JPM",
        "description": "JPMorgan Chase",
        "type": "Financial (Banking)",
        "currency": "USD",
    },
    {
        "symbol": "V",
        "description": "Visa",
        "type": "Financial (Payment Processing)",
        "currency": "USD",
    },
    {
        "symbol": "XOM",
        "description": "Exxon Mobil",
        "type": "Energy (Oil & Gas)",
        "currency": "USD",
    },
    {
        "symbol": "WMT",
        "description": "Walmart",
        "type": "Consumer Staples (Retail)",
        "currency": "USD",
    },
    {
        "symbol": "UNH",
        "description": "UnitedHealth",
        "type": "Healthcare (Insurance / Healthcare Services)",
        "currency": "USD",
    },
    {
        "symbol": "MA",
        "description": "Mastercard",
        "type": "Financial (Payment Processing)",
        "currency": "USD",
    },
    {
        "symbol": "COST",
        "description": "Costco",
        "type": "Consumer Staples (Retail Warehouse)",
        "currency": "USD",
    },
    {
        "symbol": "AVGO",
        "description": "Broadcom",
        "type": "Technology (Semiconductors)",
        "currency": "USD",
    },
    {
        "symbol": "PG",
        "description": "Procter & Gamble",
        "type": "Consumer Staples (Household Products)",
        "currency": "USD",
    },
    {
        "symbol": "HD",
        "description": "Home Depot",
        "type": "Consumer Discretionary (Home Improvement Retail)",
        "currency": "USD",
    },
    {
        "symbol": "JNJ",
        "description": "Johnson & Johnson",
        "type": "Healthcare (Pharmaceuticals / Medical Devices)",
        "currency": "USD",
    },
    {
        "symbol": "ORCL",
        "description": "Oracle",
        "type": "Technology (Enterprise Software / Cloud)",
        "currency": "USD",
    },
    {
        "symbol": "ABBV",
        "description": "AbbVie",
        "type": "Healthcare (Pharmaceuticals)",
        "currency": "USD",
    },
    {
        "symbol": "CVX",
        "description": "Chevron",
        "type": "Energy (Oil & Gas)",
        "currency": "USD",
    },
    {
        "symbol": "KO",
        "description": "Coca-Cola",
        "type": "Consumer Staples (Beverages)",
        "currency": "USD",
    },
    {
        "symbol": "PEP",
        "description": "PepsiCo",
        "type": "Consumer Staples (Food & Beverages)",
        "currency": "USD",
    },
    {
        "symbol": "NFLX",
        "description": "Netflix",
        "type": "Communication Services (Streaming)",
        "currency": "USD",
    },
    {
        "symbol": "ADBE",
        "description": "Adobe",
        "type": "Technology (Software)",
        "currency": "USD",
    },
    {
        "symbol": "CRM",
        "description": "Salesforce",
        "type": "Technology (Cloud / CRM Software)",
        "currency": "USD",
    },
    {
        "symbol": "AMD",
        "description": "AMD",
        "type": "Technology (Semiconductors)",
        "currency": "USD",
    },
    {
        "symbol": "INTC",
        "description": "Intel",
        "type": "Technology (Semiconductors)",
        "currency": "USD",
    },
    {
        "symbol": "CSCO",
        "description": "Cisco",
        "type": "Technology (Networking Hardware)",
        "currency": "USD",
    },
    {
        "symbol": "MCD",
        "description": "McDonald's",
        "type": "Consumer Discretionary (Restaurants / Fast Food)",
        "currency": "USD",
    },
    {
        "symbol": "PFE",
        "description": "Pfizer",
        "type": "Healthcare (Pharmaceuticals)",
        "currency": "USD",
    },
    {
        "symbol": "NKE",
        "description": "Nike",
        "type": "Consumer Discretionary (Apparel / Footwear)",
        "currency": "USD",
    },
    {
        "symbol": "QCOM",
        "description": "Qualcomm",
        "type": "Technology (Semiconductors / Telecom Chips)",
        "currency": "USD",
    },
    {
        "symbol": "IBM",
        "description": "IBM",
        "type": "Technology (IT Services / Cloud)",
        "currency": "USD",
    },
    {
        "symbol": "GS",
        "description": "Goldman Sachs",
        "type": "Financial (Investment Banking)",
        "currency": "USD",
    },
    {
        "symbol": "MS",
        "description": "Morgan Stanley",
        "type": "Financial (Investment Banking / Wealth Management)",
        "currency": "USD",
    },
    {
        "symbol": "AXP",
        "description": "American Express",
        "type": "Financial (Credit Services)",
        "currency": "USD",
    },
    {
        "symbol": "SBUX",
        "description": "Starbucks",
        "type": "Consumer Discretionary (Restaurants / Coffee)",
        "currency": "USD",
    },
    {
        "symbol": "BA",
        "description": "Boeing",
        "type": "Industrials (Aerospace / Defense)",
        "currency": "USD",
    },
    {
        "symbol": "HON",
        "description": "Honeywell",
        "type": "Industrials (Engineering / Aerospace)",
        "currency": "USD",
    },
    {
        "symbol": "LMT",
        "description": "Lockheed Martin",
        "type": "Industrials (Defense / Aerospace)",
        "currency": "USD",
    },
    {
        "symbol": "GE",
        "description": "General Electric",
        "type": "Industrials (Industrial Conglomerate)",
        "currency": "USD",
    },
    {
        "symbol": "F",
        "description": "Ford",
        "type": "Consumer Discretionary (Automobiles)",
        "currency": "USD",
    },
    {
        "symbol": "T",
        "description": "AT&T",
        "type": "Communication Services (Telecom)",
        "currency": "USD",
    },
    {
        "symbol": "VZ",
        "description": "Verizon",
        "type": "Communication Services (Telecom)",
        "currency": "USD",
    },
    {
        "symbol": "UPS",
        "description": "UPS",
        "type": "Industrials (Logistics / Delivery)",
        "currency": "USD",
    },
    {
        "symbol": "FDX",
        "description": "FedEx",
        "type": "Industrials (Logistics / Delivery)",
        "currency": "USD",
    },
    {
        "symbol": "MU",
        "description": "Micron Technology",
        "type": "Technology (Semiconductors / Memory Chips)",
        "currency": "USD",
    },
]

INR_TOP_100 = [
    {
        "symbol": "RELIANCE",
        "description": "Reliance Industries",
        "type": "Energy / Conglomerate",
        "currency": "INR",
    },
    {
        "symbol": "TCS",
        "description": "Tata Consultancy Services",
        "type": "Technology (IT Services)",
        "currency": "INR",
    },
    {
        "symbol": "HDFCBANK",
        "description": "HDFC Bank",
        "type": "Financial (Banking)",
        "currency": "INR",
    },
    {
        "symbol": "ICICIBANK",
        "description": "ICICI Bank",
        "type": "Financial (Banking)",
        "currency": "INR",
    },
    {
        "symbol": "BHARTIARTL",
        "description": "Bharti Airtel",
        "type": "Telecommunication",
        "currency": "INR",
    },
    {
        "symbol": "SBIN",
        "description": "State Bank of India",
        "type": "Financial (Banking)",
        "currency": "INR",
    },
    {
        "symbol": "INFY",
        "description": "Infosys",
        "type": "Technology (IT Services)",
        "currency": "INR",
    },
    {
        "symbol": "HINDUNILVR",
        "description": "Hindustan Unilever",
        "type": "Consumer Staples (FMCG)",
        "currency": "INR",
    },
    {
        "symbol": "ITC",
        "description": "ITC",
        "type": "Consumer Staples (FMCG)",
        "currency": "INR",
    },
    {
        "symbol": "LT",
        "description": "Larsen & Toubro",
        "type": "Industrials (Engineering)",
        "currency": "INR",
    },
    {
        "symbol": "AXISBANK",
        "description": "Axis Bank",
        "type": "Financial (Banking)",
        "currency": "INR",
    },
    {
        "symbol": "KOTAKBANK",
        "description": "Kotak Mahindra Bank",
        "type": "Financial (Banking)",
        "currency": "INR",
    },
    {
        "symbol": "BAJFINANCE",
        "description": "Bajaj Finance",
        "type": "Financial (NBFC)",
        "currency": "INR",
    },
    {
        "symbol": "ADANIENT",
        "description": "Adani Enterprises",
        "type": "Conglomerate",
        "currency": "INR",
    },
    {
        "symbol": "ADANIPORTS",
        "description": "Adani Ports",
        "type": "Infrastructure / Logistics",
        "currency": "INR",
    },
    {
        "symbol": "SUNPHARMA",
        "description": "Sun Pharmaceutical",
        "type": "Healthcare (Pharma)",
        "currency": "INR",
    },
    {
        "symbol": "ULTRACEMCO",
        "description": "UltraTech Cement",
        "type": "Materials (Cement)",
        "currency": "INR",
    },
    {
        "symbol": "TITAN",
        "description": "Titan Company",
        "type": "Consumer Discretionary (Jewellery / Retail)",
        "currency": "INR",
    },
    {
        "symbol": "NESTLEIND",
        "description": "Nestle India",
        "type": "Consumer Staples (Food)",
        "currency": "INR",
    },
    {
        "symbol": "ASIANPAINT",
        "description": "Asian Paints",
        "type": "Materials (Paints)",
        "currency": "INR",
    },
    {
        "symbol": "POWERGRID",
        "description": "Power Grid Corporation",
        "type": "Utilities (Power Transmission)",
        "currency": "INR",
    },
    {
        "symbol": "NTPC",
        "description": "NTPC",
        "type": "Utilities (Power Generation)",
        "currency": "INR",
    },
    {
        "symbol": "COALINDIA",
        "description": "Coal India",
        "type": "Energy (Coal Mining)",
        "currency": "INR",
    },
    {
        "symbol": "MARUTI",
        "description": "Maruti Suzuki",
        "type": "Automobile",
        "currency": "INR",
    },
    {
        "symbol": "M&M",
        "description": "Mahindra & Mahindra",
        "type": "Automobile",
        "currency": "INR",
    },
    {
        "symbol": "TATAMOTORS",
        "description": "Tata Motors",
        "type": "Automobile",
        "currency": "INR",
    },
    {
        "symbol": "TATASTEEL",
        "description": "Tata Steel",
        "type": "Materials (Steel)",
        "currency": "INR",
    },
    {
        "symbol": "HCLTECH",
        "description": "HCL Technologies",
        "type": "Technology (IT Services)",
        "currency": "INR",
    },
    {
        "symbol": "WIPRO",
        "description": "Wipro",
        "type": "Technology (IT Services)",
        "currency": "INR",
    },
    {
        "symbol": "TECHM",
        "description": "Tech Mahindra",
        "type": "Technology (IT Services)",
        "currency": "INR",
    },
    {
        "symbol": "DRREDDY",
        "description": "Dr Reddy's Laboratories",
        "type": "Healthcare (Pharma)",
        "currency": "INR",
    },
    {
        "symbol": "CIPLA",
        "description": "Cipla",
        "type": "Healthcare (Pharma)",
        "currency": "INR",
    },
    {
        "symbol": "APOLLOHOSP",
        "description": "Apollo Hospitals",
        "type": "Healthcare (Hospitals)",
        "currency": "INR",
    },
    {
        "symbol": "DIVISLAB",
        "description": "Divi's Laboratories",
        "type": "Healthcare (Pharma)",
        "currency": "INR",
    },
    {
        "symbol": "GRASIM",
        "description": "Grasim Industries",
        "type": "Materials (Cement / Chemicals)",
        "currency": "INR",
    },
    {
        "symbol": "HINDALCO",
        "description": "Hindalco Industries",
        "type": "Materials (Metals)",
        "currency": "INR",
    },
    {
        "symbol": "JSWSTEEL",
        "description": "JSW Steel",
        "type": "Materials (Steel)",
        "currency": "INR",
    },
    {
        "symbol": "VEDL",
        "description": "Vedanta",
        "type": "Materials (Mining / Metals)",
        "currency": "INR",
    },
    {
        "symbol": "ADANIGREEN",
        "description": "Adani Green Energy",
        "type": "Energy (Renewable)",
        "currency": "INR",
    },
    {
        "symbol": "ADANIPOWER",
        "description": "Adani Power",
        "type": "Utilities (Power Generation)",
        "currency": "INR",
    },
    {
        "symbol": "ADANIENSOL",
        "description": "Adani Energy Solutions",
        "type": "Utilities",
        "currency": "INR",
    },
    {
        "symbol": "TATAPOWER",
        "description": "Tata Power",
        "type": "Utilities",
        "currency": "INR",
    },
    {
        "symbol": "BAJAJ-AUTO",
        "description": "Bajaj Auto",
        "type": "Automobile",
        "currency": "INR",
    },
    {
        "symbol": "HEROMOTOCO",
        "description": "Hero MotoCorp",
        "type": "Automobile",
        "currency": "INR",
    },
    {
        "symbol": "EICHERMOT",
        "description": "Eicher Motors",
        "type": "Automobile",
        "currency": "INR",
    },
    {
        "symbol": "TVSMOTOR",
        "description": "TVS Motor",
        "type": "Automobile",
        "currency": "INR",
    },
    {
        "symbol": "BRITANNIA",
        "description": "Britannia Industries",
        "type": "Consumer Staples (Food)",
        "currency": "INR",
    },
    {
        "symbol": "DABUR",
        "description": "Dabur India",
        "type": "Consumer Staples (FMCG)",
        "currency": "INR",
    },
    {
        "symbol": "GODREJCP",
        "description": "Godrej Consumer Products",
        "type": "Consumer Staples",
        "currency": "INR",
    },
    {
        "symbol": "COLPAL",
        "description": "Colgate-Palmolive India",
        "type": "Consumer Staples",
        "currency": "INR",
    },
    {
        "symbol": "HAVELLS",
        "description": "Havells India",
        "type": "Consumer Electricals",
        "currency": "INR",
    },
    {
        "symbol": "SIEMENS",
        "description": "Siemens India",
        "type": "Industrials",
        "currency": "INR",
    },
    {
        "symbol": "ABB",
        "description": "ABB India",
        "type": "Industrials",
        "currency": "INR",
    },
    {
        "symbol": "BOSCHLTD",
        "description": "Bosch India",
        "type": "Automobile Components",
        "currency": "INR",
    },
    {
        "symbol": "CGPOWER",
        "description": "CG Power",
        "type": "Industrials",
        "currency": "INR",
    },
    {
        "symbol": "CUMMINSIND",
        "description": "Cummins India",
        "type": "Industrials",
        "currency": "INR",
    },
    {
        "symbol": "BEL",
        "description": "Bharat Electronics",
        "type": "Defense Electronics",
        "currency": "INR",
    },
    {
        "symbol": "HAL",
        "description": "HAL",
        "type": "Defense / Aerospace",
        "currency": "INR",
    },
    {
        "symbol": "BHARATFORG",
        "description": "Bharat Forge",
        "type": "Automobile Components",
        "currency": "INR",
    },
    {
        "symbol": "IOC",
        "description": "Indian Oil Corporation",
        "type": "Energy (Oil & Gas)",
        "currency": "INR",
    },
    {
        "symbol": "ONGC",
        "description": "ONGC",
        "type": "Energy (Oil & Gas)",
        "currency": "INR",
    },
    {
        "symbol": "GAIL",
        "description": "GAIL India",
        "type": "Energy (Gas)",
        "currency": "INR",
    },
    {
        "symbol": "PETRONET",
        "description": "Petronet LNG",
        "type": "Energy (LNG)",
        "currency": "INR",
    },
    {
        "symbol": "SHRIRAMFIN",
        "description": "Shriram Finance",
        "type": "Financial (NBFC)",
        "currency": "INR",
    },
    {
        "symbol": "LICI",
        "description": "LIC India",
        "type": "Financial (Insurance)",
        "currency": "INR",
    },
    {
        "symbol": "SBILIFE",
        "description": "SBI Life Insurance",
        "type": "Financial (Insurance)",
        "currency": "INR",
    },
    {
        "symbol": "HDFCLIFE",
        "description": "HDFC Life Insurance",
        "type": "Financial (Insurance)",
        "currency": "INR",
    },
    {
        "symbol": "ICICIPRULI",
        "description": "ICICI Prudential Life",
        "type": "Financial (Insurance)",
        "currency": "INR",
    },
    {
        "symbol": "ICICIGI",
        "description": "ICICI Lombard",
        "type": "Financial (Insurance)",
        "currency": "INR",
    },
    {
        "symbol": "BAJAJFINSV",
        "description": "Bajaj Finserv",
        "type": "Financial (Insurance / NBFC)",
        "currency": "INR",
    },
    {
        "symbol": "BANDHANBNK",
        "description": "Bandhan Bank",
        "type": "Financial (Banking)",
        "currency": "INR",
    },
    {
        "symbol": "INDUSINDBK",
        "description": "IndusInd Bank",
        "type": "Financial (Banking)",
        "currency": "INR",
    },
    {
        "symbol": "FEDERALBNK",
        "description": "Federal Bank",
        "type": "Financial (Banking)",
        "currency": "INR",
    },
    {
        "symbol": "YESBANK",
        "description": "Yes Bank",
        "type": "Financial (Banking)",
        "currency": "INR",
    },
    {
        "symbol": "TRENT",
        "description": "Trent",
        "type": "Retail",
        "currency": "INR",
    },
    {
        "symbol": "ZOMATO",
        "description": "Zomato",
        "type": "Technology (Food Delivery)",
        "currency": "INR",
    },
    {
        "symbol": "PAYTM",
        "description": "Paytm",
        "type": "Fintech",
        "currency": "INR",
    },
    {
        "symbol": "IRCTC",
        "description": "IRCTC",
        "type": "Travel / Railway Services",
        "currency": "INR",
    },
    {
        "symbol": "INDIGO",
        "description": "InterGlobe Aviation",
        "type": "Airlines",
        "currency": "INR",
    },
    {
        "symbol": "CONCOR",
        "description": "Container Corporation",
        "type": "Logistics",
        "currency": "INR",
    },
    {
        "symbol": "DLF",
        "description": "DLF",
        "type": "Real Estate",
        "currency": "INR",
    },
    {
        "symbol": "GODREJPROP",
        "description": "Godrej Properties",
        "type": "Real Estate",
        "currency": "INR",
    },
    {
        "symbol": "LODHA",
        "description": "Macrotech Developers",
        "type": "Real Estate",
        "currency": "INR",
    },
    {
        "symbol": "PRESTIGE",
        "description": "Prestige Estates",
        "type": "Real Estate",
        "currency": "INR",
    },
    {
        "symbol": "PAGEIND",
        "description": "Page Industries",
        "type": "Apparel",
        "currency": "INR",
    },
    {
        "symbol": "SRF",
        "description": "SRF",
        "type": "Chemicals",
        "currency": "INR",
    },
    {
        "symbol": "PIIND",
        "description": "PI Industries",
        "type": "Agro Chemicals",
        "currency": "INR",
    },
    {
        "symbol": "DMART",
        "description": "Avenue Supermarts (DMart)",
        "type": "Retail",
        "currency": "INR",
    },
    {
        "symbol": "RELAXO",
        "description": "Relaxo Footwears",
        "type": "Footwear",
        "currency": "INR",
    },
    {
        "symbol": "POLYCAB",
        "description": "Polycab India",
        "type": "Electrical Equipment",
        "currency": "INR",
    },
    {
        "symbol": "ASTRAL",
        "description": "Astral",
        "type": "Building Materials",
        "currency": "INR",
    },
    {
        "symbol": "DEEPAKNTR",
        "description": "Deepak Nitrite",
        "type": "Chemicals",
        "currency": "INR",
    },
    {
        "symbol": "AARTIIND",
        "description": "Aarti Industries",
        "type": "Chemicals",
        "currency": "INR",
    },
    {
        "symbol": "SONACOMS",
        "description": "Sona BLW Precision",
        "type": "Auto Components",
        "currency": "INR",
    },
    {
        "symbol": "MOTHERSON",
        "description": "Samvardhana Motherson",
        "type": "Auto Components",
        "currency": "INR",
    },
    {
        "symbol": "TIINDIA",
        "description": "Tube Investments",
        "type": "Engineering",
        "currency": "INR",
    },
    {
        "symbol": "INDHOTEL",
        "description": "Indian Hotels",
        "type": "Hospitality",
        "currency": "INR",
    },
    {
        "symbol": "TATACONSUM",
        "description": "Tata Consumer Products",
        "type": "Consumer Staples",
        "currency": "INR",
    },
    {
        "symbol": "VBL",
        "description": "Varun Beverages",
        "type": "Beverages",
        "currency": "INR",
    },
    {
        "symbol": "PIDILITIND",
        "description": "Pidilite Industries",
        "type": "Chemicals / Adhesives",
        "currency": "INR",
    },
]

INR_SYMBOLS = {s["symbol"] for s in INR_TOP_100}

def _looks_like_inr_symbol(symbol: str) -> bool:
    sym = symbol.upper()
    if sym in INR_SYMBOLS:
        return True
    return sym.endswith(".NS") or sym.endswith(".NSE") or sym.endswith(".BSE") or sym.endswith(".BO")

def _alpha_candidates(symbol: str) -> list[str]:
    sym = symbol.upper()
    # Normalize common India suffixes to Alpha Vantage expected format.
    if sym.endswith(".NS"):
        return [sym.replace(".NS", ".NSE")]
    if sym.endswith(".BO"):
        return [sym.replace(".BO", ".BSE")]
    if "." in sym:
        return [sym]
    suffixes: list[str] = []
    primary = settings.ALPHAVANTAGE_INR_SUFFIX or ""
    if primary:
        suffixes.append(primary)
    # Alpha Vantage commonly supports India via BSE; try NSE as fallback.
    for extra in (".BSE", ".NSE"):
        if extra and extra not in suffixes:
            suffixes.append(extra)
    if not suffixes:
        return [symbol]
    return [f"{symbol}{suffix}" for suffix in suffixes]

def get_finnhub_service() -> FinnhubService:
    return _finnhub_service

def get_alpha_vantage_service() -> AlphaVantageService:
    return _alpha_service

def get_local_data_service() -> LocalDataService:
    return _local_data_service

def get_yfinance_service() -> YFinanceService:
    return _yfinance_service

def _store_history(symbol: str, series: list[dict], source: str) -> None:
    if not series:
        return
    try:
        col = mongo_db.get_collection("stock_history")
        ops: list[UpdateOne] = []
        for point in series:
            ts = int(point.get("t", 0))
            close = float(point.get("c", 0.0))
            if not ts:
                continue
            ops.append(
                UpdateOne(
                    {"symbol": symbol, "t": ts},
                    {"$set": {"symbol": symbol, "t": ts, "c": close, "source": source}},
                    upsert=True,
                )
            )
        if ops:
            col.bulk_write(ops, ordered=False)
    except Exception:
        # Cache write is best-effort; ignore failures.
        return


@router.get("/search")
async def search_stocks(
    q: str = Query(..., min_length=1),
    service: FinnhubService = Depends(get_finnhub_service),
) -> dict:
    if settings.LOCAL_DATA_ONLY or not settings.FINNHUB_API_KEY:
        needle = q.lower().strip()
        combined = US_TOP_50 + INR_TOP_100
        results = [
            s
            for s in combined
            if needle in str(s.get("symbol", "")).lower()
            or needle in str(s.get("description", "")).lower()
        ]
        return {"query": q, "results": results}
    try:
        results = await service.search_symbol(q)
        return {"query": q, "results": results}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Finnhub error: {e}") from e


@router.get("/symbols")
async def list_symbols(
    exchange: str = Query("US", min_length=1, max_length=12),
    limit: int = Query(1000, ge=1, le=1000),
    offset: int = Query(0, ge=0, le=200000),
    q: str | None = Query(None, min_length=1),
    service: FinnhubService = Depends(get_finnhub_service),
) -> dict:
    """
    List all symbols for an exchange (Finnhub /stock/symbol).
    Supports server-side offset/limit and an optional client-side filter `q`
    (Finnhub doesn't support search on this endpoint).
    """
    exchange_code = exchange.upper()
    if exchange_code == "US":
        symbols = US_TOP_50
    elif exchange_code in {"INR", "IN"}:
        symbols = INR_TOP_100
    else:
        symbols = []

    if symbols:
        if q:
            needle = q.lower().strip()
            symbols = [
                s
                for s in symbols
                if needle in str(s.get("symbol", "")).lower()
                or needle in str(s.get("description", "")).lower()
            ]

        total = len(symbols)
        page = symbols[offset : offset + limit]
        return {
            "exchange": exchange_code,
            "total": total,
            "limit": limit,
            "offset": offset,
            "results": page,
        }

    if not settings.FINNHUB_API_KEY:
        return {
            "exchange": exchange_code,
            "total": 0,
            "limit": limit,
            "offset": offset,
            "results": [],
        }

    try:
        symbols = await service.list_symbols(exchange=exchange.upper())
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Finnhub error: {e}") from e

    if q:
        needle = q.lower().strip()
        symbols = [
            s
            for s in symbols
            if needle in str(s.get("symbol", "")).lower()
            or needle in str(s.get("description", "")).lower()
        ]

    total = len(symbols)
    page = symbols[offset : offset + limit]
    return {
        "exchange": exchange.upper(),
        "total": total,
        "limit": limit,
        "offset": offset,
        "results": page,
    }


@router.get("/fx/inr")
async def get_inr_exchange_rate(
    base: str = Query("USD", min_length=3, max_length=5),
    alpha: AlphaVantageService = Depends(get_alpha_vantage_service),
) -> dict:
    """
    Returns an exchange rate from the base currency to INR.
    """
    if not settings.ALPHAVANTAGE_API_KEY:
        return {
            "from": base,
            "to": "INR",
            "rate": 83.0,
            "source": "local",
            "note": "Using placeholder rate because ALPHAVANTAGE_API_KEY is not set.",
        }
    try:
        rate = alpha.get_exchange_rate(base, "INR")
        return rate
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Alpha Vantage error: {e}") from e


@router.get("/{symbol}/quote")
async def get_realtime_price(
    symbol: str,
    allow_local: bool = Query(True),
    local_data: LocalDataService = Depends(get_local_data_service),
    yfinance: YFinanceService = Depends(get_yfinance_service),
) -> dict:
    sym = symbol.upper()
    is_inr = _looks_like_inr_symbol(sym)
    currency = "INR" if is_inr else "USD"
    if settings.LOCAL_DATA_ONLY:
        if not allow_local:
            raise HTTPException(
                status_code=503,
                detail="Local-only mode is enabled; live data is unavailable.",
            )
        quote = local_data.get_quote(sym, currency)
        return {"symbol": sym, "quote": quote, "source": "local"}

    cache_key = f"quote:yfinance:{sym}"
    cached = _cache_get(cache_key, 10)
    if cached is not None:
        return cached
    try:
        yf_quote = await yfinance.get_quote(sym, is_inr=is_inr)
        if yf_quote and yf_quote.get("c"):
            response = {"symbol": sym, "quote": yf_quote, "source": "yfinance"}
            _cache_set(cache_key, response, 10)
            return response
    except Exception as exc:
        if not allow_local:
            raise HTTPException(
                status_code=502,
                detail=f"YFinance error: {exc}",
            ) from exc

    if not allow_local:
        raise HTTPException(
            status_code=502,
            detail="YFinance unavailable and local fallback disabled.",
        )
    quote = local_data.get_quote(sym, currency)
    return {"symbol": sym, "quote": quote, "source": "local"}


@router.get("/{symbol}/info")
async def get_company_info(
    symbol: str,
    yfinance: YFinanceService = Depends(get_yfinance_service),
) -> dict:
    sym = symbol.upper()
    is_inr = _looks_like_inr_symbol(sym)
    _ck = f"info:{sym}"
    _cached = _cache_get(_ck, 3600)
    if _cached is not None:
        return _cached
    try:
        info = await yfinance.get_company_info(sym, is_inr=is_inr)
        if not info:
            raise HTTPException(status_code=404, detail=f"No company info for {sym}")
        return {"symbol": sym, "source": "yfinance", "info": info}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"YFinance error: {exc}") from exc


@router.get("/{symbol}/history")
async def get_history(
    symbol: str,
    days: int = Query(90, ge=1, le=3650),
    resolution: str = Query("D"),
    allow_local: bool = Query(True),
    service: FinnhubService = Depends(get_finnhub_service),
    yfinance: YFinanceService = Depends(get_yfinance_service),
    alpha: AlphaVantageService = Depends(get_alpha_vantage_service),
    local_data: LocalDataService = Depends(get_local_data_service),
) -> dict:
    """
    Returns historical close prices.
    Source preference:
    - MongoDB (if data exists)
    - yfinance daily history (no API key)
    - Finnhub candles (if API key configured)
    - Alpha Vantage fallback (if configured)
    - Local fallback (if allow_local)
    """
    sym = symbol.upper()
    is_inr = _looks_like_inr_symbol(sym)

    # 1) MongoDB lookup
    closes: list[dict] = []
    try:
        col = mongo_db.get_collection("stock_history")
        cursor = (
            col.find({"symbol": sym}, {"_id": 0, "t": 1, "c": 1})
            .sort("t", -1)
            .limit(days + 5)
        )
        docs = list(cursor)
        docs.reverse()
        closes = [{"t": int(d["t"]), "c": float(d["c"])} for d in docs if "t" in d and "c" in d]
    except Exception:
        closes = []

    if closes:
        return {"symbol": sym, "source": "mongo", "series": closes}

    # Local-only mode: generate deterministic synthetic data and cache to Mongo.
    if settings.LOCAL_DATA_ONLY:
        if not allow_local:
            raise HTTPException(
                status_code=503,
                detail="Local-only mode is enabled; live data is unavailable.",
            )
        currency = "INR" if is_inr else "USD"
        series = local_data.get_series(sym, currency, days)
        _store_history(sym, series, "local")
        return {"symbol": sym, "source": "local", "series": series}

    _hk = f"hist:{sym}:{days}"
    _hv = _cache_get(_hk, 300)
    if _hv is not None:
        return _hv

    # 2) yfinance daily series (no API key needed)
    if resolution.upper() == "D":
        try:
            series = await yfinance.get_daily_series(sym, days, is_inr=is_inr)
            if series:
                if days and len(series) > days:
                    series = series[-days:]
                _store_history(sym, series, "yfinance")
                _cache_set(f"hist:{sym}:{days}", {"symbol": sym, "source": "yfinance", "series": series}, 300)
                return {"symbol": sym, "source": "yfinance", "series": series}
        except Exception:
            # Fall through to other sources if yfinance fails.
            pass

    # 3) Alpha Vantage daily series for INR symbols
    if is_inr:
        if settings.ALPHAVANTAGE_API_KEY:
            try:
                candidates = _alpha_candidates(sym)
                series: list[dict] = []
                last_error: Exception | None = None
                for candidate in candidates:
                    try:
                        series = alpha.get_daily_series(candidate)
                        if series:
                            break
                    except Exception as exc:
                        last_error = exc
                        message = str(exc)
                        if "rate limit" in message.lower() or "Thank you for using Alpha Vantage" in message:
                            break
                if series:
                    if days and len(series) > days:
                        series = series[-days:]
                    _store_history(sym, series, "alpha_vantage")
                    return {"symbol": sym, "source": "alpha_vantage", "series": series}
                if last_error:
                    raise last_error
            except Exception as exc:
                if not allow_local:
                    raise HTTPException(
                        status_code=502, detail=f"Alpha Vantage error: {exc}"
                    ) from exc
        if not allow_local:
            raise HTTPException(
                status_code=502,
                detail="Alpha Vantage unavailable and local fallback disabled.",
            )
        currency = "INR"
        series = local_data.get_series(sym, currency, days)
        _store_history(sym, series, "local")
        return {"symbol": sym, "source": "local", "series": series}

    # 4) Finnhub candles
    now = datetime.now(timezone.utc)
    start = now - timedelta(days=days)
    from_unix = int(start.timestamp())
    to_unix = int(now.timestamp())

    if settings.FINNHUB_API_KEY:
        try:
            data = await service.get_candles(sym, resolution, from_unix, to_unix)
            if data.get("s") == "ok" and data.get("t") and data.get("c"):
                series = [{"t": int(t), "c": float(c)} for t, c in zip(data["t"], data["c"])]
                _store_history(sym, series, "finnhub")
                return {"symbol": sym, "source": "finnhub", "series": series}
        except Exception as exc:
            if not allow_local:
                raise HTTPException(
                    status_code=502, detail=f"Finnhub error: {exc}"
                ) from exc
    elif not allow_local:
        raise HTTPException(
            status_code=502,
            detail="FINNHUB_API_KEY is not set and local fallback disabled.",
        )

    # 5) Alpha Vantage fallback for non-INR symbols
    if settings.ALPHAVANTAGE_API_KEY:
        try:
            series = alpha.get_daily_series(sym)
            if series:
                if days and len(series) > days:
                    series = series[-days:]
                _store_history(sym, series, "alpha_vantage")
                return {"symbol": sym, "source": "alpha_vantage", "series": series}
        except Exception as exc:
            if not allow_local:
                raise HTTPException(
                    status_code=502, detail=f"Alpha Vantage error: {exc}"
                ) from exc
    elif not allow_local:
        raise HTTPException(
            status_code=502,
            detail="ALPHAVANTAGE_API_KEY is not set and local fallback disabled.",
        )

    if not allow_local:
        raise HTTPException(
            status_code=502,
            detail="Live data unavailable and local fallback disabled.",
        )
    currency = "INR" if is_inr else "USD"
    series = local_data.get_series(sym, currency, days)
    _store_history(sym, series, "local")
    return {"symbol": sym, "source": "local", "series": series}
