"""One process-wide ICMP budget shared by scan, rack and topology requests."""
from threading import BoundedSemaphore

# Independent of individual request pools. JSON inventory supports one process.
PING_CONCURRENCY = 32
ping_slot = BoundedSemaphore(PING_CONCURRENCY)
