
import * as XLSX from 'xlsx';
import { AuditRow, RawExcelRow, ProductClassResult, ClassDetailRow, HistoryItem, UserProfile } from '../types';

/**
 * Remove duplicatas e prefixos, exibindo apenas a primeira parte do nome.
 * Ex: "204 - CO02 - CO02" vira "CO02"
 * Ex: "F01 - F01" vira "F01"
 */
const sanitizeName = (name: string): string => {
  if (!name) return "Desconhecido";

  // 1. Remove prefixo de loja (ex: "204 - " ou "Loja 204 -")
  let cleaned = name.replace(/^(Loja\s+)?\d+\s*-\s*/i, "").trim();

  // 2. Divide por hífens (comuns, en-dash, em-dash) ou barras
  // Pega estritamente a primeira parte que contenha conteúdo
  const parts = cleaned.split(/[-\u2013\u2014\/]/).map(p => p.trim()).filter(p => p !== "");

  return parts.length > 0 ? parts[0] : cleaned;
};

/**
 * Converte data serial do Excel (ex: 45231) para string formatada DD/MM/AAAA
 */
const formatExcelDate = (value: any): string => {
  if (!value) return "";
  if (typeof value === 'number') {
    // Excel base date is 1899-12-30
    const date = new Date(Math.round((value - 25569) * 86400 * 1000));
    return date.toLocaleDateString('pt-BR');
  }
  return String(value);
};

/**
 * Busca valor em um objeto de forma insensível a maiúsculas/minúsculas e acentos
 */
const findValueByPossibleKeys = (row: any, keywords: string[]): any => {
  const keys = Object.keys(row);
  const normalizedKeywords = keywords.map(k => k.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));

  for (const key of keys) {
    const normalizedKey = key.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (normalizedKeywords.some(k => normalizedKey.includes(k) || k.includes(normalizedKey))) {
      return row[key];
    }
  }
  return undefined;
};

export const parseExcelFile = (file: File): Promise<AuditRow[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) {
          reject("No data read from file");
          return;
        }

        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        const jsonData = XLSX.utils.sheet_to_json<RawExcelRow>(worksheet);
        const processedData: AuditRow[] = [];

        jsonData.forEach((row, index) => {
          if (index === 0) return;

          const normalizedRow: { [key: string]: string | number } = {};
          Object.keys(row).forEach(key => {
            normalizedRow[key.trim()] = row[key];
          });

          const values = Object.values(normalizedRow).map(String);
          if (values.includes("204 - Av Recife - PE")) return;

          const rawCorridor = normalizedRow["Auditado em"] ? String(normalizedRow["Auditado em"]) : "Desconhecido";
          const corridor = sanitizeName(rawCorridor);

          const sku = Number(normalizedRow["Itens com Estoque"] || 0);

          let rawNotRead = normalizedRow["Não Lidas com Estoque"];
          if (rawNotRead === undefined) {
            rawNotRead = normalizedRow["Ruptura 1ª"];
          }
          const notRead = Number(rawNotRead || 0);

          if (sku === 0) return;
          if (!normalizedRow["Auditado em"] && !normalizedRow["Itens com Estoque"]) return;

          let partialPercentage = 0;
          if (sku > 0) {
            partialPercentage = (notRead / sku) * 100;
          }

          processedData.push({
            id: `row-${index}-${Date.now()}`,
            corridor,
            sku,
            notRead,
            outdated: 0,
            partialPercentage
          });
        });

        resolve(processedData);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = (error) => reject(error);
    reader.readAsBinaryString(file);
  });
};

