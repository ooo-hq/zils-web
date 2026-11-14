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

test('providers: OpenAI works today, Jev is named as not yet', () => {
  const { gatewayProviders } = require('../.private/test-build/gateway-tools.js');
  assert.deepEqual(gatewayProviders.map(provider => [provider.name, provider.supported]), [['OpenAI', true], ['Jev', false]]);
});
