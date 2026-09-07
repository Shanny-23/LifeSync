from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from services.auth_service import verify_token, get_current_user, DEMO_USERS, DEFAULT_USER

router = APIRouter(prefix="/api/auth", tags=["auth"])

class TokenVerifyRequest(BaseModel):
    token: str

class DemoLoginRequest(BaseModel):
    user_id: str

@router.get("/me")
async def get_me(current_user: Dict[str, Any] = Depends(get_current_user)):
    """Retrieve the current authenticated user session."""
    return {"user": current_user}

@router.post("/verify")
async def verify_auth_token(payload: TokenVerifyRequest):
    """Verify an incoming Firebase or Demo token."""
    user = verify_token(payload.token)
    return {"status": "success", "user": user}

@router.get("/demo-users")
async def list_demo_users():
    """List available demo personas for fast switching in UI."""
    return {"users": list(DEMO_USERS.values())}

@router.post("/demo-login")
async def demo_login(payload: DemoLoginRequest):
    """Generate a valid demo session token for the selected persona."""
    user = DEMO_USERS.get(payload.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Demo persona not found")
    
    token = f"demo-token-{payload.user_id}"
    return {
        "status": "success",
        "token": token,
        "user": user
    }
