"""How the streamer reads a refused command, and what the director does with it.

Run from `streamer/`:  python -m unittest discover -s tests

The tests drive `ReactorLink.send_command` and `Director._enqueue_scene`
against a fake session that raises the SDK's own `ReactorError`, so they need
`reactor-sdk` and nothing else: a streamer module whose third-party imports
(LiveKit, OpenAI, dotenv) are not installed is replaced by a stub.
"""

from __future__ import annotations

import asyncio
import importlib
import sys
import types
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))


def _stub_if_missing(name: str, **attributes: object) -> None:
    try:
        importlib.import_module(name)
    except ImportError:
        module = types.ModuleType(name)
        module.__dict__.update(attributes)
        sys.modules[name] = module


_stub_if_missing(
    "publisher", AudioFormat=object, LiveKitPublisher=object, VideoFormat=object
)
_stub_if_missing("pacer", Pacer=object)
_stub_if_missing("config", Config=object)
_stub_if_missing("upsampler", Episode=object, Upsampler=object, sanitize=str)

from reactor_sdk import ReactorError  # noqa: E402

import director  # noqa: E402
from reactor_link import (  # noqa: E402
    GENERIC_REFUSAL,
    CommandRefused,
    ReactorLink,
    _refusal,
)


def refused(command: str, code: str, reason: str) -> ReactorError:
    """The error the SDK raises for a command the model refused."""
    return ReactorError(
        f"command '{command}' failed ({code}): {reason}",
        code=code,
        operation="send_command",
    )


def queued(clip_id: str) -> dict:
    return {"type": "clip_queued", "data": {"clip": {"clip_id": clip_id, "seconds": 5.0}}}


class FakeSession:
    """Answers each command with the next scripted reply, or raises it."""

    def __init__(self, *outcomes: object) -> None:
        self.outcomes = list(outcomes)
        self.sent: list[tuple[str, dict]] = []

    async def send_command(self, command: str, data: dict) -> object:
        self.sent.append((command, dict(data)))
        outcome = self.outcomes.pop(0)
        if isinstance(outcome, Exception):
            raise outcome
        return outcome


def link_on(session: FakeSession) -> ReactorLink:
    link = ReactorLink.__new__(ReactorLink)
    link._ready = asyncio.Event()
    link._ready.set()
    link._reactor = session
    return link


class RefusalTest(unittest.TestCase):
    def test_a_refusal_carries_the_models_code_and_reason(self) -> None:
        refusal = _refusal("enqueue", refused("enqueue", "queue_full", "The queue is full: pop one."))
        self.assertIsInstance(refusal, CommandRefused)
        self.assertEqual(refusal.command, "enqueue")
        self.assertEqual(refusal.code, "queue_full")
        self.assertEqual(refusal.reason, "The queue is full: pop one.")

    def test_a_refusal_in_other_wording_keeps_its_code_and_the_generic_reason(self) -> None:
        error = ReactorError(
            "Command enqueue was rejected [empty_prompt]",
            code="empty_prompt",
            operation="send_command",
        )
        refusal = _refusal("enqueue", error)
        self.assertIsNotNone(refusal)
        self.assertEqual(refusal.code, "empty_prompt")
        self.assertEqual(refusal.reason, GENERIC_REFUSAL)

    def test_a_failure_with_an_sdk_code_is_not_a_refusal(self) -> None:
        error = ReactorError("not connected", code="INVALID_STATE", operation="send_command")
        self.assertIsNone(_refusal("enqueue", error))

    def test_a_failure_of_another_operation_is_not_a_refusal(self) -> None:
        error = refused("enqueue", "queue_full", "Full.")
        error.operation = "connect"
        self.assertIsNone(_refusal("enqueue", error))


class SendCommandTest(unittest.IsolatedAsyncioTestCase):
    async def test_a_refusal_raises_command_refused(self) -> None:
        link = link_on(FakeSession(refused("enqueue", "queue_full", "Full.")))
        with self.assertRaises(CommandRefused) as raised:
            await link.send_command("enqueue", {})
        self.assertEqual(raised.exception.code, "queue_full")

    async def test_a_bodyless_reply_to_a_reply_declaring_command_is_a_refusal(self) -> None:
        link = link_on(FakeSession(None))
        with self.assertRaises(CommandRefused) as raised:
            await link.send_command("pop", {"clip_id": "a"})
        self.assertEqual(raised.exception.reason, GENERIC_REFUSAL)

    async def test_a_bodyless_reply_to_a_command_with_no_reply_is_success(self) -> None:
        link = link_on(FakeSession(None))
        self.assertIsNone(await link.send_command("stop", {}, expects_reply=False))

    async def test_an_sdk_failure_returns_none_for_a_retry(self) -> None:
        error = ReactorError("transport dropped", code="TRANSPORT_ERROR", operation="send_command")
        link = link_on(FakeSession(error))
        self.assertIsNone(await link.send_command("enqueue", {}))

    async def test_a_reply_is_unwrapped_to_its_data(self) -> None:
        link = link_on(FakeSession(queued("abc")))
        reply = await link.send_command("enqueue", {})
        self.assertEqual(reply["clip"]["clip_id"], "abc")


class EnqueueSceneTest(unittest.IsolatedAsyncioTestCase):
    def setUp(self) -> None:
        self._delay = director._RETRY_DELAY_S
        director._RETRY_DELAY_S = 0

    def tearDown(self) -> None:
        director._RETRY_DELAY_S = self._delay

    async def enqueue(self, session: FakeSession, payload: dict) -> str | None:
        stage = director.Director.__new__(director.Director)
        stage._link = link_on(session)
        episode = types.SimpleNamespace(episode_id="e1", scenes=["a", "b"])
        return await stage._enqueue_scene(episode, 2, payload)

    async def test_a_lost_source_clip_retries_the_scene_standalone_at_once(self) -> None:
        session = FakeSession(refused("enqueue", "unknown_clip", "Gone."), queued("new"))
        clip_id = await self.enqueue(session, {"prompt": "b", "continue_from_clip_id": "old"})
        self.assertEqual(clip_id, "new")
        self.assertEqual([data for _, data in session.sent], [
            {"prompt": "b", "continue_from_clip_id": "old"},
            {"prompt": "b"},
        ])

    async def test_a_request_the_model_can_never_accept_is_not_retried(self) -> None:
        for code in ("empty_prompt", "prompt_too_long", "invalid_request", "invalid_image"):
            with self.subTest(code=code):
                session = FakeSession(refused("enqueue", code, "No."))
                self.assertIsNone(await self.enqueue(session, {"prompt": ""}))
                self.assertEqual(len(session.sent), 1)

    async def test_a_reworded_final_refusal_is_not_retried_either(self) -> None:
        error = ReactorError("rejected", code="empty_prompt", operation="send_command")
        session = FakeSession(error)
        self.assertIsNone(await self.enqueue(session, {"prompt": ""}))
        self.assertEqual(len(session.sent), 1)

    async def test_a_full_queue_is_retried_three_times(self) -> None:
        session = FakeSession(*[refused("enqueue", "queue_full", "Full.")] * 3)
        self.assertIsNone(await self.enqueue(session, {"prompt": "x"}))
        self.assertEqual(len(session.sent), 3)


if __name__ == "__main__":
    unittest.main()
