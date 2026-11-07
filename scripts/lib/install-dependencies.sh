#!/usr/bin/env bash
# Python dependency provisioning, loaded after source installation.
run_locked_uv_sync() {
    # Bootstrap uv calls stay isolated from ambient config via UV_NO_CONFIG
    # (#21269). A locked project sync is different: uv.lock records resolver
    # settings from this checkout's [tool.uv], so hiding pyproject.toml makes
    # uv 0.12+ reject the valid lock. Re-enable project discovery only for
    # this subprocess while redirecting user/system config lookups to an empty
    # directory. Keep HOME unchanged so caches, credentials, and git continue
    # to work normally.
    local project_env="$1"
    local isolated_uv_config
    local sync_rc
    isolated_uv_config="$(mktemp -d)" || return 1

    (
        unset UV_NO_CONFIG UV_CONFIG_FILE
        export XDG_CONFIG_HOME="$isolated_uv_config"
        export XDG_CONFIG_DIRS="$isolated_uv_config"
        UV_PROJECT_ENVIRONMENT="$project_env" $UV_CMD sync --extra all --locked
    )
    sync_rc=$?
    rmdir "$isolated_uv_config" 2>/dev/null || true
    return "$sync_rc"
}

hebri_install_deps() {
    log_info "Installing dependencies..."

    # Re-pin UV_PYTHON to the venv interpreter. setup_venv already does this,
    # but the bootstrap runs install stages (`venv`, `python-deps`) as separate
    # processes, so an export from setup_venv does NOT survive into a separate
    # python-deps invocation. Re-deriving it here covers that path. Without it,
    # an inherited UV_PYTHON=3.14 makes the uv sync/pip tiers below recreate the
    # venv at 3.14 and fail the maturin source build (no cp314 wheels yet).
    if [ "$DISTRO" != "termux" ] && [ -x "$INSTALL_DIR/venv/bin/python" ]; then
        export UV_PYTHON="$INSTALL_DIR/venv/bin/python"
    fi

    if [ "$DISTRO" = "termux" ]; then
        if [ "$USE_VENV" = true ]; then
            export VIRTUAL_ENV="$INSTALL_DIR/venv"
            PIP_PYTHON="$INSTALL_DIR/venv/bin/python"
        else
            PIP_PYTHON="$PYTHON_PATH"
        fi

        if [ -z "${ANDROID_API_LEVEL:-}" ]; then
            ANDROID_API_LEVEL="$(getprop ro.build.version.sdk 2>/dev/null || true)"
            if [ -z "$ANDROID_API_LEVEL" ]; then
                ANDROID_API_LEVEL=24
            fi
            export ANDROID_API_LEVEL
            log_info "Using ANDROID_API_LEVEL=$ANDROID_API_LEVEL for Android wheel builds"
        fi

        "$PIP_PYTHON" -m pip install --upgrade pip setuptools wheel >/dev/null

        # On Android, psutil's setup.py rejects sys.platform == 'android' before
        # it ever invokes the C build, so the next pip install would fail at
        # "platform android is not supported".  Prebuild psutil from the official
        # sdist with a one-line marker patch (Linux source path is fine on
        # Android).  Stopgap until psutil#2762 ships upstream.
        if "$PIP_PYTHON" -c 'import sys; raise SystemExit(0 if sys.platform == "android" else 1)' 2>/dev/null; then
            log_info "Android Python detected: prebuilding psutil compatibility shim..."
            if ! "$PIP_PYTHON" "$INSTALL_DIR/scripts/install_psutil_android.py" --pip "$PIP_PYTHON -m pip"; then
                log_warn "psutil Android prebuild failed — package install will likely fail next."
                log_info "Workaround: manually rerun 'python scripts/install_psutil_android.py' once your toolchain is set up."
            fi
        fi

        # Try the broad Termux profile first (best-effort "install all" for Android),
        # then fall back to the conservative Termux baseline, then base package.
        if ! "$PIP_PYTHON" -m pip install -e '.[termux-all]' -c constraints-termux.txt; then
            log_warn "Termux broad profile (.[termux-all]) failed, trying baseline Termux profile..."
            if ! "$PIP_PYTHON" -m pip install -e '.[termux]' -c constraints-termux.txt; then
                log_warn "Termux baseline profile (.[termux]) failed, trying base install..."
                if ! "$PIP_PYTHON" -m pip install -e '.' -c constraints-termux.txt; then
                    log_error "Package installation failed on Termux."
                    log_info "Ensure these packages are installed: pkg install clang rust make pkg-config libffi openssl ca-certificates curl"
                    log_info "Then re-run: cd $INSTALL_DIR && python -m pip install -e '.[termux-all]' -c constraints-termux.txt"
                    exit 1
                fi
            fi
        fi

        log_success "Main package installed"
        log_info "Termux note: matrix e2ee and local faster-whisper extras are excluded from .[termux-all] due to upstream Android wheel/toolchain blockers."
        log_info "Termux note: browser/WhatsApp tooling is not installed by default; see the Termux guide for optional follow-up steps."

        log_success "All dependencies installed"
        return 0
    fi

    if [ "$USE_VENV" = true ]; then
        # Tell uv to install into our venv (no need to activate)
        export VIRTUAL_ENV="$INSTALL_DIR/venv"
    fi

    # On Debian/Ubuntu (including WSL), some Python packages need build tools.
    # Check and offer to install them if missing.
    if [ "$DISTRO" = "ubuntu" ] || [ "$DISTRO" = "debian" ]; then
        local need_build_tools=false
        for pkg in gcc python3-dev libffi-dev; do
            if ! dpkg -s "$pkg" &>/dev/null; then
                need_build_tools=true
                break
            fi
        done
        if [ "$need_build_tools" = true ]; then
            log_info "Some build tools may be needed for Python packages..."
            if command -v sudo &> /dev/null; then
                if sudo -n true 2>/dev/null; then
                    sudo DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=a apt-get update -qq && sudo DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=a apt-get install -y -qq build-essential python3-dev libffi-dev >/dev/null 2>&1 || true
                    log_success "Build tools installed"
                else
                    log_info "sudo is needed ONLY to install build tools (build-essential, python3-dev, libffi-dev) via apt."
                    log_info "Hebri itself does not require or retain root access."
                    if prompt_yes_no "Install build tools?" "yes"; then
                        sudo DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=a apt-get update -qq && sudo DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=a apt-get install -y -qq build-essential python3-dev libffi-dev >/dev/null 2>&1 || true
                        log_success "Build tools installed"
                    fi
                fi
            fi
        fi
    fi

    # Install the main package in editable mode with all extras.
    #
    # Hash-verified install (Tier 0) — when uv.lock is present, prefer
    # `uv sync --locked`. The lockfile records SHA256 hashes for every
    # transitive, so a compromised transitive (different hash than what
    # we shipped) is REJECTED by the resolver. This is the *only* path
    # that protects against the "direct dep is fine, but the dep's dep
    # got worm-poisoned overnight" failure mode. All `uv pip install`
    # tiers below re-resolve transitives fresh from PyPI without any
    # hash verification — they exist to keep installs working when the
    # lockfile is stale, missing, or out-of-sync with the current
    # extras spec, NOT because they're equivalent in posture.
    if [ -f "uv.lock" ]; then
        log_info "Trying tier: hash-verified (uv.lock) ..."
        log_info "(this resolves + downloads the curated [all] set — first run on a"
        log_info " fresh venv can take 1-5 minutes; uv prints progress below)"
        # Stream uv's progress directly to the user instead of swallowing
        # it with `2>"$(mktemp)"`.  Two reasons:
        #   1. `--extra all --locked` against a fresh venv has to pull
        #      every transitive — silencing stderr makes the install
        #      look frozen for minutes on slow networks. Users see
        #      "Trying tier: hash-verified ..." and assume it's hung.
        #   2. The previous `2>"$(mktemp)"` substituted the path at
        #      command-build time but never saved it, so on failure the
        #      uv error message was unreachable — the user just got the
        #      generic "lockfile may be stale" warning.
        #
        # Critical flag choice: `--extra all`, NOT `--all-extras`.
        #   --all-extras = every [project.optional-dependencies] key.
        #                  This bypasses the curated `[all]` extra
        #                  entirely and pulls e.g. [matrix] (which
        #                  needs python-olm + make on Windows) and
        #                  [rl] (git+https deps that fail offline).
        #   --extra all  = install just the `[all]` extra's contents.
        #                  This respects the curation in pyproject.toml.
        # uv's own progress UI handles TTY detection and downgrades
        # gracefully when stdout/stderr aren't terminals.
        #
        # Run the Tier-0 locked sync via run_locked_uv_sync: the global
        # UV_NO_CONFIG export at script start (the #21269 sudo -u hygiene
        # guard) also hides the project's own [tool.uv] policy —
        # exclude-newer, its package exemptions, and override-dependencies —
        # from uv. The resolver then runs under a different policy than the
        # one uv.lock was resolved under, and --locked turns that mismatch
        # fatal, so every fresh install fell through to the non-hash-verified
        # PyPI tiers. The helper re-enables project config discovery for this
        # one subprocess while keeping ambient user/system uv config hidden
        # (redirected to an empty XDG dir), preserving the #21269 guarantee.
        # Runtime code does the same before its locked syncs
        # (hermes_cli/managed_uv.py).
        if run_locked_uv_sync "$INSTALL_DIR/venv"; then
            log_success "Main package installed (hash-verified via uv.lock)"
            log_success "All dependencies installed"
            return 0
        fi
        log_warn "uv.lock sync failed (see uv output above), falling back to PyPI resolve..."
    else
        log_info "uv.lock not found — falling back to PyPI resolve (no hash verification)"
    fi

    # Multi-tier fallback. The point of the tiers is that ONE compromised
    # PyPI package (a worm-poisoned release that gets quarantined, like
    # mistralai 2.4.6 in May 2026) shouldn't be able to silently demote a
    # fresh install all the way down to "core only" — the user should keep
    # everything else they signed up for.
    #
    # Tier 1: [all] — the curated extra in pyproject.toml.
    # Tier 2: [all] minus the currently-broken extras list (_BROKEN_EXTRAS).
    #         Edit _BROKEN_EXTRAS below when something on PyPI breaks; this
    #         lets users keep the rest of [all] when one transitive is
    #         unavailable. The list of [all]'s contents is parsed from
    #         pyproject.toml at runtime — there is NO hand-mirrored copy
    #         to drift out of sync. If you want to change what [all]
    #         contains, edit pyproject.toml only.
    # Tier 3: bare `.` — last-resort so at least the core CLI launches.
    #         Skipped tiers like "PyPI-only extras (no git deps)" used to
    #         exist to dodge [rl] / [matrix] git+sdist deps; those are no
    #         longer in [all] post-2026-05-12 lazy-install migration, so
    #         a separate PyPI-only tier had no remaining content.
    local _BROKEN_EXTRAS=()  # populate when an extra becomes unresolvable

    # Parse [project.optional-dependencies].all from pyproject.toml.
    # tomllib is stdlib on Python 3.11+ which uv's bootstrap guarantees.
    # Falls back to a hand list if parse fails — defensive only.
    local _ALL_EXTRAS_CSV
    _ALL_EXTRAS_CSV="$(
        "$PYTHON_PATH" - <<'PY' 2>/dev/null
import re, sys, tomllib
try:
    with open("pyproject.toml", "rb") as fh:
        data = tomllib.load(fh)
    specs = data["project"]["optional-dependencies"]["all"]
    extras = []
    for s in specs:
        m = re.search(r"hermes-agent\[([\w-]+)\]", s)
        if m:
            extras.append(m.group(1))
    print(",".join(extras))
except Exception as e:
    print("", file=sys.stderr)
    sys.exit(1)
PY
    )"
    if [ -z "$_ALL_EXTRAS_CSV" ]; then
        log_warn "Could not parse [all] from pyproject.toml; falling back to .[all] only."
        _ALL_EXTRAS_CSV=""
    fi

    # Build "[all] minus broken" spec by filtering the parsed list.
    local _SAFE_SPEC=".[all]"
    if [ -n "$_ALL_EXTRAS_CSV" ] && [ "${#_BROKEN_EXTRAS[@]}" -gt 0 ]; then
        local _SAFE_EXTRAS=()
        local _e _b _skip
        IFS=',' read -ra _ALL_EXTRAS_ARR <<< "$_ALL_EXTRAS_CSV"
        for _e in "${_ALL_EXTRAS_ARR[@]}"; do
            _skip=false
            for _b in "${_BROKEN_EXTRAS[@]}"; do
                if [ "$_e" = "$_b" ]; then _skip=true; break; fi
            done
            if [ "$_skip" = false ]; then _SAFE_EXTRAS+=("$_e"); fi
        done
        _SAFE_SPEC=".[$(IFS=,; echo "${_SAFE_EXTRAS[*]}")]"
    fi

    ALL_INSTALL_LOG=$(mktemp)
    local _installed=false
    local _tier_name=""

    install_tier() {
        local name="$1"; local spec="$2"
        log_info "Trying tier: $name ..."
        if $UV_CMD pip install -e "$spec" 2>"$ALL_INSTALL_LOG"; then
            log_success "Main package installed ($name)"
            _installed=true
            _tier_name="$name"
            return 0
        fi
        log_warn "Tier '$name' failed. Top of pip output:"
        head -5 "$ALL_INSTALL_LOG" | sed 's/^/    /' >&2
        return 1
    }

    install_tier "all" ".[all]" \
        || install_tier "all minus known-broken (${_BROKEN_EXTRAS[*]:-none})" "$_SAFE_SPEC" \
        || install_tier "core only (no extras)" "."

    rm -f "$ALL_INSTALL_LOG"

    if [ "$_installed" = false ]; then
        log_error "Package installation failed even with no extras."
        log_info "Check that build tools are installed: sudo apt install build-essential python3-dev"
        log_info "Then re-run: cd $INSTALL_DIR && uv pip install -e '.[all]'"
        exit 1
    fi

    if [ "$_tier_name" != "all" ]; then
        log_warn "Note: installed via fallback tier ($_tier_name)."
        log_info "Some optional features may be missing. After resolving any"
        log_info "PyPI/network issue, re-run: $UV_CMD pip install -e '.[all]'"
    fi

    log_success "Main package installed"

    log_success "All dependencies installed"
}

