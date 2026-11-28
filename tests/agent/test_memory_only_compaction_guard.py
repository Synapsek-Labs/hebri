"""In-memory sessions must not grow when the final compaction anchors are added."""
import copy
import time
from types import SimpleNamespace

from agent.conversation_compression import _Attempt, _commit_compaction
from agent.model_metadata import estimate_messages_tokens_rough


def commit(original, candidate):
    warnings = []
    rejected = []
    agent = SimpleNamespace(
        _session_db=None, session_id='isolated-test', _cached_system_prompt='stable prompt',
        context_compressor=SimpleNamespace(record_rejected_compaction=lambda: rejected.append(True)),
        _emit_warning=warnings.append,
    )
    outcome = _commit_compaction(
        agent, original, candidate, in_place=False, lease=None,
        new_system_prompt='stable prompt', system_message=None, compressed_user_turn_outcome='',
        messages_before_compression=copy.deepcopy(original), made_progress=True,
        attempt=_Attempt({}, 1, time.monotonic()),
    )
    return outcome, warnings, rejected


def test_memory_only_compaction_refuses_growing_candidate():
    original = [{'role': 'user', 'content': 'Keep the code MAPLE-482.'},
                {'role': 'assistant', 'content': 'Saved for this chat.'}]
    snapshot = copy.deepcopy(original)
    candidate = [{'role': 'user', 'content': 'Keep the code MAPLE-482.'},
                 {'role': 'assistant', 'content': 'Unhelpful expanded summary. ' * 500}]
    result, warnings, rejected = commit(original, candidate)
    assert result.compressed == snapshot == original
    assert result.refused_prompt == 'stable prompt'
    assert warnings and rejected


def test_memory_only_compaction_accepts_shrinking_candidate():
    original = [{'role': 'user', 'content': 'Observation. ' * 500},
                {'role': 'assistant', 'content': 'All observations nominal.'}]
    candidate = [{'role': 'user', 'content': 'Observations nominal.', '_compaction_tail': True}]
    result, warnings, rejected = commit(original, candidate)
    assert estimate_messages_tokens_rough(result.compressed) < estimate_messages_tokens_rough(original)
    assert result.refused_prompt is None and not warnings and not rejected
    assert '_compaction_tail' not in result.compressed[0]
