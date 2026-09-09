"""Public resource shapes. Results remain dictionaries with their wire field names."""

from typing import NotRequired, TypedDict


class MemorySummary(TypedDict):
    """A stored memory, with an optional relevance score from recall."""

    id: str
    kind: str
    scope: str
    content: str
    sourceThreadIds: list[str]
    invalidatedAt: str | None
    score: NotRequired[float]


class ListMemoriesResponse(TypedDict):
    """Memories visible to the application user under the supplied grant."""

    memories: list[MemorySummary]


class RecallMemoriesResponse(TypedDict):
    """Memories that match a recall query, with their relevance scores."""

    memories: list[MemorySummary]


class SaveMemoryResponse(MemorySummary):
    """The saved memory and optional merge or replacement markers."""

    absorbed: NotRequired[bool]
    retiredId: NotRequired[str]
