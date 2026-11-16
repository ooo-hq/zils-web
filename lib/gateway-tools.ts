export type ToolLanguage = 'python' | 'javascript' | 'bash';
export type GatewayToolStep = { title: string; label: string; language: ToolLanguage; code: string };
export type GatewayTool = { id: string; name: string; tag: string; blurb: string; steps: GatewayToolStep[]; note?: string; checked: string };

export type GatewayProvider = 'openai' | 'anthropic' | 'gemini' | 'jev';
type GatewayToolGroup = { label: string; intro: string; tools: GatewayTool[] };

/** The providers a gateway address can pass requests on to. An address goes to one of them. */
export const gatewayProviders: { id: GatewayProvider; name: string }[] = [
  { id: 'openai', name: 'OpenAI' },
  { id: 'anthropic', name: 'Claude' },
  { id: 'gemini', name: 'Gemini' },
  { id: 'jev', name: 'Jev' },
];

// The example question every card asks. The model is the caller's own: any name their provider accepts.
const MODEL = 'gpt-6.1-sol';
const CLAUDE_MODEL = 'claude-opus-5-5';
// A name Google serves on API version v1, which its libraries call by default: the -latest names exist on v1beta only.
const GEMINI_MODEL = 'gemini-3.8-flash';
const ASK = 'Pick the intent of the customer message.';
const SAID = 'Where is my order?';

const PYTHON_TICKET = `class Ticket(BaseModel):
    intent: Literal["refund", "shipping", "other"]`;
const ZOD_TICKET = `z.object({ intent: z.enum(['refund', 'shipping', 'other']) })`;

/**
 * How to send an app's fixed-answer questions through the gateway, per tool. Each tool's steps, joined
 * in order, are one program that was run against the relay's own decision reader with the package
 * versions in `checked`: the request it sends is one the gateway collects. The provider key is left
 * to the app's environment, as it is today. For Claude, Gemini and Jev the address is the API root, without /v1.
 */
