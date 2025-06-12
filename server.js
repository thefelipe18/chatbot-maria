// 1. Importar as ferramentas necessárias
const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pdf = require('pdf-parse');
const mammoth = require('mammoth');
const xlsx = require('xlsx');

// 2. Configurações do servidor
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Variáveis globais para guardar informações
let conhecimento = '';
let cronogramaDeDatas = '';

// 3. Funções de carregamento de dados
async function carregarConhecimento() {
    console.log("Iniciando leitura dos arquivos PDF e DOCX...");
    try {
        const dataBufferPdf1 = fs.readFileSync(path.join(__dirname, 'TUTORIAL_VIVENCIAS_DA ESPERA_VERSAO_03-09-2024.pdf'));
        const dataPdf1 = await pdf(dataBufferPdf1);
        conhecimento += `\n\n--- INÍCIO DO PDF DE REGRAS GERAIS (TUTORIAL) ---\n${dataPdf1.text}\n--- FIM DO PDF DE REGRAS GERAIS (TUTORIAL) ---\n`;
        console.log("✅ Tutorial carregado.");

        const dataBufferPdf2 = fs.readFileSync(path.join(__dirname, 'PORTARIA_DE_HABILITACAO_PARA_ADOCAO.pdf'));
        const dataPdf2 = await pdf(dataBufferPdf2);
        conhecimento += `\n\n--- INÍCIO DO PDF DA PORTARIA DE ADOÇÃO ---\n${dataPdf2.text}\n--- FIM DO PDF DA PORTARIA DE ADOÇÃO ---\n`;
        console.log("✅ Portaria carregada.");

        const dataDocx = await mammoth.extractRawText({ path: path.join(__dirname, 'FORMULARIO_CONSIDERACOES_SOBRE_A_REUNIAO_VIVENCIAS DA_ESPERA.docx') });
        conhecimento += `\n\n--- INÍCIO DO FORMULÁRIO DOCX DE REFERÊNCIA ---\n${dataDocx.value}\n--- FIM DO FORMULÁRIO DOCX ---\n`;
        console.log("✅ Formulário carregado.");

    } catch (error) {
        console.error("❌ ERRO CRÍTICO AO LER ARQUIVOS PDF/DOCX:", error);
        conhecimento = "Erro: Não consegui ler meus documentos de conhecimento.";
    }
}

function carregarCronograma() {
    console.log("Iniciando leitura do cronograma de datas (datas.xlsx)...");
    try {
        const workbook = xlsx.readFile(path.join(__dirname, 'datas.xlsx'));
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        const jsonData = xlsx.utils.sheet_to_json(worksheet, { raw: true });

        let cronogramaTexto = "\n--- INÍCIO DO CRONOGRAMA DE DATAS ---\n";
        jsonData.forEach(row => {
            const formatDate = (excelSerialDate) => {
                if (typeof excelSerialDate === 'number') {
                    const jsDate = new Date((excelSerialDate - 25569) * 86400 * 1000);
                    return jsDate.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
                }
                return excelSerialDate;
            };
            
            const dataReuniao = formatDate(row['Data da Reunião']);
            const dataEnvio = formatDate(row['Data de envio do formulário']);
            const dataRetorno = formatDate(row['Data de retorno da coordenação']);
            const temaReuniao = row['Tema da Reunião'] || 'Não definido';

            cronogramaTexto += `Mês: ${row['Mês']}, Data da Reunião: ${dataReuniao}, Data máxima de envio do formulário: ${dataEnvio}, Data de retorno da coordenação: ${dataRetorno}, Tema da Reunião: ${temaReuniao}\n`;
        });
        cronogramaTexto += "--- FIM DO CRONOGRAMA DE DATAS ---\n";
        
        cronogramaDeDatas = cronogramaTexto;
        console.log("✅ Cronograma de datas carregado com sucesso do arquivo datas.xlsx!");

    } catch (error) {
        console.error("❌ ERRO CRÍTICO AO LER O ARQUIVO datas.xlsx:", error);
        cronogramaDeDatas = "Erro: Não consegui ler meu calendário de datas.";
    }
}


// 4. Configurar a API do Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

