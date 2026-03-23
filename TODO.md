## Safe Git Commit Complete - Next Steps

### Completed ✅
- Updated .gitignore: `.pdf-venv/`, `output/`, `tmp/`, `package-lock.json`
- Staged/Committed/Pushed 7 safe files (repo rename, render/.npmrc/next.config fixes): commit 0446e7d
- Git clean on these changes.

**Current status** (from `git status`):
```
Changes not staged:
  backend/app/main.py, features.py, tests/*
  data/users.json
  frontend/app/{globals.css,layout.tsx,page.tsx}, eslint.config.mjs, package.json{,lock}

Untracked: backend/tests/test_auth.py
```

### Priority Steps
1. **Test Backend** (15min)
   ```
   cd backend
   pip install -r requirements.txt  # if needed
   uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
   ```
   - API docs: http://localhost:8001/api/docs
   - Test prediction: POST /api/v1/predictions {symbol: \"AAPL\"}
   - Tests: `pytest`

2. **Test Frontend** (5min, parallel Terminal 2)
   ```
   cd frontend && npm ci && NEXT_PUBLIC_API_BASE_URL=http://localhost:8001 npm run dev
   ```
   - http://localhost:3000 : Live prices/charts load?

3. **Verify ML** (if predictions fail)
   ```
   cd backend/app/ml && python train_lstm.py
   ```

4. **Full Stack** (recommended):
   ```
   make dev-parallel
   ```

5. **Review Diffs** (safety):
   ```
   git diff backend/app/ml/features.py | head -50
   git diff frontend/app/globals.css --stat  # +1297 Tailwind
   ```

6. **Stage/Commit Remaining** (after tests PASS):
   ```
   git add backend/ frontend/app/ frontend/eslint.config.mjs frontend/package.json data/users.json backend/tests/test_auth.py
   git commit -m "feat: LSTM 6-feature eng (RSI/MACD/BB/vol/EMA), Tailwind dashboard, auth tests"
   git push origin main
   ```

7. **Deploy Prod**
   - Render backend (add FINNHUB_API_KEY etc.)
   - Vercel frontend (set NEXT_PUBLIC_API_URL)

**Commands ready - say "test backend" or "make dev" to proceed!**

