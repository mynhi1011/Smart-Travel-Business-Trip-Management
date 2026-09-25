const fs = require('node:fs');
const path = require('node:path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const dotenv = require('dotenv');

const BACKEND_DIR = path.resolve(__dirname, '..');
const MODEL_NAME = 'gemini-3.8-flash';
const API_VERSION = 'v1beta';
const PROMPT = 'Return exactly: GEMINI_OK';
const MAX_ATTEMPTS = 3;
const RETRY_BASE_MS = 500;

const packageJson = JSON.parse(fs.readFileSync(path.join(BACKEND_DIR, 'package.json'), 'utf8'));
const sdkPackage = JSON.parse(fs.readFileSync(
  path.join(BACKEND_DIR, 'node_modules', '@google', 'generative-ai', 'package.json'),
  'utf8',
));
const sdkVersion = sdkPackage.version;
dotenv.config({ path: path.join(BACKEND_DIR, '.env') });
const apiKey = process.env.GEMINI_API_KEY;

function redact(value) {
  return String(value ?? '')
    .replaceAll(apiKey || '\u0000', '[REDACTED]')
    .replace(/([?&]key=)[^&\s]+/gi, '$1[REDACTED]')
    .slice(0, 700);
}

function logResult({ model, status, errorCode, providerMessage, latencyMs, attempt }) {
  console.log(JSON.stringify({
    model,
    status,
    errorCode: errorCode ?? null,
    providerMessage: redact(providerMessage),
    latencyMs,
    ...(attempt ? { attempt } : {}),
  }));
}

function classifyHttpStatus(status) {
  if (status === 401 || status === 403) return 'API key or permission error';
  if (status === 429) return 'quota or rate limit';
  if (status === 503) return 'provider unavailable/overloaded';
  if (status >= 500) return 'provider/server error';
  if (status === 200) return 'Gemini available';
  return 'request/configuration error';
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function listModels() {
  const startedAt = Date.now();
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/${API_VERSION}/models?key=${encodeURIComponent(apiKey)}`,
    );
    const body = await response.json();
    const models = Array.isArray(body.models) ? body.models : [];
    const supported = models
      .filter(model => (model.supportedGenerationMethods || []).includes('generateContent'))
      .map(model => ({ name: model.name.replace(/^models\//, ''), methods: model.supportedGenerationMethods }));
    const message = response.ok
      ? `Listed ${supported.length} generateContent-capable models for the configured key.`
      : body.error?.message || response.statusText;
    logResult({
      model: 'models.list',
      status: response.status,
      errorCode: body.error?.status || body.error?.code,
      providerMessage: message,
      latencyMs: Date.now() - startedAt,
    });
    return { status: response.status, supported };
  } catch (error) {
    logResult({
      model: 'models.list',
      status: 'NETWORK_ERROR',
      errorCode: error.code || error.name,
      providerMessage: error.message,
      latencyMs: Date.now() - startedAt,
    });
    return { status: 0, supported: [] };
  }
}

async function generateWithModel(client, modelName) {
  const model = client.getGenerativeModel({ model: modelName });
  let lastResult;
  let saw503 = false;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const startedAt = Date.now();
    try {
      const result = await model.generateContent(PROMPT);
      const text = result.response.text().trim();
      lastResult = { status: 200, errorCode: null, providerMessage: text || 'Empty model response.' };
      logResult({ model: modelName, ...lastResult, latencyMs: Date.now() - startedAt, attempt });
      return { ...lastResult, exactMatch: text === 'GEMINI_OK', saw503 };
    } catch (error) {
      const status = Number(error.status) || 'SDK_ERROR';
      if (status === 503) saw503 = true;
      lastResult = {
        status,
        errorCode: error.code || error.status || error.name,
        providerMessage: error.message || error.statusText,
      };
      logResult({ model: modelName, ...lastResult, latencyMs: Date.now() - startedAt, attempt });
      if (status !== 503 || attempt === MAX_ATTEMPTS) break;
      await wait(RETRY_BASE_MS * (2 ** (attempt - 1)));
    }
  }

  return { ...lastResult, exactMatch: false, saw503 };
}

async function main() {
  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    logResult({
      model: 'configuration',
      status: 'NOT_CONFIGURED',
      errorCode: 'GEMINI_API_KEY_MISSING',
      providerMessage: 'GEMINI_API_KEY is absent, empty, or still the example placeholder in backend .env.',
      latencyMs: 0,
    });
    process.exitCode = 1;
    return;
  }

  logResult({
    model: 'configuration',
    status: 'READY',
    errorCode: null,
    providerMessage: `Backend key is present; SDK ${sdkVersion} (manifest ${packageJson.dependencies['@google/generative-ai']}); API version ${API_VERSION}; key value withheld.`,
    latencyMs: 0,
  });

  const modelsResult = await listModels();
  const client = new GoogleGenerativeAI(apiKey);
  const currentResult = await generateWithModel(client, MODEL_NAME);

  let alternateResult = null;
  if (currentResult.saw503) {
    const alternative = modelsResult.supported.find(model =>
      model.name !== MODEL_NAME &&
      model.name === 'gemini-3.7-flash',
    ) || modelsResult.supported.find(model =>
      model.name !== MODEL_NAME &&
      /gemini.*flash/i.test(model.name) &&
      !/preview|image|tts/i.test(model.name),
    );

    if (alternative) {
      alternateResult = await generateWithModel(client, alternative.name);
    } else {
      logResult({
        model: 'alternative-model',
        status: 'NOT_FOUND',
        errorCode: 'NO_ALTERNATIVE_LISTED',
        providerMessage: 'models.list returned no alternative Flash model supporting generateContent.',
        latencyMs: 0,
      });
    }
  }

  const currentOk = currentResult.status === 200 && currentResult.exactMatch;
  const alternateOk = alternateResult?.status === 200 && alternateResult.exactMatch;
  console.log(JSON.stringify({
    conclusion: currentOk || alternateOk ? 'GEMINI_GENERATE_CONTENT_WORKS' : classifyHttpStatus(currentResult.status),
    currentModel: MODEL_NAME,
    currentModelStatus: currentResult.status,
    alternateModelStatus: alternateResult?.status ?? null,
  }));
  if (!currentOk && !alternateOk) process.exitCode = 1;
}

main().catch(error => {
  logResult({
    model: 'diagnostic-script',
    status: 'SCRIPT_ERROR',
    errorCode: error.code || error.name,
    providerMessage: error.message,
    latencyMs: 0,
  });
  process.exitCode = 1;
});
