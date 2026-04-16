# How to Start the Application

## Quick Start (Both Services)

### Option 1: Using Terminal Tabs

**Tab 1 - Start Backend:**
```bash
cd /Users/sharanpatil/Downloads/stock\ price\ prediction/backend
bash start.sh
```

**Tab 2 - Start Frontend:**
```bash
cd /Users/sharanpatil/Downloads/stock\ price\ prediction/frontend
npm run dev
```

### Option 2: Using One Command (Background)

```bash
cd /Users/sharanpatil/Downloads/stock\ price\ prediction
bash start-all.sh
```

---

## Verification Steps

### 1. Check Backend is Running
Open browser or use curl:
```bash
curl http://localhost:8001/api/v1/auth/login \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test123"}'
```

Expected response:
```json
{"detail":"User not found. Please register."}
```

### 2. Check Frontend is Running
Open browser:
- http://localhost:3000

### 3. Check CORS is Working
```bash
curl -I http://localhost:8001/api/v1/auth/login \
  -X POST \
  -H "Origin: http://localhost:3000"
```

Look for header:
```
access-control-allow-origin: http://localhost:3000
```

---

## Troubleshooting

### "Could not reach the backend" Error

**Check 1: Is backend running?**
```bash
lsof -i :8001
```
Should show Python/uvicorn process.

**Check 2: Try direct backend URL:**
```bash
curl http://localhost:8001/api/v1/auth/register \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test123"}'
```

**Check 3: Restart both services:**
```bash
# Kill existing processes
pkill -f "next dev"
pkill -f uvicorn

# Restart
bash start-all.sh
```

**Check 4: Environment variables**
Ensure `frontend/.env.local` contains:
```
NEXT_PUBLIC_API_BASE_URL=http://localhost:8001
NEXT_PUBLIC_API_URL=http://localhost:8001
NEXT_PUBLIC_WS_URL=ws://localhost:8001
```

### Firebase Authentication Errors

**If you see "auth/invalid-credential":**
1. Go to https://console.firebase.google.com/project/stockprediction-5fc07/authentication/providers
2. Enable "Email/Password" provider
3. Enable "Google" provider
4. Wait 30 seconds and retry

**If you see "auth/api-key-not-valid":**
1. Go to https://console.cloud.google.com/apis/credentials?project=stockprediction-5fc07
2. Edit the API key `AIzaSyC5jqLYDiqGfalRGonqHDWbBu67o7ctOso`
3. Under "Application restrictions", select "None" (for development)
4. Click Save
5. Wait 1-2 minutes and retry

---

## Project Structure

```
stock price prediction/
├── backend/                 # FastAPI (Port 8001)
│   ├── app/
│   │   ├── main.py         # Entry point
│   │   └── api/v1/
│   │       └── routes_auth.py  # Firebase auth routes
│   ├── start.sh            # Backend startup script
│   └── requirements.txt
├── frontend/                # Next.js (Port 3000)
│   ├── app/
│   │   └── auth/login/page.tsx  # Login page
│   ├── lib/
│   │   ├── firebase.ts     # Firebase config
│   │   └── api-base.ts       # API client
│   ├── .env.local          # API URLs & Firebase config
│   └── start.sh            # Frontend startup script
└── .env                    # Backend env variables
```

---

## URLs After Starting

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8001
- **API Docs**: http://localhost:8001/api/docs
- **Login Page**: http://localhost:3000/auth/login
- **Register Page**: http://localhost:3000/auth/register
