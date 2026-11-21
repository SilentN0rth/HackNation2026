from typing import Annotated

from fastapi import Depends

from app.store.db import Store, get_store

StoreDep = Annotated[Store, Depends(get_store)]
