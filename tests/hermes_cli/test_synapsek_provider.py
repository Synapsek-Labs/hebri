"""Real discovery, credential resolution and SDK wire contract; no paid requests."""
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
from threading import Event
import pytest


@pytest.mark.parametrize('settlement_error', [False, True])
def test_synapsek_sdk_stream_keeps_tool_result_pending_until_receipt(settlement_error):
    """The real SDK must raise on a late billing error, not return a tool turn."""
    from openai import OpenAI, APIError

    release = Event()
    base = {'id': 'gen-test', 'object': 'chat.completion.chunk', 'created': 1, 'model': 'synapsek-auto'}

    class Handler(BaseHTTPRequestHandler):
        def do_POST(self):
            self.rfile.read(int(self.headers['Content-Length']))
            self.send_response(200)
            self.send_header('Content-Type', 'text/event-stream')
            self.end_headers()

            def send(value):
                data = value if isinstance(value, str) else json.dumps(value)
                self.wfile.write(f'data: {data}\n\n'.encode())
                self.wfile.flush()

            send({**base, 'choices': [{'index': 0, 'delta': {'role': 'assistant', 'tool_calls': [
                {'index': 0, 'id': 'tool1', 'type': 'function', 'function': {'name': 'read_file', 'arguments': '{'}}
            ]}, 'finish_reason': None}]})
            if not release.wait(5):
                return
            if settlement_error:
                send({'error': {'message': 'usage_settlement_pending', 'type': 'synapsek_error', 'code': 'usage_settlement_pending'}})
                return
            send({**base, 'choices': [{'index': 0, 'delta': {'tool_calls': [
                {'index': 0, 'function': {'arguments': '"path":"fixture.txt"}'}}
            ]}, 'finish_reason': None}]})
            send({**base, 'choices': [{'index': 0, 'delta': {}, 'finish_reason': 'tool_calls'}]})
            send({**base, 'choices': [], 'usage': {'prompt_tokens': 20, 'completion_tokens': 4, 'total_tokens': 24,
                'cost': 0.00001, 'prompt_tokens_details': {'cached_tokens': 10}}})
            send('[DONE]')

        def log_message(self, *_args):
            pass

    server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
    worker = Thread(target=server.serve_forever, daemon=True)
    worker.start()
    try:
        with OpenAI(api_key='isolated-fixture', base_url=f'http://127.0.0.1:{server.server_port}/v1', max_retries=0) as client:
            with client.chat.completions.create(model='synapsek-auto', messages=[{'role': 'user', 'content': 'read fixture'}],
                    stream=True, stream_options={'include_usage': True}) as stream:
                first = next(stream)
                assert first.choices[0].finish_reason is None
                assert first.choices[0].delta.tool_calls[0].function.arguments == '{'
                # First delta was received while the response was still blocked.
                assert not release.is_set()
                release.set()
                if settlement_error:
                    with pytest.raises(APIError, match='usage_settlement_pending'):
                        list(stream)
                else:
                    tail = list(stream)
                    assert tail[0].choices[0].delta.tool_calls[0].function.arguments == '"path":"fixture.txt"}'
                    assert tail[1].choices[0].finish_reason == 'tool_calls'
                    assert tail[2].usage.prompt_tokens_details.cached_tokens == 10
                    assert tail[2].usage.cost == 0.00001
    finally:
        release.set()
        server.shutdown(); server.server_close(); worker.join()


