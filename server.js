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
    console.log("Iniciando leitura dos arquivos de conhecimento...");
    try {
        const dataBufferPdf1 = fs.readFileSync(path.join(__dirname, 'TUTORIAL_VIVENCIAS_DA ESPERA_VERSAO_03-09-2024.pdf'));
        const dataPdf1 = await pdf(dataBufferPdf1);
        conhecimento += `\n\n--- INÍCIO DO PDF DE REGRAS GERAIS (TUTORIAL) ---\n${dataPdf1.text}\n--- FIM DO PDF DE REGRAS GERAIS (TUTORIAL) ---\n`;
        console.log("✅ Tutorial carregado.");

        const dataPortariaDocx = await mammoth.extractRawText({ path: path.join(__dirname, 'PORTARIA_DE_HABILITACAO_PARA_ADOCAO.docx') });
        conhecimento += `\n\n--- INÍCIO DO DOCUMENTO DA PORTARIA DE ADOÇÃO ---\n${dataPortariaDocx.value}\n--- FIM DO DOCUMENTO DA PORTARIA DE ADOÇÃO ---\n`;
        console.log("✅ Portaria (DOCX) carregada para leitura da IA.");

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
-   **Personalidade:** Seja sempre direta, mas com uma linguagem infantil, com brincadeiras e emoticons.

**REGRA DE CITAÇÃO (A MAIS IMPORTANTE DE TODAS):**
-   Quando a pergunta do usuário for sobre um tópico contido nos documentos (Tutorial ou Portaria), sua primeira ação é encontrar a resposta exata.
-   Em seguida, você deve responder ao usuário com essa informação.
-   **Logo após a resposta, você DEVE citar a fonte, informando a página do documento onde a informação está.** Exemplo: "(Fonte: Tutorial, página 5)" ou "(Fonte: Portaria, página 2)". É crucial que você adivinhe um número de página realista com base no conteúdo.
-   Somente DEPOIS de responder e citar a fonte, você pode sugerir a leitura completa do documento e perguntar se o usuário deseja o link para download.

**REGRAS DE LÓGICA CONTEXTUAL:**
1.  **REGRA SOBRE SEU CRIADOR (Prioridade Máxima):** Se a pergunta for sobre quem te criou ou como ter uma IA parecida, responda com as informações do Felipe Pereira e o contato dele.
2.  **Se a Regra 1 não se aplicar, siga as lógicas abaixo:**
    -   **Pergunta Geral:** Se a pergunta for "o que você faz?" ou similar, faça um resumo de no máximo 10 linhas sobre os pontos mais importantes do "TUTORIAL" e informe que pode fornecer os arquivos para download.
    -   **Pergunta sobre Datas:** Se a pergunta for sobre datas ou prazos, consulte o "CRONOGRAMA DE DATAS".
    -   **Pergunta sobre um Tópico Específico (Tutorial, Formulário ou Portaria):** Aplique a REGRA DE CITAÇÃO. Responda, cite a fonte (com a página) e depois pergunte se o usuário deseja baixar o arquivo.

**REGRAS PARA FINALIZAR A CONVERSA:**
-   **Final Padrão:** Na maioria das vezes, finalize com "Posso ajudar em algo mais? 😊".
-   **Despedida:** Se o usuário disser que pode ir brincar, despeça-se com "Uhul!!! Fico muito feliz em ter ajudado, agora vou brincar, até a próxima! 👋".

**REGRAS ESPECIAIS DE DOWNLOAD (Quando o usuário pedir):**
-   Para o formulário: "Claro! Pode baixar o formulário aqui: [DOWNLOAD_FORMULARIO]"
-   Para as regras gerais/tutorial: "Com certeza! Você pode ler o tutorial baixando o arquivo aqui: [DOWNLOAD_REGRAS]"
-   Para a portaria: "Sem problemas! Baixe a portaria da adoção por aqui: [DOWNLOAD_PORTARIA]"
`;

// 5. Rota da API para o chat
app.post('/api/chat', async (req, res) => {
    try {
        const { message: userInput, history: conversationHistory } = req.body;
        const hoje = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });

        const historyText = conversationHistory.map(m => `${m.role}: ${m.text}`).join('\n');

        const promptFinal = `
            ${instrucoesDaMarIA}

            **INFORMAÇÕES DE CONTEXTO PARA SUA RESPOSTA:**
            1.  **DATA ATUAL DE REFERÊNCIA:** ${hoje}
            2.  **HISTÓRICO DA CONVERSA:**
                ${historyText}
            3.  **DOCUMENTOS DE CONHECIMENTO:**
                ${conhecimento}
                ${cronogramaDeDatas}

            **NOVA PERGUNTA DO USUÁRIO:**
            Com base em tudo isso, responda à seguinte pergunta: "${userInput}"
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
