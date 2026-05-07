/**
 * Lista de alunos ignorados manualmente.
 *
 * A persistência é feita via `config.alunosIgnorados` (em config.js, salvo
 * em localStorage). Este módulo encapsula:
 *   - adicionar/remover alunos
 *   - exportar/importar a lista como JSON (backup entre máquinas)
 */

import { config, saveConfig } from "../config.js";
import { toast } from "../ui/toast.js";

/**
 * Adiciona um aluno à lista de ignorados.
 * Usa e-mail (lowercase) como chave preferencial; cai no ID Canvas
 * como fallback (alunos sem SIS Login ID mas com atividades reais).
 *
 * @param {{ name: string, email: string, id: string }} row
 * @returns {boolean} true se foi adicionado, false caso contrário (sem chave ou cancelado)
 */
export function ignorarAluno(row) {
  const chave = (row.email || "").toLowerCase().trim() || (row.id || "").trim();
  if (!chave) {
    toast("Aluno sem e-mail nem ID Canvas — não é possível ignorar.", "error");
    return false;
  }
  const confirmado = confirm(
    `Ignorar "${row.name}" das próximas análises?\n\nVocê pode reverter em ⚙️ Configurações.`
  );
  if (!confirmado) return false;

  if (!config.alunosIgnorados.some((i) => i.chave === chave)) {
    config.alunosIgnorados.push({
      chave,
      nome: row.name || "",
      quando: new Date().toISOString(),
    });
    saveConfig();
  }
  return true;
}

/** Remove um aluno da lista de ignorados pela chave. */
export function desfazerIgnorar(chave) {
  config.alunosIgnorados = config.alunosIgnorados.filter((i) => i.chave !== chave);
  saveConfig();
}

/** Exporta a lista atual como arquivo JSON (formato versionado). */
export function exportarListaIgnorados() {
  if (!config.alunosIgnorados.length) {
    toast("Nenhum aluno na lista para exportar.", "info");
    return;
  }
  const payload = {
    versao: 1,
    exportadoEm: new Date().toISOString(),
    alunosIgnorados: config.alunosIgnorados,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `alunos_ignorados_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast(`${config.alunosIgnorados.length} aluno(s) exportado(s) para backup. ✅`);
}

/**
 * Abre seletor de arquivo, lê o JSON e oferece MESCLAR ou SUBSTITUIR a lista.
 *
 * @param {() => void} [onAfterImport]  Callback invocado após importação concluída
 *                                       — usado pelo chamador para reprocessar a UI.
 */
export function importarListaIgnorados(onAfterImport) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json,.json";
  input.addEventListener("change", () => {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const payload = JSON.parse(reader.result);
        let lista;
        if (Array.isArray(payload)) {
          lista = payload;
        } else if (payload && Array.isArray(payload.alunosIgnorados)) {
          lista = payload.alunosIgnorados;
        } else {
          throw new Error("Formato não reconhecido.");
        }

        // Normaliza strings legadas → objetos.
        lista = lista
          .map((item) => (typeof item === "string" ? { chave: item, quando: null } : item))
          .filter((i) => i && i.chave);

        if (!lista.length) {
          toast("Arquivo vazio ou inválido.", "error");
          return;
        }

        const mesclar = confirm(
          `Importar ${lista.length} aluno(s) ignorado(s).\n\n` +
            `OK = MESCLAR com a lista atual (${config.alunosIgnorados.length} já existentes)\n` +
            `Cancelar = SUBSTITUIR a lista atual`
        );

        if (mesclar) {
          lista.forEach((item) => {
            if (!config.alunosIgnorados.some((i) => i.chave === item.chave)) {
              config.alunosIgnorados.push(item);
            }
          });
        } else {
          config.alunosIgnorados = lista;
        }

        saveConfig();
        toast(`Lista importada (${config.alunosIgnorados.length} alunos no total). ✅`);
        if (typeof onAfterImport === "function") onAfterImport();
      } catch (err) {
        toast("Arquivo inválido: " + err.message, "error");
      }
    };
    reader.readAsText(file);
  });
  input.click();
}