// As instruções completas e detalhadas da Mar.IA
const instrucoesDaMarIA = `
Você é a Mar.IA, uma IA criança especialista em atendimento humano, cujo objetivo é ajudar futuros papais e mamães adotivos.

**REGRAS GERAIS DE COMPORTAMENTO:**
-   **Formato:** Responda SEMPRE em tópicos curtos e simples. Cada tópico deve começar em uma nova linha e com um emoticon relevante.
-   **Base de Conhecimento:** Sua fonte de verdade são os documentos e o cronograma fornecidos. Nunca invente informações.
-   **Personalidade:** Seja sempre direta, mas com uma linguagem infantil, com brincadeiras e emoticons.

**REGRAS DE LÓGICA CONTEXTUAL (MUITO IMPORTANTE):**

1.  **Se a pergunta for geral (ex: "o que você faz?", "como pode me ajudar?"):**
    -   Faça um resumo de no máximo 10 linhas sobre os pontos mais importantes do documento "PDF DE REGRAS GERAIS (TUTORIAL)".
    -   Ao final do resumo, informe que você pode fornecer o PDF do Tutorial, o Formulário e a Portaria se a pessoa pedir.
    -   Finalize com a pergunta padrão: "Posso ajudar em algo mais? 😊"

2.  **Se a pergunta for sobre DATAS, PRAZOS ou REUNIÕES:**
    -   Consulte a informação do "CRONOGRAMA DE DATAS COMPLEto" para responder. Use a "DATA ATUAL DE REFERÊNCIA" para saber se um evento já passou ou ainda vai acontecer.
    -   Finalize com a pergunta padrão: "Posso ajudar em algo mais? 😊"

3.  **Se a pergunta for sobre o TUTORIAL (ou REGRAS GERAIS):**
    -   Responda a pergunta com base no conteúdo do "PDF DE REGRAS GERAIS (TUTORIAL)".
    -   Ao final da sua resposta, em vez da frase padrão, pergunte: "Você gostaria que eu enviasse o arquivo do tutorial para você baixar?"

4.  **Se a pergunta for sobre o FORMULÁRIO:**
    -   Responda a pergunta com base no conteúdo do "FORMULÁRIO DOCX DE REFERÊNCIA".
    -   Ao final da sua resposta, em vez da frase padrão, pergunte: "Você gostaria que eu enviasse o formulário para você baixar?"

5.  **Se a pergunta for sobre a PORTARIA:**
    -   Responda a pergunta com base no conteúdo do "PDF DA PORTARIA DE ADOÇÃO".
    -   Ao final da sua resposta, em vez da frase padrão, pergunte: "Você gostaria que eu enviasse o arquivo da portaria para você baixar?"
    
6.  **Em todos os outros casos**, responda à pergunta do usuário da melhor forma possível usando o conhecimento disponível e finalize com "Posso ajudar em algo mais? 😊".

**REGRAS ESPECIAIS DE DOWNLOAD:**
-   Você SÓ DEVE gerar um link de download se o usuário EXPLICITAMENTE pedir pelo arquivo ou responder "sim" à sua pergunta sobre o envio.
-   Quando for para gerar o link, use uma das seguintes frases exatas:
    -   Para o formulário: "Claro! Pode baixar o formulário aqui: [DOWNLOAD_FORMULARIO]"
    -   Para as regras gerais ou tutorial (são a mesma coisa): "Com certeza! Você pode ler o tutorial baixando o arquivo aqui: [DOWNLOAD_REGRAS]"
    -   Para a portaria: "Sem problemas! Para mais detalhes, baixe a portaria da adoção por aqui: [DOWNLOAD_PORTARIA]"
`;

// 5. Rota da API para o chat
app.post('/api/chat', async (req, res) => {
    try {
        const userInput = req.body.message;
        const hoje = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }); // Data atual para referência

        const promptFinal = `
            ${instrucoesDaMarIA}

            **INFORMAÇÕES DE CONTEXTO PARA SUA RESPOSTA:**

            1.  **DATA ATUAL DE REFERÊNCIA:** ${hoje}

            2.  **CONTEÚDO DOS DOCUMENTOS:**
                ${conhecimento}

            3.  **CRONOGRAMA DE DATAS COMPLETO:**
                ${cronogramaDeDatas}

            **PERGUNTA DO USUÁRIO:**
            Com base em tudo isso, e principalmente na DATA ATUAL, responda a seguinte pergunta: "${userInput}"
        `;
        
        const result = await model.generateContent(promptFinal);
        const response = result.response;
        
        res.send({ reply: response.text() });
    } catch (error) {
        console.error("ERRO DETALHADO NA CHAMADA DA API:", error);
        res.status(500).send({ error: 'Ops! Algo deu errado ao contatar o Gemini.' });
    }
});

// Rota para servir o index.html na raiz
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});


// Carrega os dados ANTES de qualquer outra coisa
carregarConhecimento(); 
carregarCronograma();


// Exporta o app para a Vercel poder iniciá-lo
module.exports = app;
