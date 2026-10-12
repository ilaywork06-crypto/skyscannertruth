"""
The rule about how a partial update takes a value away again, as opposed to leaving it alone.

:date: 2026-09-23
:author: t_beatrice
"""
# ----- IMPORTS ----- #

from typing import Any

from pydantic import BaseModel

# ----- FUNCTIONS ----- #


def explicit_clears(request: BaseModel, clearable: tuple[str, ...]) -> dict[str, Any]:
    """
    Read which optional attributes a partial update asked to clear.

    An attribute left out of the request keeps its stored value, and one sent as null is taken away. The two
    look the same once the request is dumped without its nulls, which is how clearing a result, a date or a
    module in the editor used to be dropped on the way in and the stored value kept.

    :param request: The partial update as the caller sent it.
    :param clearable: Attributes that may be taken away at all.
    :return: The attributes the caller sent as null, each mapped to nothing.
    """
    return {key: None for key in clearable if key in request.model_fields_set and getattr(request, key) is None}