export const parseAnalysisFile = (file: File): Promise<AuditRow[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) {
          reject("No data read from file");
          return;
        }

        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        const jsonData = XLSX.utils.sheet_to_json<RawExcelRow>(worksheet);
        const processedData: AuditRow[] = [];

        const firstRowKeys = jsonData.length > 0 ? Object.keys(jsonData[0]).map(k => k.trim().toLowerCase()) : [];
        const hasOutdatedColumn = firstRowKeys.some(k => k === 'desatualizado' || k === 'desatualizados');

        jsonData.forEach((row, index) => {
          if (index === 0) return;

          const normalizedRow: { [key: string]: string | number } = {};
          Object.keys(row).forEach(key => {
            normalizedRow[key.trim()] = row[key];
          });

          let rawDescription = normalizedRow["Descrição"] ? String(normalizedRow["Descrição"]) : "Desconhecido";
          if (rawDescription.includes("204 - Av Recife - PE")) return;

          const corridor = sanitizeName(rawDescription);
          const sku = Number(normalizedRow["Qtde Total"] || normalizedRow["QTDE TOTAL"] || 0);

          if (sku === 0) return;

          let rawNotRead = normalizedRow["Não lidos"] || normalizedRow["Não Lidos"] || normalizedRow["não lidos"] || 0;
          if (typeof rawNotRead === 'string') {
            rawNotRead = rawNotRead.split('(')[0].trim();
          }
          const notRead = Number(rawNotRead) || 0;

          const outdated = hasOutdatedColumn
            ? Number(normalizedRow["Desatualizado"] || normalizedRow["Desatualizados"] || normalizedRow["desatualizados"] || 0)
            : undefined;

          if (!normalizedRow["Descrição"] && !normalizedRow["Qtde Total"]) return;

          let partialPercentage = 0;
          if (sku > 0) {
            partialPercentage = (notRead / sku) * 100;
          }

          processedData.push({
            id: `row-analysis-${index}-${Date.now()}`,
            corridor,
            sku,
            notRead,
            outdated,
            partialPercentage
          });
        });

        resolve(processedData);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = (error) => reject(error);
    reader.readAsBinaryString(file);
  });
};

