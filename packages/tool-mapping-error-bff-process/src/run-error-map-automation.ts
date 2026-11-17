import { execSync } from "child_process";
import * as fs from "fs";
import { spawnSync } from "node:child_process";
import * as path from "path";

import {
  buildResumeState,
  loadResumeState,
  saveResumeState,
  deleteResumeState,
} from "./resume-state.js";
import { getPackageFolder } from "./utils/index.js";

const __dirname = getPackageFolder();

export function executeCommand(command: string): string {
  const result = spawnSync(command, {
    shell: true,
    cwd: path.join(__dirname, ".."),
    stdio: "inherit",
  });

  if (result.status !== 0) {
    throw new Error(`Command "${command}" exited with code ${result.status}`);
  }
  return result.output.join("");
}

// 1. Configurazione Parametri
const PROCESS_NAME = process.argv[2];
const RESET_RESUME = process.argv.includes("--reset");
const BATCH_SIZE = 3; // Lotti da 3 endpoint per garantire la massima accuratezza

if (!PROCESS_NAME) {
  console.error(
    "❌ Errore: Specifica il nome del process.\nEsempio: pnpm exec tsx scripts/run-error-map-automation.ts purpose-process"
  );
  process.exit(1);
}

const OUTPUT_FILE = path.join(
  __dirname,
  `../packages/${PROCESS_NAME}-process/ENDPOINT-ERRORS.md`
);
const TMP_JSON_PATH = path.join(__dirname, "../tmp/endpoint-map.json");
const CHECKPOINT_PATH = path.join(
  __dirname,
  `../tmp/${PROCESS_NAME}-resume-state.json`
);

async function runAutomation() {
  console.log(`🚀 Avvio automazione completa per: ${PROCESS_NAME}`);

  if (RESET_RESUME) {
    deleteResumeState(CHECKPOINT_PATH);
    if (fs.existsSync(OUTPUT_FILE)) {
      fs.unlinkSync(OUTPUT_FILE);
    }
    console.log(
      `🧹 Reset richiesto: checkpoint e file finale rimossi per ${PROCESS_NAME}.`
    );
  }

  const currentCheckpoint = loadResumeState(CHECKPOINT_PATH, PROCESS_NAME);
  const initialOffset = currentCheckpoint?.offset ?? 0;
  let finalMarkdown =
    currentCheckpoint?.finalMarkdown ?? `# ${PROCESS_NAME}: error map\n\n`;

  if (fs.existsSync(OUTPUT_FILE) && !currentCheckpoint) {
    finalMarkdown = fs.readFileSync(OUTPUT_FILE, "utf-8");
  }

  if (currentCheckpoint) {
    console.log(
      `↩️ Riprendo il lavoro da offset ${initialOffset} per ${PROCESS_NAME}.`
    );
  }

  // 2. Scansione preliminare del process tramite il tool del monorepo
  console.log("📦 Estraggo la lista degli endpoint dal backend...");
  const scanCmd = `pnpm exec tsx src/index.ts --process ${PROCESS_NAME} --output ${TMP_JSON_PATH}`;

  try {
    execSync(scanCmd, {
      stdio: "pipe",
      cwd: path.join(__dirname, "tool-mapping-error-bff-process"),
    });
  } catch (error) {
    console.error(
      "❌ Errore durante l'esecuzione del generatore backend:",
      error
    );
    process.exit(1);
  }

  if (!fs.existsSync(TMP_JSON_PATH)) {
    console.error(
      `❌ Impossibile trovare il file generato in ${TMP_JSON_PATH}`
    );
    process.exit(1);
  }

  // 3. Calcolo del numero totale di endpoint
  const rawData = fs.readFileSync(TMP_JSON_PATH, "utf-8");
  const jsonContent = JSON.parse(rawData);
  const processData =
    jsonContent[`output.${PROCESS_NAME}`] ||
    jsonContent[PROCESS_NAME] ||
    jsonContent.output[PROCESS_NAME] ||
    [];
  const totalEndpoints = Array.isArray(processData) ? processData.length : 0;

  if (totalEndpoints === 0) {
    console.log("⚠️ Nessun endpoint trovato per questo process.");
    deleteResumeState(CHECKPOINT_PATH);
    process.exit(0);
  }

  const safeInitialOffset = Math.min(initialOffset, totalEndpoints);
  let offset = safeInitialOffset;
  let batchNumber = Math.floor(safeInitialOffset / BATCH_SIZE) + 1;
  const totalBatches = Math.ceil(totalEndpoints / BATCH_SIZE);

  console.log(`📊 Trovati ${totalEndpoints} endpoint totali.`);

  if (offset >= totalEndpoints) {
    console.log(
      "✅ Tutti gli endpoint sono già stati elaborati. Niente da fare."
    );
    deleteResumeState(CHECKPOINT_PATH);
    return;
  }

  // 4. Ciclo di invocazione isolata batch per batch
  while (offset < totalEndpoints) {
    const currentLimit = Math.min(BATCH_SIZE, totalEndpoints - offset);
    console.log(
      `\n🤖 [Batch ${batchNumber}/${totalBatches}] Invocazione Copilot CLI per endpoint ${offset + 1} -> ${Math.min(offset + currentLimit, totalEndpoints)}...`
    );

    const promptText = `Usa la skill situata in ./.agents/skills/error-mapping-skill/SKILL.md per analizzare il process "${PROCESS_NAME}" con limit ${currentLimit} e offset ${offset}.`;

    const frontendFolder = path.resolve(
      path.join(__dirname, "..", "..", "pdnd-interop-frontend")
    );
    const backendFolder = path.resolve(path.join(__dirname, ".."));

    const copilotCmd = `copilot --model mai-code-1.1-flash --add-dir "${backendFolder}" --add-dir "${frontendFolder}" -i "${promptText.replace(/"/g, '\\"')}"`;

    try {
      const commandOutput = executeCommand(copilotCmd);
      const batchMarkdown = commandOutput.trim() + "\n\n---\n\n";
      finalMarkdown += batchMarkdown;

      saveResumeState(
        CHECKPOINT_PATH,
        buildResumeState({
          processName: PROCESS_NAME,
          finalMarkdown,
          offset: offset + currentLimit,
          totalEndpoints,
        })
      );
      console.log(
        `✅ [Batch ${batchNumber}/${totalBatches}] Completato con successo!`
      );
    } catch (err) {
      console.error(
        `❌ Errore durante l'elaborazione del batch ${batchNumber}:`,
        err
      );
      console.log("⚠️ Interruzione automazione per errore nel batch.");
      break;
    }

    offset += currentLimit;
    batchNumber++;
  }

  if (offset >= totalEndpoints) {
    deleteResumeState(CHECKPOINT_PATH);
    console.log(
      `\n🎉 Processo completato! Il file è stato creato in:\n👉 ${OUTPUT_FILE}`
    );
    return;
  }

  console.log(
    `⏸️ Lavoro interrotto: il prossimo rilancio riprenderà da offset ${offset}.`
  );
}

runAutomation();
