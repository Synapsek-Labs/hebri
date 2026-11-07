# Python dependency provisioning, loaded after the source checkout is available.
function Invoke-HebriDependencyInstall {
    Write-Info "Installing dependencies..."
    
    Push-Location $InstallDir
    
    if (-not $NoVenv) {
        # Tell uv to install into our venv (no activation needed)
        $env:VIRTUAL_ENV = "$InstallDir\venv"
    }

    # Re-pin UV_PYTHON to the venv interpreter. Install-Venv already does this,
    # but the bootstrap runs install stages (venv, python-deps) as separate
    # processes, so the env var set in Install-Venv does NOT survive into a
    # separate python-deps invocation. Re-deriving it here covers that path.
    # Without it, an inherited $env:UV_PYTHON = "3.14" makes the uv sync/pip
    # tiers below recreate the venv at 3.14 and fail the maturin source build
    # (no cp314 wheels yet).
    if (-not $NoVenv) {
        $venvPythonExe = Join-Path $InstallDir "venv\Scripts\python.exe"
        if (Test-Path $venvPythonExe) {
            $env:UV_PYTHON = $venvPythonExe
        }
    }

    # Hash-verified install (Tier 0) -- when uv.lock is present, prefer
    # `uv sync --locked`. The lockfile records SHA256 hashes for every
    # transitive dependency, so a compromised transitive (different hash
    # than what we shipped) is REJECTED by the resolver. This is the
    # *only* path that protects against the "direct dep is fine, but the
    # dep's dep got worm-poisoned overnight" failure mode. The
    # `uv pip install` tiers below re-resolve transitives fresh from PyPI
    # without any hash verification -- they exist to keep installs working
    # when the lockfile is stale, missing, or out-of-sync with the
    # current extras spec, NOT because they're equivalent in posture.
    #
    # Everything through the baseline-import gate runs inside the venv
    # transaction opened by Install-Venv (#83149): on any failure the parked
    # previous venv is restored before the error propagates, and the parked
    # tree is deleted only after the imports prove the replacement usable.
    try {
    if (Test-Path "uv.lock") {
        Write-Info "Trying tier: hash-verified (uv.lock) ..."
        # Critical flag choice: `--extra all`, NOT `--all-extras`.
        #   --all-extras = every [project.optional-dependencies] key,
        #                  bypassing the curated [all] extra. On Windows
        #                  that means [matrix] -> python-olm (no wheel,
        #                  needs `make` to build from sdist) and the
        #                  install fails.
        #   --extra all  = just the [all] extra's contents (curated).
        #
        # UV_PROJECT_ENVIRONMENT pins the sync target to our venv\.
        # Without it, modern uv (>=0.5) ignores VIRTUAL_ENV for `sync`
        # and creates a sibling .venv\ inside the repo -- leaving venv\
        # empty and producing the broken state where `hermes.exe` exists
        # in the wrong directory and imports fail with ModuleNotFoundError.
        # (Mirrors the same flag in scripts/install.sh::install_deps.)
        $env:UV_PROJECT_ENVIRONMENT = "$InstallDir\venv"
        Invoke-NativeWithRelaxedErrorAction { & $UvCmd sync --extra all --locked }
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Main package installed (hash-verified via uv.lock)"
            $script:InstalledTier = "hash-verified (uv.lock)"
            # Skip the rest of the tiered cascade -- we already have a
            # complete, hash-verified install.
            $skipPipFallback = $true
        } else {
            Write-Warn "uv.lock sync failed (lockfile may be stale), falling back to PyPI resolve..."
            $skipPipFallback = $false
        }
    } else {
        Write-Info "uv.lock not found -- falling back to PyPI resolve (no hash verification)"
        $skipPipFallback = $false
    }

    # Install main package.  Tiered fallback so a single flaky transitive
    # doesn't silently drop everything.  Each tier's stdout/stderr is
    # preserved -- no Out-Null swallowing -- so the user can see what failed.
    #
    # Tier 1: [all] -- the curated extra in pyproject.toml.
    # Tier 2: [all] minus the currently-broken extras list ($brokenExtras).
    #         Edit $brokenExtras below when something on PyPI breaks; this
    #         lets users keep the rest of [all] when one transitive is
    #         unavailable. The list of [all]'s contents is parsed from
    #         pyproject.toml at runtime -- there is NO hand-mirrored copy
    #         to drift out of sync.
    # Tier 3: bare `.` -- last-resort so at least the core CLI launches.

    # Currently-broken extras. Edit this list when an upstream package
    # gets quarantined / yanked / breaks resolution. Empty means everything
    # in [all] should be installable; populate with the names of extras
    # whose deps are temporarily unavailable.
    $brokenExtras = @()

    # Parse [project.optional-dependencies].all from pyproject.toml.
    # tomllib is stdlib on Python 3.11+ which the bootstrap guarantees.
    $pythonExeForParse = if (-not $NoVenv) { "$InstallDir\venv\Scripts\python.exe" } else { (& $UvCmd python find $PythonVersion) }
    $allExtras = @()
    if (Test-Path $pythonExeForParse) {
        $parsed = & $pythonExeForParse -c @"
import re, sys, tomllib
try:
    with open('pyproject.toml', 'rb') as fh:
        data = tomllib.load(fh)
    specs = data['project']['optional-dependencies']['all']
    out = []
    for s in specs:
        m = re.search(r'hermes-agent\[([\w-]+)\]', s)
        if m: out.append(m.group(1))
    print(','.join(out))
except Exception:
    sys.exit(1)
"@ 2>$null
        if ($LASTEXITCODE -eq 0 -and $parsed) {
            $allExtras = $parsed.Trim().Split(',')
        }
    }
    if (-not $allExtras -or $allExtras.Count -eq 0) {
        Write-Warn "Could not parse [all] from pyproject.toml; Tier 2 will be a no-op."
        $safeAll = "all"
    } else {
        $safeAll = ($allExtras | Where-Object { $brokenExtras -notcontains $_ }) -join ","
    }
    $brokenLabel = if ($brokenExtras) { ($brokenExtras -join ", ") } else { "none" }

    $installTiers = @(
        @{ Name = "all"; Spec = ".[all]" },
        @{ Name = "all minus known-broken ($brokenLabel)"; Spec = ".[$safeAll]" },
        @{ Name = "core only (no extras)"; Spec = "." }
    )
    $installed = $skipPipFallback
    if (-not $skipPipFallback) {
        foreach ($tier in $installTiers) {
        Write-Info "Trying tier: $($tier.Name) ..."
        Invoke-NativeWithRelaxedErrorAction { & $UvCmd pip install -e $tier.Spec }
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Main package installed ($($tier.Name))"
            $script:InstalledTier = $tier.Name
            $installed = $true
            break
        }
        Write-Warn "Tier '$($tier.Name)' failed (exit $LASTEXITCODE). Trying next tier..."
        }
    }
    if (-not $installed) {
        throw "Failed to install hermes-agent package even with no extras. Inspect the uv pip install output above."
    }

    # Baseline-import gate. Even if a tier reported success above, the
    # actual deps may have landed somewhere other than $InstallDir\venv\
    # (e.g. uv 0.5+ syncing into a sibling .venv\ when UV_PROJECT_ENVIRONMENT
    # isn't set, leaving venv\ empty and hermes.exe broken with
    # `ModuleNotFoundError: No module named 'dotenv'` on first run).
    # We probe via the venv's own python so a misdirected sync is caught
    # here, not 30 seconds later when the user runs `hermes`.
    if (-not $NoVenv) {
        $venvPython = "$InstallDir\venv\Scripts\python.exe"
        if (-not (Test-Path $venvPython)) {
            throw "Install reported success but $venvPython does not exist. The dependency sync likely landed in a sibling .venv\ directory. Re-run the installer; if it persists, close Hebri processes and preserve existing venv directories before retrying. Do not delete venv in place."
        }
        # Relax EAP=Stop while running the import probe.  Python writes
        # deprecation warnings and import-system info to stderr; under
        # EAP=Stop the 2>&1 merge wraps those as ErrorRecord objects and
        # throws even when the imports succeed.  $LASTEXITCODE is the
        # reliable signal (it's 0 iff the python invocation exited 0,
        # regardless of what was written to stderr).
        $prevEAP = $ErrorActionPreference
        $ErrorActionPreference = "Continue"
        & $venvPython -c "import dotenv, openai, rich, prompt_toolkit" 2>&1 | Out-Null
        $importExitCode = $LASTEXITCODE
        $ErrorActionPreference = $prevEAP
        if ($importExitCode -ne 0) {
            $sibling = "$InstallDir\.venv"
            $hint = if (Test-Path $sibling) {
                "Detected sibling .venv\ at $sibling -- uv synced there instead of venv\. Close Hebri processes, preserve the existing venv, and rerun the installer so the transactional recovery path can move directories safely."
            } else {
                "Recover with: cd '$InstallDir'; `$env:UV_PROJECT_ENVIRONMENT='$InstallDir\venv'; uv sync --extra all --locked"
            }
            throw "Baseline imports failed in $InstallDir\venv (dotenv/openai/rich/prompt_toolkit). The install completed but dependencies are not in the venv. $hint"
        }
        Write-Success "Baseline imports verified in venv"
    }

    # Commit the venv transaction: the dependency install completed and the
    # baseline imports passed, so the previous venv is no longer needed as a
    # rollback source (#83149).
    Complete-VenvTransaction
    } catch {
        # Dependency install or import validation failed: restore the previous
        # working venv (parked by Install-Venv) before surfacing the error, so
        # a failed update leaves Hermes and its blocker probe usable.
        Restore-VenvBackup
        Pop-Location
        throw
    }

    if (-not $NoVenv) {
        # uv on Windows can register hermes.exe in dist-info/RECORD but fail to
        # materialise the .exe (file lock during self-update, distlib edge case).
        # Catch it here so a fresh install/update does not finish with a broken
        # `hermes` command while hermes-agent.exe / hermes-acp.exe exist
        $scriptsDir = Join-Path $InstallDir "venv\Scripts"
        $pythonExe = Join-Path $scriptsDir "python.exe"
        if ((Test-Path $scriptsDir) -and (Test-Path $pythonExe)) {
            $scriptNames = & $pythonExe -c @"
import tomllib
with open('pyproject.toml', 'rb') as fh:
    scripts = tomllib.load(fh).get('project', {}).get('scripts', {}) or {}
print(','.join(scripts))
"@ 2>$null
            if ($LASTEXITCODE -eq 0 -and $scriptNames) {
                $expected = @($scriptNames.Trim().Split(',') | Where-Object { $_ })
                $missing = @()
                foreach ($name in $expected) {
                    $exe = Join-Path $scriptsDir "$name.exe"
                    if (-not (Test-Path $exe)) { $missing += "$name.exe" }
                }
                if ($missing.Count -gt 0) {
                    Write-Warn "Console entry point(s) missing: $($missing -join ', ')"
                    Write-Info "Reinstalling entry points..."
                    $env:UV_PROJECT_ENVIRONMENT = "$InstallDir\venv"
                    Invoke-NativeWithRelaxedErrorAction { & $UvCmd pip install --reinstall -e . }
                    $stillMissing = @()
                    foreach ($name in $expected) {
                        $exe = Join-Path $scriptsDir "$name.exe"
                        if (-not (Test-Path $exe)) { $stillMissing += "$name.exe" }
                    }
                    if ($stillMissing.Count -gt 0) {
                        Write-Warn "Entry points still missing after repair: $($stillMissing -join ', ')"
                        Write-Info "Workaround: `"$pythonExe`" -m hermes_cli.main <command>"
                    } else {
                        Write-Success "Console entry points restored"
                    }
                }
            }
        }
    }

    # Verify the dashboard deps specifically -- they're the most common thing
    # users hit and lazy-import errors from `hebri dashboard` are confusing.
    # If tier 1 failed (the common case), [web] was still picked up by tiers
    # 2-3; only tier 4 leaves you without it.
    $pythonExe = if (-not $NoVenv) { "$InstallDir\venv\Scripts\python.exe" } else { (& $UvCmd python find $PythonVersion) }
    if (Test-Path $pythonExe) {
        $webOk = $false
        $webServerSyntaxOk = $false
        # Relax EAP=Stop while running the import probe; see the matching
        # comment on the baseline-imports check above.  Python writes
        # deprecation warnings to stderr and we don't want those wrapped
        # as ErrorRecords that silently force the "not importable" path
        # even when fastapi/uvicorn are actually installed.
        $prevEAP = $ErrorActionPreference
        $ErrorActionPreference = "Continue"
        try {
            & $pythonExe -c "import fastapi, uvicorn" 2>&1 | Out-Null
            if ($LASTEXITCODE -eq 0) { $webOk = $true }
        } catch { }
        try {
            & $pythonExe -m py_compile "$InstallDir\hermes_cli\web_server.py" 2>&1 | Out-Null
            if ($LASTEXITCODE -eq 0) { $webServerSyntaxOk = $true }
        } catch { }
        $ErrorActionPreference = $prevEAP
        if (-not $webOk) {
            Write-Warn "fastapi/uvicorn not importable -- `hebri dashboard` will not work."
            Write-Info "Attempting targeted install of [web] extra as last resort..."
            & $UvCmd pip install -e ".[web]"
            if ($LASTEXITCODE -eq 0) {
                Write-Success "[web] extra installed; `hebri dashboard` should now work."
            } else {
                Write-Warn "Could not install [web] extra. Run manually: uv pip install --python `"$pythonExe`" `"fastapi>=0.104,<1`" `"uvicorn[standard]>=0.24,<1`""
            }
        }
        if (-not $webServerSyntaxOk) {
            throw "dashboard backend source failed syntax check: hermes_cli/web_server.py"
        }
    }
    
    Pop-Location
    
    Write-Success "All dependencies installed"
}

