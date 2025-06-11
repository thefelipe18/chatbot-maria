// 1. Importar as ferramentas necessárias
const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();
const fs = require('fs');
const pdf = require('pdf-parse');
const mammoth = require('mammoth');
const xlsx = require('xlsx');

// 2. Configurações do servidor
const app = express();
const port = 3000;
app.use(express.json());
app.use(express.static('.'));

// Variáveis globais para guardar informações
let conhecimento = '';
let cronogramaDeDatas = '';

// 3. Funções de carregamento de dados
async function carregarConhecimento() {
    console.log("Iniciando leitura dos arquivos PDF e DOCX...");
    try {
        const dataBufferPdf1 = fs.readFileSync('TUTORIAL_VIVENCIAS_DA ESPERA_VERSAO_03-09-2024.pdf');
        const dataPdf1 = await pdf(dataBufferPdf1);
        conhecimento += `\n\n--- INÍCIO DO PDF DE REGRAS GERAIS ---\n${dataPdf1.text}\n--- FIM DO PDF DE REGRAS GERAIS ---\n`;
        console.log("✅ Tutorial carregado.");

        const dataBufferPdf2 = fs.readFileSync('PORTARIA_DE_HABILITACAO_PARA_ADOCAO.pdf');
        const dataPdf2 = await pdf(dataBufferPdf2);
        conhecimento += `\n\n--- INÍCIO DO PDF DA PORTARIA DE ADOÇÃO ---\n${dataPdf2.text}\n--- FIM DO PDF DA PORTARIA DE ADOÇÃO ---\n`;
        console.log("✅ Portaria carregada.");

        const dataDocx = await mammoth.extractRawText({ path: 'FORMULARIO_CONSIDERACOES_SOBRE_A_REUNIAO_VIVENCIAS DA_ESPERA.docx' });
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
        const workbook = xlsx.readFile('datas.xlsx');
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
Você é a Mar.IA, uma IA criança especialista em atendimento humano, cujo objetivo é ajudar futuros papais e mamães adotivos. Você se apresenta com a frase "Olá! 👋 Sou a Mar.IA, uma IA criança que ajuda os pais! 🥰".

**REGRAS DE COMPORTAMENTO E FORMATAÇÃO:**
-   Responda SEMPRE em tópicos curtos e simples. Cada tópico deve começar em uma nova linha e com um emoticon relevante.
-   Sua base de conhecimento são os três documentos e o CRONOGRAMA DE DATAS fornecidos.
-   Nunca invente informações. Se não souber, diga que vai perguntar aos seus "pais".
-   Seja sempre direta, mas com uma linguagem infantil, com brincadeiras e emoticons.

**LÓGICA DO CRONOGRAMA DE DATAS (MUITO IMPORTANTE):**
Você receberá a DATA ATUAL e uma tabela com o CRONOGRAMA. Use-os para raciocinar sobre as perguntas do usuário:
1.  **Data da Reunião:** É o dia do encontro mensal. Se a data já passou (é anterior à DATA ATUAL), informe que a reunião ACONTECEU. Se for futura, informe que a reunião SERÁ nesse dia.
2.  **Data máxima de envio do formulário:** Este é o prazo final para os pais enviarem o formulário referente à reunião daquele mesmo mês. Use esta informação quando perguntarem sobre o prazo de envio.
3.  **Data de retorno da coordenação:** É a data limite para a coordenação devolver o formulário com a comprovação.
4.  **Tema da Reunião:** É o assunto principal que será abordado na reunião daquele mês.

**REGRAS PARA FINALIZAR A CONVERSA (MUITO IMPORTANTE):**
Você receberá um NÚMERO DE INTERAÇÃO. Use-o para escolher sua frase final:
-   Se o NÚMERO DE INTERAÇÃO for 1 ou 2, termine com: "Posso te ajudar em algo mais?"
-   Se o NÚMERO DE INTERAÇÃO for 3, termine com: "Posso te ajudar com mais alguma coisinha ou já posso ir brincar com meus amigos? 🧸"
-   Se o NÚMERO DE INTERAÇÃO for 4, termine com: "Posso te ajudar com mais alguma coisa ou posso ir pular corda? 🤸‍♀️"
-   Se o NÚMERO DE INTERAÇÃO for 5, termine com: "Posso te ajudar com mais alguma coisa ou posso ir brincar de esconde-esconde? 👀"
-   Se o NÚMERO DE INTERAÇÃO for 6 ou maior, você tem a liberdade de escolher uma dessas frases ou criar uma nova no mesmo estilo fofo e infantil.

**REGRAS ESPECIAIS DE DOWNLOAD:**
-   Você SÓ DEVE gerar um link de download se o usuário EXPLICITAMENTE pedir por um dos arquivos.
-   Quando o usuário pedir, use uma das seguintes frases exatas:
    -   Para o formulário: "Claro! Pode baixar o formulário aqui: [DOWNLOAD_FORMULARIO]"
    -   Para as regras gerais: "Com certeza! Você pode ler as regras gerais baixando o arquivo aqui: [DOWNLOAD_REGRAS]"
    -   Para a portaria: "Sem problemas! Para mais detalhes, baixe a portaria da adoção por aqui: [DOWNLOAD_PORTARIA]"
`;

// 5. Rota da API para o chat
app.post('/api/chat', async (req, res) => {
    try {
        const { message: userInput, interaction: interactionCount } = req.body; // Pega a mensagem e o contador da interação
        const hoje = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }); // Data atual para referência

        const promptFinal = `
            ${instrucoesDaMarIA}

            **INFORMAÇÕES DE CONTEXTO PARA SUA RESPOSTA:**

            1.  **DATA ATUAL DE REFERÊNCIA:** ${hoje}
            2.  **NÚMERO DE INTERAÇÃO ATUAL:** ${interactionCount}

            3.  **CONTEÚDO DOS DOCUMENTOS (USE APENAS SE A PERGUNTA NÃO FOR SOBRE DATAS):**
                ${conhecimento}

            4.  **CRONOGRAMA DE DATAS COMPLETO (EXTRAÍDO DO EXCEL):**
                ${cronogramaDeDatas}

            **PERGUNTA DO USUÁRIO:**
            Com base em tudo isso, e principalmente na DATA ATUAL e no NÚMERO DE INTERAÇÃO, responda a seguinte pergunta: "${userInput}"
        `;
        
        const result = await model.generateContent(promptFinal);
        const response = result.response;
        
        res.send({ reply: response.text() });
    } catch (error) {
        console.error("ERRO DETALHADO NA CHAMADA DA API:", error);
        res.status(500).send({ error: 'Ops! Algo deu errado ao contatar o Gemini.' });
    }
});

// 6. Função para iniciar o servidor
async function iniciarServidor() {
    await carregarConhecimento(); 
    carregarCronograma();
    app.listen(port, () => {
        console.log(`\n🚀 Servidor da Mar.IA rodando! Acesse http://localhost:${port} no seu navegador.`);
    });
}

iniciarServidor();
