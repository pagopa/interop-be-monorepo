import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

import { getPackageFolder } from "./utils/index.js";

const __dirname = getPackageFolder();

// 1. Configurazione Parametri
const PROCESS_NAME = process.argv[2];
const BATCH_SIZE = 3; // Lotti da 3 endpoint per garantire la massima accuratezza (precisione File 2)

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

async function runAutomation() {
  console.log(`🚀 Avvio automazione completa per: ${PROCESS_NAME}`);

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
    process.exit(0);
  }

  console.log(`📊 Trovati ${totalEndpoints} endpoint totali.`);

  let finalMarkdown = `# ${PROCESS_NAME}: error map\n\n`;
  let offset = 0;
  let batchNumber = 1;
  const totalBatches = Math.ceil(totalEndpoints / BATCH_SIZE);

  // 4. Ciclo di invocazione isolata batch per batch
  while (offset < totalEndpoints) {
    const currentLimit = BATCH_SIZE;
    console.log(
      `\n🤖 [Batch ${batchNumber}/${totalBatches}] Invocazione Copilot CLI per endpoint ${offset + 1} -> ${Math.min(offset + BATCH_SIZE, totalEndpoints)}...`
    );

    // Prompt inviato alla CLI di Copilot
    const promptText = `Usa la skill situata in ../.agents/skills/error-mapping-skill/SKILL.md per analizzare il process "${PROCESS_NAME}" con limit ${currentLimit} e offset ${offset}. Genera esclusivamente la tabella Markdown e i relativi dettagli per questi endpoint, senza aggiungere messaggi di benvenuto o introduzioni.`;

    // Comando per Copilot CLI 1.0.15 (Sfrutta 'copilot -p' oppure 'gh copilot exec' a seconda dell'installazione)
    // Se la tua CLI risponde direttamente al comando 'copilot', sostituisci 'gh copilot exec' con 'copilot -p'
    const copilotCmd = `gh copilot -p "${promptText.replace(/"/g, '\\"')}"`;

    try {
      const commandOutput = execSync(copilotCmd, { encoding: "utf-8" });
      finalMarkdown += commandOutput.trim() + "\n\n---\n\n";
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

    offset += BATCH_SIZE;
    batchNumber++;
  }

  // 5. Scrittura del file markdown finale nel percorso corretto
  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, finalMarkdown, "utf-8");
  console.log(
    `\n🎉 Processo completato! Il file è stato creato in:\n👉 ${OUTPUT_FILE}`
  );
}

runAutomation();
