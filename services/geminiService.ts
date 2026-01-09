import { GoogleGenAI } from "@google/genai";
import { AuditRow } from "../types";

export const generateAuditAnalysis = async (data: AuditRow[]): Promise<string> => {
  // Optimize token usage: Only send the top 10 worst performing corridors (highest partial %)
  const sortedData = [...data].sort((a, b) => b.partialPercentage - a.partialPercentage).slice(0, 10);
  
  const prompt = `
    Analise os seguintes dados de uma "Auditoria de Etiqueta Parcial Loja 204".
    
    Contexto:
    - CORREDOR: Localização na loja.
    - SKU: Total de itens.
    - NÃO LIDOS: Itens onde a etiqueta não foi lida/encontrada.
    - PARCIAL %: Porcentagem de perda/erro.

    Dados (Top 10 piores casos):
    ${JSON.stringify(sortedData)}

    Instrução:
    Forneça um resumo executivo curto (máximo 3 parágrafos) em Português do Brasil. 
    Identifique os corredores críticos que precisam de atenção imediata da equipe de reposição/auditoria.
    Sugira uma ação corretiva genérica.
    Use formatação Markdown para deixar bonito.
  `;

  try {
    // Initializing with correct named parameter
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    // Using gemini-3-flash-preview for summarization/analysis tasks
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        temperature: 0.7,
      }
    });

    // Extracting text from response property (not a method)
    return response.text || "Não foi possível gerar a análise.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Erro ao conectar com a Inteligência Artificial.";
  }
};