from types import SimpleNamespace

from tools import browser_tool_install as install


def test_browser_probe_recovers_after_external_install(tmp_path, monkeypatch):
    state = SimpleNamespace(_cached_chromium_installed=None)
    monkeypatch.setattr(install, "_origin", lambda: state)
    monkeypatch.setattr(install, "_chromium_search_roots", lambda: [str(tmp_path)])
    monkeypatch.setattr(install.shutil, "which", lambda name: None)
    monkeypatch.delenv("AGENT_BROWSER_EXECUTABLE_PATH", raising=False)

    assert not install._chromium_installed()
    # The setup screen or terminal can install Chromium while the gateway stays open.
    (tmp_path / "chromium-qa").mkdir()
    assert install._chromium_installed()


def test_browser_retry_after_failed_auto_install_sees_new_install(tmp_path, monkeypatch):
    state = SimpleNamespace(
        _cached_chromium_installed=False, _chromium_autoinstall_attempted=True
    )
    monkeypatch.setattr(install, "_origin", lambda: state)
    monkeypatch.setattr(install, "_chromium_search_roots", lambda: [str(tmp_path)])
    monkeypatch.setattr(install.shutil, "which", lambda name: None)
    monkeypatch.delenv("AGENT_BROWSER_EXECUTABLE_PATH", raising=False)

    assert not install._maybe_autoinstall_chromium()
    (tmp_path / "chromium_headless_shell-qa").mkdir()
    assert install._maybe_autoinstall_chromium()