export function gatewayTools(address: string, provider: GatewayProvider = 'openai'): GatewayToolGroup[] {
  if (provider === 'jev') return jevTools(address);
  if (provider === 'anthropic') return claudeTools(address);
  if (provider === 'gemini') return geminiTools(address);
  const point = 'Point the client at your gateway';
  const ask = 'Ask for an answer from a fixed list';
  return [
    { label: 'SDKs', intro: 'Call your provider directly, through the gateway.', tools: [
      { id: 'openai-python', name: 'OpenAI Python', tag: 'Responses API', blurb: 'The official Python library, with a typed answer.', checked: 'openai 1.109 and 3.3', steps: [
        { title: point, label: 'Python', language: 'python', code: `from typing import Literal

from openai import OpenAI
from pydantic import BaseModel

client = OpenAI(base_url="${address}")` },
        { title: ask, label: 'Python', language: 'python', code: `${PYTHON_TICKET}

reply = client.responses.parse(
    model="${MODEL}",  # the model you already use
    instructions="${ASK}",
    input="${SAID}",
    text_format=Ticket,
)
print(reply.output_parsed.intent)` },
      ] },
      { id: 'openai-node', name: 'OpenAI Node', tag: 'Responses API', blurb: 'The official TypeScript and JavaScript library, with a Zod schema.', checked: 'openai 7.57, zod 4.6', steps: [
        { title: point, label: 'TypeScript', language: 'javascript', code: `import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { z } from 'zod';

const client = new OpenAI({ baseURL: '${address}' });` },
        { title: ask, label: 'TypeScript', language: 'javascript', code: `const Ticket = ${ZOD_TICKET};

const reply = await client.responses.parse({
  model: '${MODEL}', // the model you already use
  instructions: '${ASK}',
  input: '${SAID}',
  text: { format: zodTextFormat(Ticket, 'ticket') },
});
console.log(reply.output_parsed.intent);` },
      ] },
      { id: 'curl', name: 'cURL', tag: 'Chat Completions', blurb: 'The raw request, for any language or a quick test from a terminal.', checked: 'curl 8', steps: [
        { title: 'Set your gateway address', label: 'Bash', language: 'bash', code: `export ZILS_GATEWAY="${address}"` },
        { title: ask, label: 'Bash', language: 'bash', code: `curl -s "$ZILS_GATEWAY/chat/completions" \\
  -H "Authorization: Bearer $OPENAI_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${MODEL}",
    "messages": [
      {"role": "system", "content": "${ASK}"},
      {"role": "user", "content": "${SAID}"}
    ],
    "response_format": {"type": "json_schema", "json_schema": {
      "name": "ticket", "strict": true, "schema": {
        "type": "object",
        "properties": {"intent": {"type": "string", "enum": ["refund", "shipping", "other"]}},
        "required": ["intent"],
        "additionalProperties": false
      }
    }}
  }'` },
      ] },
    ] },
    { label: 'Frameworks', intro: 'Keep your framework; change where its OpenAI model points.', tools: [
      { id: 'langchain', name: 'LangChain', tag: 'Chat Completions', blurb: 'ChatOpenAI with structured output.', checked: 'langchain-openai 1.1', steps: [
        { title: point, label: 'Python', language: 'python', code: `from typing import Literal

from langchain_openai import ChatOpenAI
from pydantic import BaseModel

llm = ChatOpenAI(model="${MODEL}", base_url="${address}")` },
        { title: ask, label: 'Python', language: 'python', code: `${PYTHON_TICKET}

classify = llm.with_structured_output(Ticket, method="json_schema", strict=True)
reply = classify.invoke([("system", "${ASK}"), ("user", "${SAID}")])
print(reply.intent)` },
      ] },
      { id: 'vercel-ai-sdk', name: 'Vercel AI SDK', tag: 'Responses API', blurb: 'generateText with an object output.', checked: 'ai 7.0, @ai-sdk/openai 4.0', steps: [
        { title: point, label: 'TypeScript', language: 'javascript', code: `import { createOpenAI } from '@ai-sdk/openai';
import { generateText, Output } from 'ai';
import { z } from 'zod';

const openai = createOpenAI({ baseURL: '${address}' });` },
        { title: ask, label: 'TypeScript', language: 'javascript', code: `const { output } = await generateText({
  model: openai('${MODEL}'), // the model you already use
  output: Output.object({ schema: ${ZOD_TICKET} }),
  system: '${ASK}',
  prompt: '${SAID}',
});
console.log(output.intent);` },
      ] },
      { id: 'llamaindex', name: 'LlamaIndex', tag: 'Chat Completions', blurb: 'The OpenAI LLM as a structured LLM.', checked: 'llama-index-llms-openai 0.9', steps: [
        { title: point, label: 'Python', language: 'python', code: `from typing import Literal

from llama_index.core.llms import ChatMessage
from llama_index.llms.openai import OpenAI
from pydantic import BaseModel

llm = OpenAI(model="${MODEL}", api_base="${address}")` },
        { title: ask, label: 'Python', language: 'python', code: `${PYTHON_TICKET}

classify = llm.as_structured_llm(Ticket)
reply = classify.chat([
    ChatMessage(role="system", content="${ASK}"),
    ChatMessage(role="user", content="${SAID}"),
])
print(reply.raw.intent)` },
      ] },
      { id: 'instructor', name: 'Instructor', tag: 'Chat Completions', blurb: 'Typed answers from the OpenAI client, in JSON schema mode.', checked: 'instructor 1.17', note: 'Instructor’s default mode sends a tool call, which passes through the gateway but is not collected. Set the mode as shown.', steps: [
        { title: point, label: 'Python', language: 'python', code: `from typing import Literal

import instructor
from openai import OpenAI
from pydantic import BaseModel

client = instructor.from_openai(
    OpenAI(base_url="${address}"),
    mode=instructor.Mode.JSON_SCHEMA,
)` },
        { title: ask, label: 'Python', language: 'python', code: `${PYTHON_TICKET}

reply = client.chat.completions.create(
    model="${MODEL}",  # the model you already use
    response_model=Ticket,
    messages=[
        {"role": "system", "content": "${ASK}"},
        {"role": "user", "content": "${SAID}"},
    ],
)
print(reply.intent)` },
      ] },
    ] },
  ];
}

