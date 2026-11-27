// Disables each guard in src/plan.ts in turn and confirms the tests go red.
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

const FILE = new URL("../src/plan.ts", import.meta.url);
const original = readFileSync(FILE, "utf8");

const probes = [
  ["crop stays inside (x)", "const x = Math.round(Math.min(Math.max(cx - width / 2, 0), source.width - width));", "const x = Math.round(cx - width / 2);"],
  ["crop stays inside (y)", "const y = Math.round(Math.min(Math.max(cy - height / 2, 0), source.height - height));", "const y = Math.round(cy - height / 2);"],
  ["crop fits the photo", `  if (height > source.height) {
    height = source.height;
    width = Math.round(height * ratio);
  }`, ""],
  ["bad focus is neutralised", "(Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.5)", "v"],
  ["2000px recommendation", "shortest >= RECOMMENDED_SHORT_EDGE ?", "shortest >= 1500 ?"],
  ["too-small threshold", "shortest >= USABLE_SHORT_EDGE ?", "true ?"],
  ["large file flag", "bytes > SUGGESTED_MAX_BYTES", "false"],
  ["megapixel ceiling", "megapixels(size) > MAX_MEGAPIXELS", "false"],
  ["safe margin", "const mx = Math.round(rect.width * SAFE_MARGIN);", "const mx = 0;"],
];

let bad = 0;
try {
  for (const [name, from, to] of probes) {
    const n = original.split(from).length - 1;
    if (n !== 1) throw new Error(`${name}: anchor matched ${n} times`);
    writeFileSync(FILE, original.replace(from, to));
    let red = false;
    try {
      execSync("npx vitest run", { stdio: "ignore" });
    } catch {
      red = true;
    }
    console.log(`${red ? "red  " : "GREEN"}  ${name}`);
    if (!red) bad++;
  }
} finally {
  writeFileSync(FILE, original);
}
if (bad) {
  console.error(`${bad} guard(s) not covered`);
  process.exit(1);
}
console.log("every guard is covered");