export const parseProductClassFile = (file: File): Promise<ProductClassResult> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) {
          reject("No data read from file");
          return;
        }

        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        const jsonData = XLSX.utils.sheet_to_json<RawExcelRow>(worksheet);

        const classCounts: { [key: string]: number } = {};
        const collaboratorStats: { [key: string]: number } = {};
        const details: ClassDetailRow[] = [];

        const categoryStats = {
          semEstoque: 0,
          desatualizado: 0,
          naoLidoComEstoque: 0,
          semPresencaComEstoque: 0
        };

        jsonData.forEach((row) => {
          const normalizedRow: { [key: string]: string | number } = {};
          Object.keys(row).forEach(key => {
            normalizedRow[key.trim()] = row[key];
          });

          const rootClass = normalizedRow["Classe de Produto Raiz"];
          const status = normalizedRow["Situação"] ? String(normalizedRow["Situação"]).trim() : "";

          if (!status) return;

          const statusLower = status.toLowerCase();

          const rawStock = normalizedRow["Estoque atual"];
          let stock = 0;
          if (typeof rawStock === 'number') {
            stock = rawStock;
          } else {
            const strStock = String(rawStock || "0").trim();
            const cleanStock = strStock.replace(/[^\d,.-]/g, '').replace(',', '.');
            stock = parseFloat(cleanStock);
          }
          if (isNaN(stock)) stock = 0;

          const isOutOfStock = statusLower.includes('sem estoque');
          const isOutdated = statusLower.includes('desatualizado');

          const isNoRead = (statusLower.includes('não lido') || statusLower.includes('não lidos')) && statusLower.includes('estoque');
          const isNoPresence = statusLower.includes('sem presença') && statusLower.includes('estoque');

          if (isOutOfStock) {
            categoryStats.semEstoque++;
          } else if (isOutdated) {
            categoryStats.desatualizado++;
          } else if (isNoRead || isNoPresence) {
            if (stock > 0 || statusLower.includes('com estoque')) {
              if (isNoRead) categoryStats.naoLidoComEstoque++;
              else categoryStats.semPresencaComEstoque++;

              const classStr = sanitizeName(rootClass ? String(rootClass) : "OUTROS");
              classCounts[classStr] = (classCounts[classStr] || 0) + 1;
            }
          }

          const rawUserValue = normalizedRow["Usuário"] || normalizedRow["Colaborador"];
          let collaboratorName = "";
          if (rawUserValue) {
            const rawUserStr = String(rawUserValue).trim();
            const userMatch = rawUserStr.match(/\(([^)]+)\)/);
            const extracted = userMatch ? userMatch[1].trim() : rawUserStr;
            const upperExtracted = extracted.toUpperCase();

            if (upperExtracted && upperExtracted !== "S/N" && upperExtracted !== "SN") {
              collaboratorName = upperExtracted;
              collaboratorStats[collaboratorName] = (collaboratorStats[collaboratorName] || 0) + 1;
            }
          }

          const isRelevant = isOutOfStock || isOutdated || isNoRead || isNoPresence;

          if (isRelevant) {
            // Detecção mais robusta de colunas para Dias sem Venda e Última Compra
            const daysWithoutSale = findValueByPossibleKeys(normalizedRow, ["Dias sem Venda", "Dias s/ Venda", "Dias sem venda", "Dias s Venda"]) || "";
            const lastPurchaseRaw = findValueByPossibleKeys(normalizedRow, ["Dt. Ult. Compra", "Ultima Compra", "Data Ult. Compra", "Data Ultima Compra", "Dt. Ult. Cpa", "Ultima Entrada", "Dt. Entrada"]) || "";
            const lastPurchase = formatExcelDate(lastPurchaseRaw);

            details.push({
              c: normalizedRow["Código"] || "",
              p: String(normalizedRow["Produto"] || ""),
              e: stock,
              r: sanitizeName(rootClass ? String(rootClass) : "OUTROS"),
              l: String(normalizedRow["Local"] || "S/N"),
              s: status,
              d: daysWithoutSale,
              u: String(lastPurchase)
            });
          }
        });

        const summary: AuditRow[] = Object.entries(classCounts)
          .map(([className, count], index) => ({
            id: `row-class-${index}-${Date.now()}`,
            corridor: className,
            sku: count,
            notRead: count,
            partialPercentage: 100
          }))
          .sort((a, b) => b.notRead - a.notRead);

        resolve({ summary, details, categoryStats, collaboratorStats });
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = (error) => reject(error);
    reader.readAsBinaryString(file);
  });
};

export const exportWeeklySummaryToExcel = (summaryData: any[]) => {
  if (!summaryData || summaryData.length === 0) return;

  const workbook = XLSX.utils.book_new();

  const daysConfig = [
    { key: 'monday', label: 'Segunda', hasOutdated: true },
    { key: 'tuesday', label: 'Terça', hasOutdated: false },
    { key: 'wednesday', label: 'Quarta', hasOutdated: false },
    { key: 'thursday', label: 'Quinta', hasOutdated: true }
  ];

  daysConfig.forEach(day => {
    const dayRows = summaryData
      .filter(store => store[day.key] !== null)
      .map(store => {
        const item = store[day.key];
        const row: any = {
          "Loja": store.loja,
          "SKU": item.stats.totalSku,
          "Não lidos": item.stats.totalNotRead,
        };

        if (day.hasOutdated) {
          row["Desatualizado"] = item.stats.totalOutdated || item.categoryStats?.desatualizado || 0;
        }

        row["Resultado%"] = `${(Math.floor(item.stats.generalPartial * 100) / 100).toFixed(2)}%`;

        return row;
      });

    if (dayRows.length > 0) {
      const worksheet = XLSX.utils.json_to_sheet(dayRows);
      const wscols = [
        { wch: 10 },
        { wch: 12 },
        { wch: 12 },
      ];
      if (day.hasOutdated) {
        wscols.push({ wch: 15 });
      }
      wscols.push({ wch: 15 });
      worksheet['!cols'] = wscols;
      XLSX.utils.book_append_sheet(workbook, worksheet, day.label);
    }
  });

  const today = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
  XLSX.writeFile(workbook, `Resumo_Semanal_Consolidado_${today}.xlsx`);
};
