from agent.background_review import _automatic_review_input_budget


def test_larger_context_does_not_increase_default_unattended_budget():
    moderate = _automatic_review_input_budget({}, 300_000)
    enormous = _automatic_review_input_budget({}, 3_000_000)
    assert moderate == enormous
    assert moderate < 261_479  # observed seven-call review from the real Lab task


def test_smaller_budget_and_explicit_profile_preferences_are_preserved():
    assert _automatic_review_input_budget({}, 20_000) == 20_000
    assert _automatic_review_input_budget({"max_input_tokens": 45_000}, 45_000) == 45_000
    assert _automatic_review_input_budget({"max_input_tokens": 0}, None) is None