/** The same for an app that calls Claude through Anthropic's own libraries: an answer from a fixed list is asked for with a schema. */
function claudeTools(address: string): GatewayToolGroup[] {
  const point = 'Point the client at your gateway';
  const ask = 'Ask for an answer from a fixed list';
  return [
    { label: 'SDKs', intro: 'Call Claude as you do today, through the gateway.', tools: [
      { id: 'anthropic-python', name: 'Anthropic Python', tag: 'Messages API', blurb: 'The official Python library, with a typed answer.', checked: 'anthropic 2.8, pydantic 2.14', steps: [
        { title: point, label: 'Python', language: 'python', code: `from typing import Literal

from anthropic import Anthropic
from pydantic import BaseModel

client = Anthropic(base_url="${address}")` },
        { title: ask, label: 'Python', language: 'python', code: `${PYTHON_TICKET}

reply = client.messages.parse(
    model="${CLAUDE_MODEL}",  # the model you already use
    max_tokens=1024,
    system="${ASK}",
    messages=[{"role": "user", "content": "${SAID}"}],
    output_format=Ticket,
)
print(reply.parsed_output.intent)` },
      ] },
      { id: 'anthropic-typescript', name: 'Anthropic TypeScript', tag: 'Messages API', blurb: 'The official TypeScript and JavaScript library, with a Zod schema.', checked: '@anthropic-ai/sdk 1.8, zod 4.6', steps: [
        { title: point, label: 'TypeScript', language: 'javascript', code: `import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';

const client = new Anthropic({ baseURL: '${address}' });` },
        { title: ask, label: 'TypeScript', language: 'javascript', code: `const Ticket = ${ZOD_TICKET};

const reply = await client.messages.parse({
  model: '${CLAUDE_MODEL}', // the model you already use
  max_tokens: 1024,
  system: '${ASK}',
  messages: [{ role: 'user', content: '${SAID}' }],
  output_config: { format: zodOutputFormat(Ticket) },
});
console.log(reply.parsed_output.intent);` },
      ] },
      { id: 'anthropic-curl', name: 'cURL', tag: 'Messages API', blurb: 'The raw request, for any language or a quick test from a terminal.', checked: 'curl 8', steps: [
        { title: 'Set your gateway address', label: 'Bash', language: 'bash', code: `export ZILS_GATEWAY="${address}"` },
        { title: ask, label: 'Bash', language: 'bash', code: `curl -s "$ZILS_GATEWAY/v1/messages" \\
  -H "x-api-key: $ANTHROPIC_API_KEY" \\
  -H "anthropic-version: 2026-10-21" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "${CLAUDE_MODEL}",
    "max_tokens": 1024,
    "system": "${ASK}",
    "messages": [{"role": "user", "content": "${SAID}"}],
    "output_config": {"format": {"type": "json_schema", "schema": {
      "type": "object",
      "properties": {"intent": {"type": "string", "enum": ["refund", "shipping", "other"]}},
      "required": ["intent"],
      "additionalProperties": false
    }}}
  }'` },
      ] },
    ] },
  ];
}

