"""A deliberate Stop is not a rejected request; side effects still need care."""
import pytest
from agent.turn_failure_copy import (
    failed_turn_notice, untyped_failed_turn_display_kind, FAILED_TURN_DISPLAY_KIND,
    FAILED_TURN_NOTICE, PARTIAL_FAILED_TURN_NOTICE, STOPPED_TURN_NOTICE, PARTIAL_STOPPED_TURN_NOTICE,
)

@pytest.mark.parametrize('messages', [[], [{'role': 'assistant', 'content': 'partial'}]])
def test_stopped_generation_is_not_reported_as_unprocessed(messages):
    assert failed_turn_notice(messages, interrupted=True) == STOPPED_TURN_NOTICE
    assert failed_turn_notice(messages) == FAILED_TURN_NOTICE

@pytest.mark.parametrize('messages', [
    [{'role': 'tool', 'content': 'saved'}],
    [{'role': 'assistant', 'tool_calls': [{'id': 't1'}]}],
])
def test_stop_preserves_side_effect_warning(messages):
    assert failed_turn_notice(messages, interrupted=True) == PARTIAL_STOPPED_TURN_NOTICE
    assert failed_turn_notice(messages) == PARTIAL_FAILED_TURN_NOTICE

def test_stopped_notice_is_display_only():
    assert untyped_failed_turn_display_kind('assistant', STOPPED_TURN_NOTICE) == FAILED_TURN_DISPLAY_KIND
    assert untyped_failed_turn_display_kind('assistant', PARTIAL_STOPPED_TURN_NOTICE) == FAILED_TURN_DISPLAY_KIND
    assert untyped_failed_turn_display_kind('user', STOPPED_TURN_NOTICE) is None

def test_gateway_uses_same_stop_contract():
    from gateway.run_turn import GatewayTurnMixin
    result={'interrupted':True,'messages':[{'role':'user','content':'test'}],'history_offset':0}
    assert GatewayTurnMixin._hmwa_failed_turn_notice(None,result) == STOPPED_TURN_NOTICE
    result['messages'].append({'role':'tool','content':'saved'})
    assert GatewayTurnMixin._hmwa_failed_turn_notice(None,result) == PARTIAL_STOPPED_TURN_NOTICE