def test_desktop_provider_resolves_across_homes_and_executes_tool_followup(tmp_path, monkeypatch):
    from providers import get_provider_profile
    from hermes_cli.runtime_provider import resolve_runtime_provider
    from agent.transports.chat_completions import ChatCompletionsTransport
    from openai import OpenAI
    from hermes_cli.models import provider_model_ids

    requests = []
    catalog_requests = []
    active_catalog = ['synapsek-auto', 'fixture/paid-model']

    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            assert self.path == '/v1/models'
            assert self.headers['Authorization'] == 'Bearer process-capability'
            catalog_requests.append(self.path)
            out = json.dumps({'data': [{'id': model} for model in active_catalog]}).encode()
            self.send_response(200); self.send_header('Content-Type', 'application/json'); self.end_headers(); self.wfile.write(out)

        def do_POST(self):
            assert self.path == '/v1/chat/completions'
            assert self.headers['Authorization'] == 'Bearer process-capability'
            payload = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
            requests.append(payload)
            msg = ({'role': 'assistant', 'content': None, 'tool_calls': [
                {'id': 'tool1', 'type': 'function', 'function': {'name': 'read_file', 'arguments': '{"path":"a.txt"}'}}
            ]} if len(requests) % 2 else {'role': 'assistant', 'content': 'Read complete.'})
            out = json.dumps({'id': 'gen-test', 'object': 'chat.completion', 'created': 1, 'model': 'synapsek-auto',
                'choices': [{'index': 0, 'message': msg, 'finish_reason': 'tool_calls' if 'tool_calls' in msg else 'stop'}],
                'usage': {'prompt_tokens': 10, 'completion_tokens': 5, 'total_tokens': 15}}).encode()
            self.send_response(200); self.send_header('Content-Type', 'application/json'); self.end_headers(); self.wfile.write(out)

        def log_message(self, *_args):
            pass

    server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
    worker = Thread(target=server.serve_forever, daemon=True); worker.start()
    monkeypatch.setenv('HEBRI_SYNAPSEK_BRIDGE_URL', f'http://127.0.0.1:{server.server_port}/v1')
    monkeypatch.setenv('HEBRI_SYNAPSEK_BRIDGE_TOKEN', 'process-capability')
    try:
        for name in ('a', 'b', 'a'):
            home = tmp_path / name; home.mkdir(exist_ok=True)
            monkeypatch.setenv('HERMES_HOME', str(home))
            profile = get_provider_profile('synapsek')
            assert profile and profile.default_aux_model == 'synapsek-auto'
            active_catalog[:] = ['synapsek-auto', f'fixture/{name}-model']
            # Exercise the actual picker discovery, not just the completion SDK.
            # The profile intentionally has no static server address.
            assert not profile.base_url
            assert provider_model_ids('synapsek', force_refresh=True) == active_catalog
            runtime = resolve_runtime_provider(requested='synapsek', target_model='synapsek-auto')
            assert runtime['base_url'] == f'http://127.0.0.1:{server.server_port}/v1'
            assert runtime['api_key'] == 'process-capability'
            transport = ChatCompletionsTransport()
            messages = [{'role': 'user', 'content': 'Read a.txt'}]
            tools = [{'type': 'function', 'function': {'name': 'read_file', 'parameters': {'type': 'object', 'properties': {'path': {'type': 'string'}}}}}]
            with OpenAI(api_key=runtime['api_key'], base_url=runtime['base_url'], max_retries=0) as client:
                kwargs = transport.build_kwargs('synapsek-auto', messages, tools, provider_profile=profile,
                    base_url=runtime['base_url'], max_tokens_param_fn=lambda n: {'max_tokens': n})
                first = client.chat.completions.create(**kwargs)
                assert first.choices[0].message.tool_calls[0].function.name == 'read_file'
                messages += [first.choices[0].message.model_dump(exclude_none=True), {'role': 'tool', 'tool_call_id': 'tool1', 'content': 'safe fixture'}]
                followup = transport.build_kwargs('synapsek-auto', messages, tools, provider_profile=profile, base_url=runtime['base_url'])
                second = client.chat.completions.create(**followup)
                assert second.choices[0].message.content == 'Read complete.'
            # The generic pool may persist a source/fingerprint, never the capability.
            if (home / 'auth.json').exists():
                assert 'process-capability' not in (home / 'auth.json').read_text()
        assert len(requests) == 6
        assert len(catalog_requests) == 3
        monkeypatch.delenv('HEBRI_SYNAPSEK_BRIDGE_TOKEN')
        from hermes_cli.auth import resolve_api_key_provider_credentials
        assert not resolve_api_key_provider_credentials('synapsek')['api_key']
        assert provider_model_ids('synapsek', force_refresh=True) == ['synapsek-auto']
        assert len(catalog_requests) == 3
    finally:
        server.shutdown(); server.server_close(); worker.join()