/** The same for an app that calls Gemini through Google's own libraries (generateContent): an answer from a fixed list is asked for with a schema. The key stays in a header, never in the address. */
function geminiTools(address: string): GatewayToolGroup[] {
  const point = 'Point the client at your gateway';
  const ask = 'Ask for an answer from a fixed list';
  return [
    { label: 'SDKs', intro: 'Call Gemini as you do today, through the gateway.', tools: [
      { id: 'gemini-python', name: 'Google Gen AI Python', tag: 'generateContent', blurb: 'The official Python library, with a typed answer.', checked: 'google-genai 3.3, pydantic 2.14', steps: [
        { title: point, label: 'Python', language: 'python', code: `from typing import Literal

from google import genai
from google.genai import types
from pydantic import BaseModel

client = genai.Client(http_options=types.HttpOptions(base_url="${address}"))` },
        { title: ask, label: 'Python', language: 'python', code: `${PYTHON_TICKET}

reply = client.models.generate_content(
    model="${GEMINI_MODEL}",  # the model you already use
    contents="${SAID}",
    config=types.GenerateContentConfig(
        system_instruction="${ASK}",
        response_mime_type="application/json",
        response_schema=Ticket,
    ),
)
print(reply.parsed.intent)` },
      ] },
      { id: 'gemini-javascript', name: 'Google Gen AI JavaScript', tag: 'generateContent', blurb: 'The official JavaScript and TypeScript library, with a schema.', checked: '@google/genai 3.3', steps: [
        { title: point, label: 'TypeScript', language: 'javascript', code: `import { GoogleGenAI, Type } from '@google/genai';

const ai = new GoogleGenAI({ httpOptions: { baseUrl: '${address}' } });` },
        { title: ask, label: 'TypeScript', language: 'javascript', code: `const reply = await ai.models.generateContent({
  model: '${GEMINI_MODEL}', // the model you already use
  contents: '${SAID}',
  config: {
    systemInstruction: '${ASK}',
    responseMimeType: 'application/json',
    responseSchema: {
      type: Type.OBJECT,
      properties: { intent: { type: Type.STRING, enum: ['refund', 'shipping', 'other'] } },
      required: ['intent'],
    },
  },
});
console.log(JSON.parse(reply.text).intent);` },
      ] },
      { id: 'gemini-curl', name: 'cURL', tag: 'generateContent', blurb: 'The raw request, for any language or a quick test from a terminal.', checked: 'curl 8', steps: [
        { title: 'Set your gateway address', label: 'Bash', language: 'bash', code: `export ZILS_GATEWAY="${address}"` },
        { title: ask, label: 'Bash', language: 'bash', code: `curl -s "$ZILS_GATEWAY/v1beta/models/${GEMINI_MODEL}:generateContent" \\
  -H "x-goog-api-key: $GEMINI_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "systemInstruction": {"parts": [{"text": "${ASK}"}]},
    "contents": [{"parts": [{"text": "${SAID}"}]}],
    "generationConfig": {"responseMimeType": "application/json", "responseSchema": {
      "type": "OBJECT",
      "properties": {"intent": {"type": "STRING", "enum": ["refund", "shipping", "other"]}},
      "required": ["intent"]
    }}
  }'` },
      ] },
    ] },
  ];
}

/** The same for an app that calls Jev: its questions already have fixed answers, so every yes/no and choice question is collected. */
function jevTools(address: string): GatewayToolGroup[] {
  const point = 'Point the client at your gateway';
  const ask = 'Ask a question as you do today';
  return [
    { label: 'SDKs', intro: 'Call Jev as you do today, through the gateway.', tools: [
      { id: 'jev-python', name: 'Jev Python', tag: 'System One', blurb: 'The official Python library.', checked: 'typesafe-sdk 0.7', steps: [
        { title: point, label: 'Python', language: 'python', code: `from typesafe_sdk import Choice, TypeSafeClient

client = TypeSafeClient(base_url="${address}")` },
        { title: ask, label: 'Python', language: 'python', code: `response = client.system_one(
    state="${SAID}",
    questions={
        "intent": Choice(
            instructions="${ASK}",
            criteria={"refund": None, "shipping": None, "other": None},
        ),
    },
)
print(response.answers["intent"].choice)` },
      ] },
      { id: 'jev-javascript', name: 'Jev JavaScript', tag: 'System One', blurb: 'The official JavaScript and TypeScript library.', checked: '@typesafe-ai/sdk 0.7', steps: [
        { title: point, label: 'TypeScript', language: 'javascript', code: `import { choice, TypeSafeClient } from '@typesafe-ai/sdk';

const client = new TypeSafeClient({ baseURL: '${address}' });` },
        { title: ask, label: 'TypeScript', language: 'javascript', code: `const response = await client.systemOne({
  state: '${SAID}',
  questions: {
    intent: choice('${ASK}', { refund: null, shipping: null, other: null }),
  },
});
console.log(response.answers.intent.choice);` },
      ] },
      { id: 'jev-curl', name: 'cURL', tag: 'System One', blurb: 'The raw request, for any language or a quick test from a terminal.', checked: 'curl 8', steps: [
        { title: 'Set your gateway address', label: 'Bash', language: 'bash', code: `export ZILS_GATEWAY="${address}"` },
        { title: ask, label: 'Bash', language: 'bash', code: `curl -s "$ZILS_GATEWAY/v1/systemone" \\
  -H "Authorization: Bearer $TYPESAFE_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "jev-latest",
    "state": "${SAID}",
    "questions": {
      "intent": {
        "type": "choice",
        "instructions": "${ASK}",
        "criteria": {"refund": null, "shipping": null, "other": null}
      }
    }
  }'` },
      ] },
    ] },
  ];
}
