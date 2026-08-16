const sid = process.env.TWILIO_ACCOUNT_SID;
const token = process.env.TWILIO_AUTH_TOKEN;
const from = process.env.TWILIO_WHATSAPP_FROM;
const to = process.env.TWILIO_WHATSAPP_TO;
if (!sid || !token || !from || !to) throw new Error('Twilio WhatsApp não configurado');
const body = new URLSearchParams({
  Body: 'Teste do monitoramento João Caiçara: integração WhatsApp funcionando.',
  From: from,
  To: to,
});
const resposta = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
  method: 'POST',
  headers: {
    Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  },
  body,
});
const texto = await resposta.text();
if (!resposta.ok) throw new Error(`Twilio HTTP ${resposta.status}: ${texto}`);
const dados = JSON.parse(texto);
console.log(JSON.stringify({ sid: dados.sid, status: dados.status, direction: dados.direction, to: dados.to }, null, 2));
