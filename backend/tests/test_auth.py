from __future__ import annotations

from pathlib import Path

from app.api.v1 import routes_auth


def test_auth_register_login_roundtrip(client, monkeypatch, tmp_path: Path):
    users_path = tmp_path / "users.json"
    monkeypatch.setattr(routes_auth, "_USERS_PATH", users_path)

    email = "login.roundtrip@example.com"
    password = "secret123"

    register_res = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": password},
    )
    assert register_res.status_code == 200
    assert register_res.json()["user"]["email"] == email

    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )
    assert login_res.status_code == 200
    data = login_res.json()
    assert data["user"]["email"] == email
    assert data["access_token"]


def test_auth_login_preflight_allows_local_dev_origin(client):
    response = client.options(
        "/api/v1/auth/login",
        headers={
            "Origin": "http://127.0.0.1:3000",
            "Access-Control-Request-Method": "POST",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://127.0.0.1:3000"
