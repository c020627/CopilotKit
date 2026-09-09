"""Use CopilotKit Intelligence without an agent or HTTP server."""

from .client import Intelligence, IntelligenceError, MemoryGrant, RuntimeEntitlementError
from .entitlements import RuntimeEntitlementResponse
from .inspector import InspectorMetadata
from .resources import (
    ListMemoriesResponse,
    MemorySummary,
    RecallMemoriesResponse,
    SaveMemoryResponse,
)

__all__ = [
    "Intelligence",
    "IntelligenceError",
    "MemoryGrant",
    "InspectorMetadata",
    "RuntimeEntitlementResponse",
    "RuntimeEntitlementError",
    "MemorySummary",
    "ListMemoriesResponse",
    "RecallMemoriesResponse",
    "SaveMemoryResponse",
]
