"""Audit Trail – kto, kiedy i na podstawie jakiego wyniku AI podjął decyzję (+ weryfikacja łańcucha hashy)."""

from typing import Annotated, Any

from fastapi import APIRouter, Query
from pydantic import BaseModel

from app.api.deps import DbDep
from app.security import OfficialUser
from app.store import audit

router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("")
def list_audit(user: OfficialUser, db: DbDep,
               draftId: Annotated[str | None, Query(max_length=64)] = None) -> list[dict[str, Any]]:  # noqa: N803
    return audit.list_entries(db, draftId)


class ChainStatus(BaseModel):
    intact: bool
    brokenAtSeq: int | None = None


@router.get("/verify")
def verify(user: OfficialUser, db: DbDep) -> ChainStatus:
    ok, seq = audit.verify_chain(db)
    return ChainStatus(intact=ok, brokenAtSeq=seq)
