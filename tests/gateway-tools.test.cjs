const test = require('node:test');
const assert = require('node:assert/strict');
const { gatewayTools } = require('../.private/test-build/gateway-tools.js');

const address = 'https://training.example/relay/' + 'r'.repeat(40) + '/v1';
const groups = gatewayTools(address);
const tools = groups.flatMap(group => group.tools);

test('the tools are the ones apps use to ask for a fixed answer, in two groups', () => {
  assert.deepEqual(groups.map(group => [group.label, group.tools.map(tool => tool.name)]), [
    ['SDKs', ['OpenAI Python', 'OpenAI Node', 'cURL']],
    ['Frameworks', ['LangChain', 'Vercel AI SDK', 'LlamaIndex', 'Instructor']],
  ]);
  assert.equal(new Set(tools.map(tool => tool.id)).size, tools.length);
});

test('every tool points at the address, asks for a fixed answer list, and carries no key', () => {
  for (const tool of tools) {
    const code = tool.steps.map(step => step.code).join('\n');
    assert.ok(tool.steps.length >= 2 && tool.steps.every(step => step.title && step.label), tool.name);
    assert.ok(code.includes(address), tool.name);
    assert.match(code, /refund.*shipping.*other/s, tool.name);
    assert.doesNotMatch(code, /sk-|api_key\s*=|apiKey\s*:/, tool.name);
    assert.ok(tool.checked, tool.name);
  }
});

test('a tool whose default call is not collected says so', () => {
  const instructor = tools.find(tool => tool.id === 'instructor');
  assert.match(instructor.note, /default mode/);
  assert.match(instructor.steps.map(step => step.code).join('\n'), /Mode\.JSON_SCHEMA/);
});

test('providers: the gateway passes requests on to OpenAI, Claude, Gemini or Jev', () => {
  const { gatewayProviders } = require('../.private/test-build/gateway-tools.js');
  assert.deepEqual(gatewayProviders.map(provider => [provider.id, provider.name]), [['openai', 'OpenAI'], ['anthropic', 'Claude'], ['gemini', 'Gemini'], ['jev', 'Jev']]);
});

test('a Claude account gets the Anthropic libraries, pointed at the gateway root, asking for a fixed answer list', () => {
  const root = 'https://training.example/relay/' + 'r'.repeat(40);
  const claude = gatewayTools(root, 'anthropic');
  assert.deepEqual(claude.map(group => [group.label, group.tools.map(tool => tool.name)]), [['SDKs', ['Anthropic Python', 'Anthropic TypeScript', 'cURL']]]);
  for (const tool of claude.flatMap(group => group.tools)) {
    const code = tool.steps.map(step => step.code).join('\n');
    assert.ok(tool.steps.length >= 2 && tool.checked, tool.name);
    // The Anthropic libraries add /v1 themselves.
    assert.ok(code.includes(root) && !code.includes(root + '/v1"') && !code.includes(root + "/v1'"), tool.name);
    assert.match(code, /refund.*shipping.*other/s, tool.name);
    assert.doesNotMatch(code, /sk-ant|api_key\s*=|apiKey\s*:|gpt-/, tool.name);
  }
  assert.match(claude[0].tools[2].steps[1].code, /\$ZILS_GATEWAY\/v1\/messages/);
  assert.equal(new Set([...tools, ...claude.flatMap(group => group.tools)].map(tool => tool.id)).size, tools.length + 3);
});

test('a Gemini account gets the Google libraries, pointed at the gateway root, asking for a fixed answer list', () => {
  const root = 'https://training.example/relay/' + 'r'.repeat(40);
  const gemini = gatewayTools(root, 'gemini');
  assert.deepEqual(gemini.map(group => [group.label, group.tools.map(tool => tool.name)]), [['SDKs', ['Google Gen AI Python', 'Google Gen AI JavaScript', 'cURL']]]);
  for (const tool of gemini.flatMap(group => group.tools)) {
    const code = tool.steps.map(step => step.code).join('\n');
    assert.ok(tool.steps.length >= 2 && tool.checked, tool.name);
    // The Google libraries add the API version themselves.
    assert.ok(code.includes(root) && !code.includes(root + '/v1"') && !code.includes(root + "/v1'"), tool.name);
    assert.match(code, /refund.*shipping.*other/s, tool.name);
    // The key stays in the app's environment, and never goes in the address.
    assert.doesNotMatch(code, /AIza|api_key\s*=|apiKey\s*:|\?key=|gpt-|claude-/, tool.name);
    // Google's libraries call API version v1, where the -latest model names do not exist.
    assert.doesNotMatch(code, /-latest/, tool.name);
  }
  assert.match(gemini[0].tools[2].steps[1].code, /\$ZILS_GATEWAY\/v1beta\/models\/[a-z0-9.-]+:generateContent/);
  assert.match(gemini[0].tools[2].steps[1].code, /x-goog-api-key: \$GEMINI_API_KEY/);
  assert.equal(new Set([...tools, ...gemini.flatMap(group => group.tools)].map(tool => tool.id)).size, tools.length + 3);
});

test('a Jev account gets the Jev libraries, pointed at the gateway root and otherwise left alone', () => {
  const root = 'https://training.example/relay/' + 'r'.repeat(40);
  const jev = gatewayTools(root, 'jev');
  assert.deepEqual(jev.map(group => [group.label, group.tools.map(tool => tool.name)]), [['SDKs', ['Jev Python', 'Jev JavaScript', 'cURL']]]);
  for (const tool of jev.flatMap(group => group.tools)) {
    const code = tool.steps.map(step => step.code).join('\n');
    assert.ok(tool.steps.length >= 2 && tool.checked, tool.name);
    assert.ok(code.includes(root) && !code.includes(root + '/v1"') && !code.includes(root + "/v1'"), tool.name);
    assert.match(code, /refund.*shipping.*other/s, tool.name);
    assert.doesNotMatch(code, /apikey_|api_key\s*=|apiKey\s*:/, tool.name);
    // The gateway reads the compressed requests the libraries send by default: nothing else to set.
    assert.doesNotMatch(code, /compression/, tool.name);
    assert.equal(tool.note, undefined, tool.name);
  }
  assert.match(jev[0].tools[2].steps[1].code, /\$ZILS_GATEWAY\/v1\/systemone/);
  assert.equal(new Set([...tools, ...jev.flatMap(group => group.tools)].map(tool => tool.id)).size, tools.length + 3);
});
