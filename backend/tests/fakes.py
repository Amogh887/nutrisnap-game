import json

from google.api_core.exceptions import AlreadyExists
from google.cloud.firestore_v1.transforms import Increment


class FakeSnapshot:
    def __init__(self, doc_id, data):
        self.id = doc_id
        self._data = data
        self.exists = data is not None

    def to_dict(self):
        if self._data is None:
            return None
        return dict(self._data)


def _match(data, field, op, value):
    actual = (data or {}).get(field)
    if op == "==":
        return actual == value
    raise NotImplementedError(op)


class FakeQuery:
    def __init__(self, db, path, filters):
        self.db = db
        self.path = path
        self.filters = filters

    def where(self, field, op, value):
        return FakeQuery(self.db, self.path, self.filters + [(field, op, value)])

    def stream(self):
        self.db._check_fail()
        depth = len(self.path) + 1
        results = []
        for path, data in list(self.db.store.items()):
            if len(path) == depth and path[:-1] == self.path:
                if all(_match(data, f, op, v) for f, op, v in self.filters):
                    results.append(FakeSnapshot(path[-1], data))
        return iter(results)


class FakeDocumentRef:
    def __init__(self, db, path):
        self.db = db
        self.path = path

    @property
    def id(self):
        return self.path[-1]

    def collection(self, name):
        return FakeCollectionRef(self.db, self.path + (name,))

    def get(self):
        self.db._check_fail()
        data = self.db.store.get(self.path)
        return FakeSnapshot(self.id, data)

    def set(self, data):
        self.db._check_fail()
        self.db.store[self.path] = dict(data)

    def create(self, data):
        self.db._check_fail()
        parent = self.path[:-1]
        spec = self.db.conflict_specs.get(parent)
        if spec and spec["times"] > 0:
            spec["times"] -= 1
            if spec["data"] is not None:
                self.db.store[self.path] = dict(spec["data"])
            raise AlreadyExists("forced conflict")
        if self.path in self.db.store:
            raise AlreadyExists("already exists")
        self.db.store[self.path] = dict(data)

    def update(self, data):
        self.db._check_fail()
        current = dict(self.db.store.get(self.path) or {})
        for key, value in data.items():
            if isinstance(value, Increment):
                current[key] = current.get(key, 0) + value.value
            else:
                current[key] = value
        self.db.store[self.path] = current

    def delete(self):
        self.db._check_fail()
        self.db.store.pop(self.path, None)


class FakeCollectionRef:
    def __init__(self, db, path):
        self.db = db
        self.path = path

    def document(self, doc_id=None):
        if doc_id is None:
            doc_id = self.db._next_id()
        return FakeDocumentRef(self.db, self.path + (doc_id,))

    def where(self, field, op, value):
        return FakeQuery(self.db, self.path, [(field, op, value)])

    def stream(self):
        self.db._check_fail()
        depth = len(self.path) + 1
        results = []
        for path, data in list(self.db.store.items()):
            if len(path) == depth and path[:-1] == self.path:
                results.append(FakeSnapshot(path[-1], data))
        return iter(results)


class FakeBatch:
    def __init__(self, db):
        self.db = db
        self.ops = []

    def set(self, ref, data):
        self.ops.append((ref, data))

    def commit(self):
        pending = self.ops
        self.ops = []
        for ref, data in pending:
            ref.set(data)


class FakeDb:
    def __init__(self):
        self.store = {}
        self.conflict_specs = {}
        self.fail_exception = None
        self._auto_id_counter = 0

    def _next_id(self):
        self._auto_id_counter += 1
        return f"autoid{self._auto_id_counter:06d}"

    def collection(self, name):
        return FakeCollectionRef(self, (name,))

    def batch(self):
        return FakeBatch(self)

    def force_conflict(self, collection_ref, times=1, data=None):
        self.conflict_specs[collection_ref.path] = {"times": times, "data": data}

    def fail_with(self, exception):
        self.fail_exception = exception

    def clear_fail(self):
        self.fail_exception = None

    def _check_fail(self):
        if self.fail_exception is not None:
            raise self.fail_exception


class _FakeGenaiResponse:
    def __init__(self, text):
        self.text = text


class FakeGenaiClient:
    def __init__(self, script=None):
        self._script = list(script) if script else []
        self.call_count = 0
        self.models = self

    def queue(self, item):
        self._script.append(item)

    def generate_content(self, model=None, contents=None, config=None):
        self.call_count += 1
        if not self._script:
            raise AssertionError("FakeGenaiClient script exhausted")
        item = self._script.pop(0)
        if isinstance(item, BaseException):
            raise item
        return _FakeGenaiResponse(json.dumps(item))


def make_verdict(
    is_dish_match=True,
    is_homemade=True,
    is_complete_dish=True,
    difficulty=5,
    stretch=5,
    confidence=0.9,
    reasons=None,
    feedback="Nice work",
):
    return {
        "is_dish_match": is_dish_match,
        "is_homemade": is_homemade,
        "is_complete_dish": is_complete_dish,
        "confidence": confidence,
        "reasons": reasons if reasons is not None else ["looks solid"],
        "difficulty": difficulty,
        "stretch": stretch,
        "feedback": feedback,
    }
