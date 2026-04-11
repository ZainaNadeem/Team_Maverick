from dataclasses import dataclass, field
import uuid


@dataclass
class User:
    username: str
    email: str
    password: str
    id: str = field(default_factory=lambda: str(uuid.uuid4()))