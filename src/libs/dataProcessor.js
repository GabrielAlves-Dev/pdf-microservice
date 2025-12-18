const QRCode = require("qrcode");
const { ChartJSNodeCanvas } = require("chartjs-node-canvas");
const logger = require("./logger");

const width = 800;
const height = 400;
const chartCallback = (ChartJS) => {
  ChartJS.defaults.responsive = true;
  ChartJS.defaults.maintainAspectRatio = false;
};

const chartJSNodeCanvas = new ChartJSNodeCanvas({
  width,
  height,
  chartCallback,
});

async function preProcessData(data) {
  if (!data.secoes || !Array.isArray(data.secoes)) return data;

  let index = 0;

  for (const secao of data.secoes) {
    index++;

    logger.info(`[DEBUG] Processando seção #${index}:`, {
      componente: secao.componente,
      temConfig: !!secao.config,
      temConteudo: !!secao.conteudo,
      chaves: Object.keys(secao),
    });

    // Normalizar imagens embutidas (data URI) para componente 'foto' quando aplicável
    if (secao.componente && secao.componente.toLowerCase() === "foto") {
      if (secao.conteudo) {
        const c = String(secao.conteudo).trim();
        if (!/^data:/.test(c) && !/^https?:\/\//.test(c)) {
          const base = c.replace(/\s+/g, "");
          if (/^[A-Za-z0-9+/=]+$/.test(base) && base.length > 100) {
            secao.conteudo = `data:image/png;base64,${base}`;
            logger.info(
              `[SUCESSO] Conteúdo da foto normalizado para dataURI na seção #${index}`
            );
          } else {
            logger.warn(
              `[AVISO] Seção #${index} (foto) tem conteúdo não reconhecido; envie como data URI ou URL`
            );
          }
        }
      } else {
        logger.warn(`[ALERTA] Seção #${index} é foto mas não tem 'conteudo'`);
      }
    }

    if (secao.componente && secao.componente.toLowerCase() === "qrcode") {
      if (!secao.conteudo) {
        logger.warn(
          `[ALERTA] Seção #${index} é QR Code mas não tem 'conteudo'!`
        );
        continue;
      }
      try {
        secao.imagemBase64 = await QRCode.toDataURL(secao.conteudo, {
          errorCorrectionLevel: "H",
          width: 200,
          margin: 1,
          color: {
            dark: "#000000",
            light: "#ffffffff",
          },
        });
        logger.info(`[SUCESSO] QR Code gerado para seção #${index}`);
      } catch (e) {
        logger.error("Erro ao gerar QR Code", {
          error: e.message,
          conteudo: secao.conteudo || "N/A",
        });
        throw new Error(
          `Falha crítica ao gerar QR Code para: ${secao.conteudo}`
        );
      }
    }

    if (secao.componente && secao.componente.toLowerCase() === "grafico") {
      if (!secao.config) {
        logger.warn(`[ALERTA] Seção #${index} é Gráfico mas não tem 'config'!`);
        continue;
      }
      try {
        const buffer = await chartJSNodeCanvas.renderToBuffer(secao.config);
        secao.imagemBase64 = `data:image/png;base64,${buffer.toString(
          "base64"
        )}`;
        logger.info(`[SUCESSO] Gráfico gerado para seção #${index}`);
      } catch (e) {
        logger.error("Erro ao gerar gráfico", {
          error: e.message,
          config: secao.config || "N/A",
        });
        throw new Error(`Falha crítica ao gerar gráfico.`);
      }
    }
  }
  return data;
}

module.exports = {
  preProcessData,
};
