import { serviceUrl } from './training';

export type ExampleLanguage = 'Python' | 'JavaScript';

/** Reuse a real training question without sending its expected answer. */
export function modelQuickstart(modelId: string, apiUrl: string, language: ExampleLanguage) {
  const endpoint = JSON.stringify(`${serviceUrl(apiUrl)}/v1/systemone`);
  const model = JSON.stringify(modelId);
  if (language === 'Python') return {
    filename: 'use-model.py',
    command: 'export ZILS_API_KEY="YOUR_API_KEY"\npython3 use-model.py',
    code: `import json
import os
from urllib.request import Request, urlopen

# Use a prepared JSONL file from this training run.
with open("train.jsonl", encoding="utf-8-sig") as file:
    example = json.loads(next(line for line in file if line.strip()))

api_key = os.environ.get("ZILS_API_KEY")
if not api_key:
    raise SystemExit("Set ZILS_API_KEY to an API key from your Zils account.")

payload = {
    "model": ${model},
    "state": example["state"],
    "questions": {"decision": example["question"]},
}

request = Request(
    ${endpoint},
    data=json.dumps(payload).encode("utf-8"),
    headers={
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    },
    method="POST",
)
with urlopen(request, timeout=120) as response:
    print(json.dumps(json.load(response), indent=2))`,
  };
  return {
    filename: 'use-model.mjs',
    command: 'export ZILS_API_KEY="YOUR_API_KEY"\nnode use-model.mjs',
    code: `import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";

// Use a prepared JSONL file from this training run.
const lines = createInterface({
  input: createReadStream("train.jsonl", { encoding: "utf8" }),
});
let example;
for await (const line of lines) {
  if (line.trim()) { example = JSON.parse(line.trim()); break; }
}
if (!example) throw new Error("train.jsonl has no examples.");

const apiKey = process.env.ZILS_API_KEY;
if (!apiKey) throw new Error("Set ZILS_API_KEY to an API key from your Zils account.");

const response = await fetch(${endpoint}, {
  method: "POST",
  headers: {
    Authorization: "Bearer " + apiKey,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: ${model},
    state: example.state,
    questions: { decision: example.question },
  }),
  signal: AbortSignal.timeout(120000),
});
if (!response.ok) throw new Error("Zils returned " + response.status + ": " + await response.text());
console.log(JSON.stringify(await response.json(), null, 2));`,
  };
}
